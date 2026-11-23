"""Terminal first-panel check (added 23 Nov 2026 after the Terminal showed only "TERMINAL DATA DIDN'T ARRIVE" on the live build).
Usage: python3 scripts/perf/terminal_check.py <base-url> [--budget-ms 2000]
Loads <base-url>/terminal at 1440 and 390 px, twice each (cold, then warm), and exits 1 when the Today panel has no story rows within
15 s, when the whole-page failure line is shown, or when the page scrolls sideways. Prints the time to the first row for each load."""
import asyncio, sys, time
from playwright.async_api import async_playwright

ROWS = 'section[aria-label="Today"] ol li'
async def once(b, base, w):
    ctx = await b.new_context(viewport={"width": w, "height": 1800})
    pg = await ctx.new_page()
    t0 = time.time()
    await pg.goto(f"{base}/terminal", wait_until="domcontentloaded", timeout=60000)
    try:
        await pg.wait_for_selector(ROWS, timeout=15000)
        ms = round((time.time() - t0) * 1000)
    except Exception:
        ms = None
    await pg.wait_for_timeout(5000)  # late reads (ticker, story list) get their chance to fail
    r = await pg.evaluate("""(sel) => ({ rows: document.querySelectorAll(sel).length, pageFailed: [...document.querySelectorAll('[role=alert]')].some(a => /DIDN'T ARRIVE/.test(a.textContent || '')), overflow: document.documentElement.scrollWidth - innerWidth })""", ROWS)
    await ctx.close()
    return ms, r

async def main():
    base = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8080"
    budget = int(sys.argv[sys.argv.index("--budget-ms") + 1]) if "--budget-ms" in sys.argv else None
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for w in (1440, 390):
            for label in ("cold", "warm"):
                ms, r = await once(b, base, w)
                print(f"{w} px {label}: first row {ms} ms, {r['rows']} rows, page failed {r['pageFailed']}, sideways {r['overflow']} px")
                if not r["rows"] or ms is None: bad.append(f"{w} {label}: the first panel has no rows")
                if r["pageFailed"]: bad.append(f"{w} {label}: the whole Terminal shows the failure line")
                if r["overflow"] > 0: bad.append(f"{w} {label}: scrolls sideways")
                if budget and ms and ms > budget: bad.append(f"{w} {label}: first row after {ms} ms (budget {budget})")
        await b.close()
    if bad:
        print("FAIL:\n  " + "\n  ".join(bad)); sys.exit(1)
    print("OK")
asyncio.run(main())
