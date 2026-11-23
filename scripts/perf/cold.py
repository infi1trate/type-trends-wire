"""C1 · a page on a cold server instance against the same page on a warm one, in a real browser.
Usage: python3 scripts/perf/cold.py <dist-dir> <out.json> <pages,comma> <widths,comma> [cold,warm]
<dist-dir> is a production build of this app (`vite build` in a scratch copy; never the project's own output folder), run under the
hosted runtime's engine with wrangler (`scripts/perf/cold-run.sh <dist-dir> <port>` starts it; see its header). A cold measure starts a
fresh server process first, so its first page request meets an instance with no memos, no page copies, no database connection and no
code loaded beyond the entry. A warm measure asks for the same page under a new address (an ignored `_w` parameter), so it meets the
warm instance without its kept copy of the page. Records time to first byte, end of the HTML, largest paint and its element (and
whether it sits in a late block), layout shift with its first sources, the time each late block arrived, words, failed parts and the
x-instance-age / x-instance-requests headers. When the build carries the scratch read timer (`/__c1t`), every server read is listed.
Against the live site, use the x-instance-age header to sort measures into cold and warm instead of starting a server.
The browser asks for the page uncompressed: the local engine gzips a streamed page in one block at its end (the hosted runtime streams
compressed pages in pieces, measured 23 Nov), so a compressed local measure would time the whole page, not when its parts arrive."""
import asyncio, json, os, subprocess, sys, time, urllib.request, signal
from playwright.async_api import async_playwright
DIST = sys.argv[1]; OUT = sys.argv[2]; PAGES = sys.argv[3].split(","); WIDTHS = [int(w) for w in sys.argv[4].split(",")]; MODES = sys.argv[5].split(",") if len(sys.argv) > 5 else ["cold", "warm"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
PORT = 8790; BASE = f"http://127.0.0.1:{PORT}"
PATHS = {"front": "/", "brand": "/brands/netlify.com", "study": "/data/who-went-big-first", "signals": "/signals", "terminal": "/terminal?panel=today&q=&sort=domain&desc=false&page=0", "branddata": "/brands/netlify.com?view=data"}
OBS = """
window.__p = {lcp: 0, el: '', cls: 0, shifts: [], late: []};
new MutationObserver(() => { document.querySelectorAll('[data-later-ready]:not([data-seen])').forEach(n => { n.setAttribute('data-seen',''); window.__p.late.push([Math.round(performance.now()), n.id || (n.querySelector('h1,h2,h3')||{}).textContent?.slice(0,30) || '?']); }); document.querySelectorAll('[data-later-failed]:not([data-seen])').forEach(n => { n.setAttribute('data-seen',''); window.__p.late.push([Math.round(performance.now()), 'FAILED']); }); }).observe(document, {subtree: true, childList: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__p.lcp = e.startTime; const n = e.element; window.__p.el = n ? (n.tagName + (n.currentSrc ? ' ' + n.currentSrc.slice(-60) : ' "' + (n.textContent || '').trim().slice(0, 50) + '"') + (n.closest('[data-later]') ? ' [in late block]' : '')) : (e.url || ''); } }).observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__p.cls += e.value; window.__p.shifts.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources||[]).map(s => s.node ? (s.node.id || s.node.className || s.node.tagName || '').toString().slice(0,40) : '').join('|')]); } }).observe({type: 'layout-shift', buffered: true});
"""
proc = None
def start():
    global proc
    stop()
    subprocess.run(["rm", "-rf", os.path.join(os.path.dirname(DIST), ".wrangler")])
    log = open("/tmp/wr/w.log", "w")
    proc = subprocess.Popen([os.path.join(os.path.dirname(os.path.abspath(__file__)), "cold-run.sh"), DIST, str(PORT)], stdout=log, stderr=subprocess.STDOUT, preexec_fn=os.setsid)
    for _ in range(60):
        try:
            j = json.loads(urllib.request.urlopen(BASE + "/__c1t", timeout=2).read())
            if j == []: return time.time()
            raise SystemExit("not a fresh instance")
        except SystemExit: raise
        except Exception: time.sleep(0.5)
    raise SystemExit("server did not start")
def stop():
    global proc
    if proc:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL); proc.wait(); proc = None
    subprocess.run("pkill -9 -f wrangler-dist/cli.js ; pkill -9 -f bin/workerd", shell=True)
    import socket
    for _ in range(40):
        try: socket.create_connection(("127.0.0.1", PORT), timeout=0.3).close(); time.sleep(0.25)
        except OSError: break
def srvlog(path):
    try:
        for j in reversed(json.loads(urllib.request.urlopen(BASE + "/__c1t", timeout=5).read())):
            if j["path"] == path: return j
    except Exception as e: return {"err": str(e)}
    return None
async def visit(pw, path, w):
    h = 844 if w < 500 else (1024 if w < 1000 else 900)
    b = await pw.chromium.launch(headless=True)
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 800 else 1, is_mobile=w < 800, has_touch=w < 800, user_agent=UA, extra_http_headers={"accept-encoding": "identity"})
    page = await ctx.new_page(); await page.add_init_script(OBS)
    errs = []; page.on("console", lambda m: errs.append(m.text[:120]) if m.type == "error" else None)
    t = time.time(); r = await page.goto(BASE + path, wait_until="load", timeout=60000)
    inst = {k: (r.headers.get(k) if r else None) for k in ("x-instance-age", "x-instance-requests", "x-read-cache")}
    try: await page.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
    await page.wait_for_timeout(1500)
    nav = await page.evaluate("(() => { const n = performance.getEntriesByType('navigation')[0]; return {ttfb: n.responseStart - n.requestStart, html_end: n.responseEnd - n.requestStart}; })()")
    p = await page.evaluate("window.__p")
    words = await page.evaluate("document.body.innerText.split(/\\s+/).length")
    failed = await page.locator("[data-later-failed],[data-part-failed]").count()
    await b.close()
    return {"status": r.status if r else 0, "ttfb": round(nav["ttfb"]), "html_end": round(nav["html_end"]), "lcp": round(p["lcp"]), "lcp_el": p["el"], "cls": round(p["cls"], 4), "shifts": p["shifts"][:6], "words": words, "failed_parts": failed, "late": p["late"], "instance": inst, "errors": errs[:3]}
async def main():
    res = json.load(open(OUT)) if os.path.exists(OUT) else []
    async with async_playwright() as pw:
        for key in PAGES:
            for w in WIDTHS:
                path = PATHS[key]
                if "cold" in MODES:
                    up = start(); time.sleep(0.2)
                    m = await visit(pw, path, w); m.update(page=key, width=w, mode="cold", srv=srvlog(path)); res.append(m); print(json.dumps({k: m[k] for k in ("page","width","mode","ttfb","html_end","lcp","cls","words","failed_parts")}), m["lcp_el"], flush=True)
                if "warm" in MODES:
                    if "cold" not in MODES and not proc: start(); await visit(pw, path + ("&" if "?" in path else "?") + "_w=0", w)
                    wp = path + ("&" if "?" in path else "?") + f"_w={w}"
                    m = await visit(pw, wp, w); m.update(page=key, width=w, mode="warm", srv=srvlog(wp)); res.append(m); print(json.dumps({k: m[k] for k in ("page","width","mode","ttfb","html_end","lcp","cls","words","failed_parts")}), m["lcp_el"], flush=True)
    stop(); json.dump(res, open(OUT, "w"), indent=1)
asyncio.run(main())
