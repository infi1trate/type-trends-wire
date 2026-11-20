import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chromium } from "playwright";
import { serve } from "./serve.js";
import { CROP_LIMITS } from "../src/crops.js";
// The fixture is served from localhost, which the asset fetcher only allows in test mode.
process.env.ALLOW_HTTP = "1";
const { ASSET_LIMITS, iconOrder, encodeIcon, findBrandAssets, captureBrandAssets, publicAssetUrl } = await import("../src/assets.js");

const png = (w, h, c = "#336699") => sharp({ create: { width: w, height: h, channels: 3, background: c } }).png().toBuffer();

test("iconOrder: largest usable icon first, touch icon counts as 180, ICO skipped, conventional path last", () => {
  const icons = [
    { href: "https://a.com/favicon.ico", rel: "icon", size: 0, type: "image/x-icon" },
    { href: "https://a.com/i32.png", rel: "icon", size: 32, type: "image/png" },
    { href: "https://a.com/touch.png", rel: "apple", size: 0, type: "" },
    { href: "https://a.com/i192.png", rel: "icon", size: 192, type: "image/png" },
    { href: "https://a.com/logo.svg", rel: "icon", size: 0, type: "image/svg+xml" },
  ];
  assert.deepEqual(iconOrder(icons, "https://a.com"), ["https://a.com/logo.svg", "https://a.com/i192.png", "https://a.com/touch.png", "https://a.com/apple-touch-icon.png"]);
  assert.deepEqual(iconOrder([], "https://a.com"), ["https://a.com/apple-touch-icon.png"]);
  assert.deepEqual(iconOrder(null, ""), []);
});

test("encodeIcon: WebP within 256 px, never enlarged, too-small and unreadable refused", async () => {
  const big = await encodeIcon(await png(512, 512));
  assert.equal((await sharp(big.webp).metadata()).format, "webp");
  assert.equal(big.width, ASSET_LIMITS.iconMax); assert.equal(big.height, ASSET_LIMITS.iconMax);
  const touch = await encodeIcon(await png(180, 180));
  assert.equal(touch.width, 180);
  assert.ok(touch.webp.length <= CROP_LIMITS.storedBytes);
  assert.equal(await encodeIcon(await png(32, 32)), null);
  assert.equal(await encodeIcon(Buffer.from("not an image")), null);
  const svg = await encodeIcon(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f0f"/></svg>'));
  assert.ok(svg && svg.width >= ASSET_LIMITS.iconMin);
});

test("publicAssetUrl: refuses odd schemes and credentials", async () => {
  assert.equal(await publicAssetUrl("javascript:alert(1)"), null);
  assert.equal(await publicAssetUrl("https://user:pw@example.com/a.png"), null);
  assert.equal(await publicAssetUrl("data:image/png;base64,AAAA"), null);
});

test("captureBrandAssets: icon and card from the page's own head, queued as crop sections", { timeout: 60000 }, async () => {
  const server = await serve("test/fixtures/assets", 4871);
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:4871/");
    const found = await page.evaluate(findBrandAssets);
    assert.deepEqual(found.cards, ["http://localhost:4871/card.png"]);
    assert.equal(found.icons.length, 3); // mask-icon is not an icon here
    const sent = [];
    const done = await captureBrandAssets(page, "localhost:4871", { add: (c) => sent.push(c) }, { now: () => "2026-11-20T00:00:00.000Z" });
    assert.deepEqual(done, ["icon", "card"]);
    const icon = sent.find((c) => c.section === "icon"), card = sent.find((c) => c.section === "card");
    assert.equal(icon.width, 180); assert.equal(icon.height, 180);
    assert.equal(card.width, 1200); assert.equal(card.height, 630);
    for (const c of sent) {
      assert.equal(c.viewport, "desktop"); assert.match(c.hash, /^[0-9a-f]{64}$/);
      const m = await sharp(Buffer.from(c.webp_base64, "base64")).metadata();
      assert.equal(m.format, "webp"); assert.equal(m.width, c.width); assert.equal(m.height, c.height);
    }
  } finally { await browser.close(); server.close(); }
});
