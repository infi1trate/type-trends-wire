"""Page speed measurement for Phase 21 (same script before and after).
Usage: python3 scripts/perf/measure.py <base-url> <cookie-file> <out.json> [page-key ...]
Mid-range phone profile on both widths: 4x CPU slowdown, 150 ms RTT, 1.6 Mbps down / 750 kbps up.
Records HTML bytes (decoded), JS bytes (transferred), requests, LCP, CLS and TBT (long tasks over 50 ms after FCP)."""
import asyncio, json, sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright

PAGES = {
    "front": "/",
    "story": "/stories/breakout%3Acss%3Ascroll_timeline%3Aall%3A13",
    "signals": "/signals",
    "signal": "/signals/combo%3Abig_type",
    "brands": "/brands",
    "brand": "/brands/neon.com",
    "patterns": "/patterns",
    "collection": "/collections/who-went-big",
    "data-story": "/data/who-went-big-first",
    "digest": "/digest",
    "terminal": "/terminal",
    "ambient": "/ambient",
}
WIDTHS = [(360, 780), (1440, 900)]
OBS = """
window.__perf = {lcp: 0, cls: 0, fcp: 0, long: []};
new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({type: 'layout-shift', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; }).observe({type: 'paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.long.push([e.startTime, e.duration]); }).observe({type: 'longtask', buffered: true});
"""

async def one(pw, base, cookie, key, path, w, h):
    browser = await pw.chromium.launch(headless=True)
    ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 800 else 1, is_mobile=w < 800, has_touch=w < 800)
    host = urlparse(base).hostname
    name, _, value = cookie.partition("=")
    await ctx.add_cookies([{"name": name, "value": value, "domain": host, "path": "/"}])
    page = await ctx.new_page()
    cdp = await ctx.new_cdp_session(page)
    await cdp.send("Network.enable")
    await cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    await cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150, "downloadThroughput": 1.6e6 / 8, "uploadThroughput": 750e3 / 8})
    reqs, js, html = {"n": 0}, {"b": 0}, {"b": 0}
    types = {}
    cdp.on("Network.responseReceived", lambda e: types.__setitem__(e["requestId"], e["type"]))
    def fin(e):
        reqs["n"] += 1
        if types.get(e["requestId"]) == "Script": js["b"] += e["encodedDataLength"]
    cdp.on("Network.loadingFinished", fin)
    await page.add_init_script(OBS)
    resp = await page.goto(base + path, wait_until="load", timeout=120000)
    status = resp.status if resp else 0
    try: html["b"] = len(await resp.body()) if resp else 0
    except Exception: pass
    await page.wait_for_timeout(5000)
    p = await page.evaluate("window.__perf")
    tbt = sum(max(0, d - 50) for s, d in p["long"] if s >= p["fcp"])
    await browser.close()
    return {"page": key, "path": path, "width": w, "status": status, "html_kb": round(html["b"] / 1024, 1), "js_kb": round(js["b"] / 1024, 1),
            "requests": reqs["n"], "lcp_ms": round(p["lcp"]), "cls": round(p["cls"], 3), "tbt_ms": round(tbt)}

async def main():
    base, cookie_file, out = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]
    keys = sys.argv[4:] or list(PAGES)
    cookie = open(cookie_file).read().strip()
    rows = []
    async with async_playwright() as pw:
        for k in keys:
            for w, h in WIDTHS:
                try: r = await one(pw, base, cookie, k, PAGES[k], w, h)
                except Exception as e: r = {"page": k, "width": w, "error": str(e)[:200]}
                print(json.dumps(r), flush=True); rows.append(r)
    json.dump(rows, open(out, "w"), indent=1)

asyncio.run(main())
