"""C1b · cold vs warm on a local production copy (wrangler dev runs the hosted runtime's engine; `scripts/perf/cold-run.sh` starts it),
throttled to a typical cable line (WebPageTest Cable: 5 Mbps down, 1 Mbps up, 28 ms RTT). Warm = a fresh process warmed by two other
pages, so the page meets a warm instance without a kept copy of itself. usage: cold_ab.py <dist> <out.json> <label> [reps] [pages]"""
import asyncio, json, os, subprocess, sys, time, socket, signal, urllib.request
from playwright.async_api import async_playwright
DIST, OUT, LABEL = sys.argv[1], sys.argv[2], sys.argv[3]; REPS = int(sys.argv[4]) if len(sys.argv) > 4 else 1
PORT = 8790; BASE = f"http://127.0.0.1:{PORT}"
ALL = {"front": "/", "brand": "/brands/netlify.com", "story": "/stories/brand%3Anetlify.com%3A2026-11-20"}
PAGES = {k: ALL[k] for k in (sys.argv[5].split(",") if len(sys.argv) > 5 else ALL)}
WIDTHS = [(390, 844), (1440, 900)]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
OBS = """window.__p={lcp:0,el:'',src:'',cls:0};
new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__p.lcp=e.startTime;const n=e.element;window.__p.src=e.url||'';window.__p.el=n?(n.tagName+(n.currentSrc?' '+n.currentSrc.split('/').slice(-2).join('/'):' "'+(n.textContent||'').trim().slice(0,40)+'"')):''}}).observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__p.cls+=e.value}).observe({type:'layout-shift',buffered:true});"""
proc = None
def stop():
    global proc
    if proc: os.killpg(os.getpgid(proc.pid), signal.SIGKILL); proc.wait(); proc = None
    subprocess.run("pkill -9 -f wrangler-dist/cli.js ; pkill -9 -f bin/workerd", shell=True, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try: socket.create_connection(("127.0.0.1", PORT), timeout=0.3).close(); time.sleep(0.25)
        except OSError: break
def start():
    global proc
    stop(); subprocess.run(["rm", "-rf", os.path.join(os.path.dirname(DIST), ".wrangler")])
    proc = subprocess.Popen(["bash", os.path.join(os.path.dirname(os.path.abspath(__file__)), "cold-run.sh"), DIST, str(PORT)], stdout=open(f"/tmp/wr-{LABEL}.log", "w"), stderr=subprocess.STDOUT, preexec_fn=os.setsid)
    for _ in range(80):
        try: urllib.request.urlopen(BASE + "/favicon.svg", timeout=2).read(); return
        except Exception: time.sleep(0.5)
    raise SystemExit("server did not start")
async def measure(b, path, w, h):
    ctx = await b.new_context(viewport={"width": w, "height": h}, user_agent=UA, extra_http_headers={"accept-encoding": "identity"})
    pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
    await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    await cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 28, "downloadThroughput": 5_000_000 / 8, "uploadThroughput": 1_000_000 / 8})
    await pg.add_init_script(OBS)
    hdr = {}
    pg.on("response", lambda r: hdr.update({"age": r.headers.get("x-instance-age"), "link": bool(r.headers.get("link"))}) if r.request.resource_type == "document" else None)
    t0 = time.time()
    await pg.goto(BASE + path, wait_until="load", timeout=120000)
    await pg.wait_for_timeout(1500)
    p = await pg.evaluate("window.__p")
    nav = await pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:n.responseStart,end:n.responseEnd}})()")
    res = await pg.evaluate("""(src)=>{const r=performance.getEntriesByType('resource').find(e=>e.name===src);return r?{found:r.startTime,sent:r.requestStart,first:r.responseStart,end:r.responseEnd}:null}""", p["src"]) if p["src"] else None
    imgs = await pg.evaluate("performance.getEntriesByType('resource').filter(e=>/\\/(thumbs|crops)\\//.test(e.name)).slice(0,3).map(e=>[e.name.split('/').slice(-2).join('/'),Math.round(e.startTime),Math.round(e.requestStart),Math.round(e.responseEnd)])")
    await ctx.close()
    r = lambda x: None if x is None else round(x)
    return {"ttfb": r(nav["ttfb"]), "doc_end": r(nav["end"]), "lcp": r(p["lcp"]), "el": p["el"][:70], "cls": round(p["cls"], 4), "age": hdr.get("age"), "link_header": hdr.get("link"),
            "pic": {k: r(v) for k, v in res.items()} if res else None, "first_pics": imgs}
async def main():
    out = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for rep in range(REPS):
            for name, path in PAGES.items():
                for w, h in WIDTHS:
                    start()
                    cold = await measure(b, path, w, h)
                    # warm: a fresh process warmed by two other pages first, so the target meets a warm instance with no kept copy of itself
                    start()
                    for other in ["/signals", "/data/who-went-big-first"]: urllib.request.urlopen(urllib.request.Request(BASE + other, headers={"accept-encoding": "identity"}), timeout=60).read()
                    time.sleep(1)
                    warm = await measure(b, path, w, h)
                    out.append({"page": name, "w": w, "rep": rep, "cold": cold, "warm": warm})
                    print(json.dumps(out[-1]), flush=True)
        await b.close()
    stop(); json.dump(out, open(OUT, "w"), indent=1)
asyncio.run(main())
