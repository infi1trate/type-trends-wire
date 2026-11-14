#!/usr/bin/env python3
"""Render one homepage the way crawler/src/library.js captureImages() does (1440x900 desktop, crawler UA,
fold 960w JPEG q70 + up to 4 two-viewport sections 720w JPEG q65) and print {"fold","sections"} data URLs
as JSON on stdout. Used only by scripts/ai-parity.ts; images stay in memory and are never written to disk."""
import asyncio, base64, io, json, sys
from PIL import Image
from playwright.async_api import async_playwright

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 DSGNTerminalBot/0.1 (+https://type-trends-wire.lovable.app)"

def jpeg(png: bytes, width: int, quality: int) -> str:
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()

async def main(url: str):
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(user_agent=UA, viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="en-US", reduced_motion="reduce")
        page = await ctx.new_page()
        await page.goto(url, wait_until="load", timeout=45000)
        await page.wait_for_timeout(1500)
        width, height = 1440, 900
        total = await page.evaluate("() => document.documentElement.scrollHeight")
        h = min(total, height * 9)
        y = height
        while y < h:
            await page.evaluate("(yy) => window.scrollTo(0, yy)", y); await page.wait_for_timeout(250); y += height
        await page.evaluate("() => window.scrollTo(0, 0)"); await page.wait_for_timeout(500)
        fold = await page.screenshot(type="png", clip={"x": 0, "y": 0, "width": width, "height": height})
        sections, y = [], height
        while y < h and len(sections) < 4:
            sh = min(height * 2, h - y)
            if sh < 300: break
            try: sections.append(jpeg(await page.screenshot(type="png", full_page=True, clip={"x": 0, "y": y, "width": width, "height": sh}), 720, 65))
            except Exception: pass
            y += height * 2
        await b.close()
        sys.stdout.write(json.dumps({"fold": jpeg(fold, 960, 70), "sections": sections}))

asyncio.run(main(sys.argv[1]))
