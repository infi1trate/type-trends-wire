# I3 · measure stored section crops (read through the local /crops route, in memory only; nothing is written but the stats file).
# Usage: python3 scripts/crop-quality-measure.py rows.json stats.json, then bun scripts/i3-crop-quality.ts stats.json
import json, io, sys, urllib.request, concurrent.futures as cf
from PIL import Image, ImageStat
rows = json.load(open('sys.argv[1]'))
def stat(r):
    try:
        b = urllib.request.urlopen('http://localhost:8080/crops/' + r['path'], timeout=30).read()
        im = Image.open(io.BytesIO(b)).convert('L')
        st = ImageStat.Stat(im)
        hist = im.histogram(); top = max(hist) / sum(hist)
        small = im.resize((32, 20)); edges = sum(abs(small.getpixel((x, y)) - small.getpixel((x + 1, y))) for y in range(20) for x in range(31)) / (31 * 20)
        return {**r, 'std': round(st.stddev[0], 1), 'top': round(top, 3), 'edges': round(edges, 2), 'bpp': round(r['bytes'] / (r['width'] * r['height']), 4)}
    except Exception as e:
        return {**r, 'err': str(e)[:80]}
with cf.ThreadPoolExecutor(8) as ex: out = list(ex.map(stat, rows))
json.dump(out, open('sys.argv[2]', 'w'))
print(len(out), sum(1 for o in out if 'err' in o))
