"""P2c · deferred blocks must not move the page: a check run against the dev server (it needs the dev-only `?__late=` switch).
Usage: python3 scripts/perf/deferred_heights.py [base-url]   (default http://localhost:8080; exits 1 on any failure)

For the front page and /brands at 390, 768 and 1440 px it loads each page twice in fresh browser contexts:
  warm  - as it is;
  late  - with every deferred read held 2 to 4 s on the server (`?__late=2000`, see src/lib/dev-late.server.ts).
Measured, never typed in: every deferred slot's placeholder height while it waits (sampled every 25 ms) and its real height once in,
the page height and word count, and the layout shift while the late blocks land and while the page is walked top to bottom the way the
page review walks it (700 px steps, 110 ms apart). It fails when
  - a slot's placeholder and real height differ by more than 1 px, unless the slot holds the whole page body (`data-later-reserve`):
    then its placeholder must reach the bottom of the screen, so nothing on screen sits below it to be pushed;
  - layout shift while the blocks land, or during the walk, is 0.01 or more;
  - a counting figure (Motion `Count`), brought into view, changes its line's height or its own width while it rolls;
  - the late page's height or word count differs from the warm page's (by more than WORD_SLACK words; the first-visit tour's words left out: it appears on its own
    timer, so whether it is up when the page is read says nothing about the page)."""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
PAGES = ["/", "/brands"]
WIDTHS = [390, 768, 1440]
SCREEN_H = 900
LATE_MS = 2000
SHIFT_LIMIT = 0.01
# Two loads a few seconds apart can differ by a relative time ("now" / "1 min ago") on a live page; more than this is a missing block.
WORD_SLACK = 2
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 slug-check/1"
OBSERVE = """(() => { const m = window.__p2c = { cls: 0, walk: 0, walking: false, slots: {}, shifts: [] };
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { if (m.walking) m.walk += e.value; else m.cls += e.value;
  m.shifts.push([Math.round(e.startTime), +e.value.toFixed(4), m.walking]); } }).observe({ type: 'layout-shift', buffered: true });
const poll = () => { for (const el of document.querySelectorAll('[data-later][aria-busy="true"]')) { if (el.closest('[hidden]') || !el.getClientRects().length) continue; // still in the stream's hidden staging
  const r = el.getBoundingClientRect(), s = m.slots[el.id] || (m.slots[el.id] = { ph: 0, bottom: 0 });
  s.ph = Math.max(s.ph, Math.round(r.height)); s.bottom = Math.max(s.bottom, Math.round(r.bottom)); s.body = el.hasAttribute('data-later-reserve'); } };
setInterval(poll, 25); document.addEventListener('readystatechange', poll); })();"""
FINISH = """() => { const m = window.__p2c, words = el => el.innerText.split(/\\s+/).filter(Boolean).length; /* the first-visit tour (it shows after a few seconds) is left out */
  for (const el of document.querySelectorAll('[data-later]')) { const s = m.slots[el.id]; if (s) s.real = Math.round(el.getBoundingClientRect().height); }
  return { cls: m.cls, slots: m.slots, height: document.documentElement.scrollHeight, words: words(document.body) - [...document.querySelectorAll('[role="dialog"][aria-label^="Tour step"]')].reduce((n, t) => n + words(t), 0) }; }"""
WALK = """async () => { const m = window.__p2c; m.walking = true; for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 110)); }
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 400)); m.walking = false; return m.walk; }"""

# Each counting figure, brought into view in turn: its line's height and the figure's width are sampled every frame while it rolls.
COUNTS = """async () => { const out = []; for (const el of document.querySelectorAll('[data-motion-pattern="count"]')) {
  const line = el.closest('p, li, figure') || el.parentElement; el.scrollIntoView({ block: 'center' }); const hs = [], ws = [], seen = new Set(), t0 = performance.now();
  await new Promise(done => { const step = () => { hs.push(line.getBoundingClientRect().height); ws.push(el.getBoundingClientRect().width); seen.add(el.textContent); if (performance.now() - t0 < 1000) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
  out.push({ text: (el.querySelector('.sr-only') || el).textContent, lineMoved: Math.round(Math.max(...hs) - Math.min(...hs)), widthMoved: Math.round(Math.max(...ws) - Math.min(...ws)), frames: seen.size, shown: el.getClientRects().length > 0 }); }
  scrollTo(0, 0); return out; }"""

async def load(browser, path, width, late, counts=False):
    ctx = await browser.new_context(viewport={"width": width, "height": SCREEN_H}, user_agent=UA)
    await ctx.add_init_script(OBSERVE)
    page = await ctx.new_page()
    url = BASE + path + (f"?__late={late}" if late else "")
    try: await page.goto(url, wait_until="networkidle", timeout=120_000)
    except Exception: await page.wait_for_load_state("load", timeout=60_000)
    await page.wait_for_timeout(1500)
    m = await page.evaluate(FINISH)
    m["counts"] = await page.evaluate(COUNTS) if counts else []  # before any walk: a figure rolls only the first time it is seen
    m["walk"] = 0 if counts else await page.evaluate(WALK)
    await ctx.close()
    return m

async def main():
    failures, rows = [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for path in PAGES:
            for w in WIDTHS:
                warm = await load(browser, path, w, 0)
                late = await load(browser, path, w, LATE_MS)
                rolled = await load(browser, path, w, 0, counts=True)
                for c in rolled["counts"]:
                    if c["lineMoved"] > 1 or c["widthMoved"] > 1: failures.append(f"{where}: counting figure {c['text']!r} moved its line {c['lineMoved']} px and its width {c['widthMoved']} px while rolling")
                where = f"{path} @ {w}"
                for sid, s in late["slots"].items():
                    rows.append({"where": where, "slot": sid, "placeholder": s["ph"], "real": s.get("real"), "body": s.get("body", False)})
                    if s.get("body"):
                        if s["bottom"] < SCREEN_H: failures.append(f"{where}: {sid} holds the page body but its placeholder ends at {s['bottom']} px, above the screen bottom")
                    elif s.get("real") is None or abs(s["ph"] - s["real"]) > 1:
                        failures.append(f"{where}: {sid} placeholder {s['ph']} px, real {s.get('real')} px")
                for k, v in (("landing", late["cls"]), ("walk", late["walk"]), ("warm walk", warm["walk"])):
                    if v >= SHIFT_LIMIT: failures.append(f"{where}: layout shift {v:.3f} during the {k}")
                if late["height"] != warm["height"] or abs(late["words"] - warm["words"]) > WORD_SLACK:
                    failures.append(f"{where}: late {late['height']} px / {late['words']} words, warm {warm['height']} px / {warm['words']} words")
                rows.append({"where": where, "warm": [warm["height"], warm["words"]], "late": [late["height"], late["words"]], "shift": [round(late["cls"], 4), round(late["walk"], 4), round(warm["walk"], 4)]})
        await browser.close()
    print(json.dumps(rows, indent=1))
    if failures:
        print("FAILED"); [print(" -", f) for f in failures]; sys.exit(1)
    print("passed")

if __name__ == "__main__":
    asyncio.run(main())
