import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chromium } from "playwright";
import { serve } from "./serve.js";
import { VIEWPORTS } from "../src/core.js";
import { SECTIONS, CROP_LIMITS, findSectionBoxes, encodeCrop, cropHash, hashDistance, cropBody, clipsFrom, captureCrops, makeCropSender } from "../src/crops.js";

// Page-like image: flat bands with a dark block whose position is the "layout".
async function shot(width, height, { blockX = 0.1, tone = 0 } = {}) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, block = x > width * blockX && x < width * (blockX + 0.3) && y > height * 0.25 && y < height * 0.7;
    for (let c = 0; c < 3; c++) raw[i + c] = block ? 20 + tone : (y < height * 0.1 ? 40 : 235) + tone;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

test("encodeCrop keeps a tall section inside 1280×1600 and 150 KB as WebP", async () => {
  const e = await encodeCrop(await shot(1440, 2400));
  const m = await sharp(e.webp).metadata();
  assert.equal(m.format, "webp");
  assert.ok(e.width <= CROP_LIMITS.maxWidth && e.height <= CROP_LIMITS.maxHeight);
  assert.equal(m.width, e.width); assert.equal(m.height, e.height);
  assert.ok(e.webp.length <= CROP_LIMITS.storedBytes);
});

test("cropHash is 64 hex, steady under re-encoding noise, and moves with layout or style", async () => {
  const a = await shot(1440, 800), h = await cropHash(a, "inter|72|700");
  assert.match(h, /^[0-9a-f]{64}$/);
  // Same picture after a lossy round trip: the perceptual part is unchanged.
  const noisy = await sharp(await sharp(a).jpeg({ quality: 60 }).toBuffer()).png().toBuffer();
  assert.equal((await cropHash(noisy, "inter|72|700")).slice(0, 48), h.slice(0, 48));
  // A small overall tone drift (anti-aliasing, video frame) stays the same hash.
  assert.equal(await cropHash(await shot(1440, 800, { tone: 3 }), "inter|72|700"), h);
  // The block moved across the page: clearly a different layout.
  const moved = await cropHash(await shot(1440, 800, { blockX: 0.6 }), "inter|72|700");
  assert.ok(hashDistance(h, moved) >= 20);
  // Same pixels, new typeface or color: only the signature part changes, which is enough for a new version.
  const restyled = await cropHash(a, "fraunces|72|900");
  assert.equal(restyled.slice(0, 48), h.slice(0, 48));
  assert.notEqual(restyled.slice(48), h.slice(48));
});

test("clipsFrom keeps known sections in order, caps height and drops degenerate boxes", () => {
  const clips = clipsFrom({ sections: {
    footer: { x: 0, y: 5000, width: 1440, height: 300, sig: "f" }, hero: { x: 0, y: 0, width: 1440, height: 900, sig: "h" },
    pricing: { x: 0, y: 2000, width: 1440, height: 5000 }, cta: { x: 0, y: 4000, width: 1440, height: 10 }, sidebar: { x: 0, y: 0, width: 300, height: 300 },
  } });
  assert.deepEqual(clips.map((c) => c.section), ["hero", "pricing", "footer"]);
  assert.equal(clips[1].clip.height, CROP_LIMITS.maxCssHeight);
  assert.deepEqual(clips[0].clip, { x: 0, y: 0, width: 1440, height: 900 });
  assert.deepEqual(clipsFrom(null), []);
});

test("crop body carries exactly the contract fields", async () => {
  const c = cropBody("example.com", "hero", "2026-11-16T00:00:00.000Z", { webp: Buffer.from("RIFFxxxxWEBP"), width: 1280, height: 711 }, "ab".repeat(32));
  assert.deepEqual(Object.keys(c), ["domain", "section", "viewport", "captured_at", "width", "height", "hash", "webp_base64"]);
  assert.equal(c.viewport, "desktop");
  assert.equal(Buffer.from(c.webp_base64, "base64").toString(), "RIFFxxxxWEBP");
});

