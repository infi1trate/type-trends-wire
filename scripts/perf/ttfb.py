"""P1 · first byte and last deferred section for the Read pages, from outside, against any origin.
Usage: python3 scripts/perf/ttfb.py <origin> [out.json] [--story <id>]
For each page: the first request ("first": cold when nobody has drawn the page in the last five minutes) and an immediate repeat
("repeat": served from the shared copy when the edge cache is on). Records status, time to first byte, time to the end of the stream
(the last deferred section), HTML bytes and the cache headers. Plain HTTP, no browser; JS bytes and LCP/CLS stay in measure.py."""
import http.client, json, sys, time
from urllib.parse import urlparse, quote

PAGES = {
    "front": "/",
    "brand": "/brands/gopro.com",
    "brand-2": "/brands/dropbox.com",
    "brands": "/brands",
    "patterns": "/patterns",
    "pattern": "/patterns/components%3Acarousel",
    "signals": "/signals",
    "signal": "/signals/aesthetic%3Abrutalist",
    "digest": "/digest/2026-W46",
    "data-story": "/data/who-went-big-first",
    "sector": "/sectors/fintech",
}
TARGETS = {"first_ms": 800, "repeat_ms": 300}

def fetch(origin, path):
    u = urlparse(origin)
    c = (http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection)(u.netloc, timeout=60)
    t0 = time.time(); c.request("GET", path, headers={"accept": "text/html", "user-agent": "slug-perf/p1"}); r = c.getresponse()
    first, size = None, 0
    while True:
        b = r.read1(65536)
        if not b: break
        if first is None: first = time.time() - t0
        size += len(b)
    end = time.time() - t0
    return {"status": r.status, "ttfb_ms": round((first or end) * 1000), "end_ms": round(end * 1000), "html_kb": round(size / 1024, 1),
            "cache_control": r.getheader("cache-control"), "read_cache": r.getheader("x-read-cache"), "cf_cache": r.getheader("cf-cache-status")}

def main():
    args = sys.argv[1:]
    if not args: print(__doc__); sys.exit(2)
    origin = args[0].rstrip("/"); out = args[1] if len(args) > 1 and not args[1].startswith("--") else None
    pages = dict(PAGES)
    if "--story" in args: pages["story"] = "/stories/" + quote(args[args.index("--story") + 1], safe="")
    rows = []
    for key, path in pages.items():
        a = fetch(origin, path); b = fetch(origin, path)
        rows.append({"page": key, "path": path, "first": a, "repeat": b})
        print(f"{key:11s} {a['status']} first {a['ttfb_ms']:5d} ms (end {a['end_ms']:5d}) · repeat {b['ttfb_ms']:5d} ms (end {b['end_ms']:5d}) · {a['html_kb']:6.1f} KB · {b['read_cache'] or b['cf_cache'] or '-'}")
    res = {"origin": origin, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "targets": TARGETS, "rows": rows}
    if out:
        with open(out, "w") as f: json.dump(res, f, indent=1)

if __name__ == "__main__":
    main()
