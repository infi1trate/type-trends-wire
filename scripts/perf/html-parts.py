# Splits a page's HTML into the parts that matter for the budget: inline scripts (the hydration payload), inline styles, and markup.
# Usage: python3 scripts/perf/html-parts.py <base-url> <cookie-file> <path> [...]
import re, sys, urllib.request
base, cookie, paths = sys.argv[1], open(sys.argv[2]).read().strip(), sys.argv[3:]
DEFAULT = ["/", "/stories/breakout%3Acss%3Ascroll_timeline%3Aall%3A13", "/signals", "/signals/combo%3Abig_type", "/brands", "/brands/neon.com", "/patterns", "/collections/who-went-big", "/data/who-went-big-first", "/digest", "/terminal?panel=type", "/ambient"]
for p in paths or DEFAULT:
    req = urllib.request.Request(base + p, headers={"cookie": cookie, "accept-encoding": "identity", "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"})
    try: html = urllib.request.urlopen(req).read().decode("utf8")
    except Exception as e: print(p, "ERR", e); continue
    # The dev server tags every element with data-tsd-source (devtools); production builds don't, so strip it to compare like with like.
    html = re.sub(r' data-tsd-source="[^"]*"', "", html)
    scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)
    styles = re.findall(r"<style[^>]*>(.*?)</style>", html, re.S)
    svg = sum(len(m) for m in re.findall(r"<svg.*?</svg>", html, re.S))
    s, st = sum(len(x) for x in scripts), sum(len(x) for x in styles)
    big = max((len(x) for x in scripts), default=0)
    print(f"{p[:44]:44} total {len(html)/1024:7.1f}  scripts {s/1024:7.1f} (largest {big/1024:6.1f})  styles {st/1024:6.1f}  svg {svg/1024:6.1f}  markup {(len(html)-s-st)/1024:7.1f}")