test("sender batches ≤12 crops per request to ingest-crops and tallies stored, unchanged and refused", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url: String(url), n: body.captures.length, auth: init.headers["x-crawl-secret"], run: body.run_id });
    return new Response(JSON.stringify({ stored: body.captures.length - 2, unchanged: 1, refused: [{ domain: "a.com", section: "hero", reason: "opted_out" }] }), { status: 200 });
  };
  const s = makeCropSender({ endpoint: "https://x.test/api/public/ingest-crawl", secret: "s", runId: "r1", fetchImpl, log: () => {} });
  const cap = { domain: "a.com", section: "hero", viewport: "desktop", captured_at: "2026-11-16T00:00:00Z", width: 10, height: 10, hash: "0".repeat(64), webp_base64: "QUJD" };
  for (let i = 0; i < 13; i++) s.add({ ...cap, section: SECTIONS[i % SECTIONS.length] });
  await s.flush();
  assert.deepEqual(calls.map((c) => c.n), [12, 1]);
  assert.equal(calls[0].url, "https://x.test/api/public/ingest-crops");
  assert.equal(calls[0].auth, "s"); assert.equal(calls[0].run, "r1");
  assert.equal(s.totals.captured, 13);
  assert.equal(s.totals.stored, 10 - 1); assert.equal(s.totals.unchanged, 2); assert.equal(s.totals.refused, 2);
  assert.deepEqual(s.totals.reasons, { opted_out: 2 });
  assert.equal(s.totals.by_section.hero, 3);
});

test("sender never throws: a refused request counts as failed, dry mode sends nothing", async () => {
  const cap = { domain: "a.com", section: "nav", viewport: "desktop", captured_at: "x", width: 1, height: 1, hash: "0".repeat(64), webp_base64: "QQ==" };
  const refused = makeCropSender({ endpoint: "https://x.test/api/public/ingest-crawl", secret: "s", runId: "r", fetchImpl: async () => new Response("no", { status: 401 }), log: () => {} });
  refused.add(cap); await refused.flush();
  assert.equal(refused.totals.failed, 1);
  let called = 0;
  const dry = makeCropSender({ endpoint: "https://x.test/api/public/ingest-crawl", secret: "s", dry: true, runId: "r", fetchImpl: async () => { called++; return new Response("{}"); } });
  dry.add(cap); await dry.flush();
  assert.equal(called, 0); assert.equal(dry.totals.stored, 1);
});

test("in the page: finds hero, nav, pricing, cta and footer bands, and nothing that is not there", async () => {
  const servers = [await serve("test/fixtures/sections", 4871), await serve("test/fixtures/plain", 4872)];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(VIEWPORTS.desktop);
    await page.goto("http://localhost:4871/");
    const found = await page.evaluate(findSectionBoxes), s = found.sections;
    assert.deepEqual(Object.keys(s).sort(), [...SECTIONS].sort());
    assert.equal(s.hero.y, 0); assert.equal(s.hero.height, VIEWPORTS.desktop.viewport.height);
    assert.equal(s.nav.y, 0); assert.ok(s.nav.height >= 48 && s.nav.height <= 200);
    assert.ok(s.pricing.y > s.hero.height && s.pricing.height >= 400);
    assert.ok(s.cta.y >= s.pricing.y + s.pricing.height - 1, "cta sits below pricing");
    assert.ok(s.footer.y >= s.cta.y + s.cta.height - 1, "footer is last");
    for (const b of Object.values(s)) { assert.equal(b.x, 0); assert.equal(b.width, found.viewport.w); assert.ok(b.y + b.height <= found.doc_h + 1); }
    // The signature reads fonts and colors, never copy.
    assert.match(s.hero.sig, /georgia\|72\|/); assert.ok(!/Ship the thing/.test(s.hero.sig));
    assert.match(s.cta.sig, /rgb\(232, 50, 14\)/);

    // End to end: every section becomes one capture inside the contract's limits.
    const sent = [];
    const done = await captureCrops(page, "fixture.test", { add: (c) => sent.push(c) }, { now: () => "2026-11-16T00:00:00.000Z" });
    assert.deepEqual(done, SECTIONS);
    for (const c of sent) {
      assert.equal(c.domain, "fixture.test"); assert.equal(c.viewport, "desktop"); assert.match(c.hash, /^[0-9a-f]{64}$/);
      assert.ok(c.width <= 1280 && c.height <= 1600);
      const buf = Buffer.from(c.webp_base64, "base64"), m = await sharp(buf).metadata();
      assert.equal(m.format, "webp"); assert.equal(m.width, c.width); assert.equal(m.height, c.height); assert.ok(buf.length <= CROP_LIMITS.storedBytes);
    }
    assert.equal(new Set(sent.map((c) => c.hash)).size, SECTIONS.length);

    await page.goto("http://localhost:4872/");
    const plain = await page.evaluate(findSectionBoxes);
    assert.deepEqual(Object.keys(plain.sections), ["hero"]);
  } finally { await browser.close(); for (const s of servers) s.close(); }
});
