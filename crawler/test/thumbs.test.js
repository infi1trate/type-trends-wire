import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { encodeThumb, captureBody, makeThumbSender, LIMITS } from "../src/thumbs.js";

// Page-like image: flat bands with a noisy "photo" block, so WebP has real work to do.
async function shot(width, height, noise = 0.3) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, photo = x < width * noise && y > height * 0.3;
    for (let c = 0; c < 3; c++) raw[i + c] = photo ? (((i + c) * 2654435761) >>> 24) : (Math.floor(y / 60) * 37 + c * 50) & 255;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
const meta = (b) => sharp(b).metadata();

test("desktop fold → full ≤1280×800 WebP ≤150 KB with 640/320 variants of the same aspect", async () => {
  const e = await encodeThumb(await shot(1440, 900));
  assert.ok(e);
  const f = await meta(e.full);
  assert.equal(f.format, "webp"); assert.equal(f.width, 1280); assert.equal(f.height, 800);
  assert.ok(e.full.length <= LIMITS.storedBytes);
  for (const w of [640, 320]) {
    const m = await meta(e[`w${w}`]);
    assert.equal(m.width, w); assert.ok(Math.abs(m.width / m.height - 1.6) < 0.03); assert.ok(e[`w${w}`].length <= LIMITS.storedBytes);
  }
});

test("pure noise steps the width down instead of failing, still under 150 KB", async () => {
  const e = await encodeThumb(await shot(1440, 900, 1));
  if (e) { const f = await meta(e.full); assert.ok(f.width < 1280); assert.ok(e.full.length <= LIMITS.storedBytes); }
});

test("mobile fold fits 800 tall and skips variants wider than itself", async () => {
  const e = await encodeThumb(await shot(390, 844));
  const f = await meta(e.full);
  assert.ok(f.height <= 800 && f.width <= 1280);
  assert.equal(e.w640, undefined);
  assert.ok(e.w320);
});

test("capture body is base64 and carries only the contract fields", async () => {
  const c = captureBody("example.com", "desktop", "2026-11-15T00:00:00.000Z", { full: Buffer.from("RIFFxxxxWEBP"), w320: Buffer.from("a") });
  assert.deepEqual(Object.keys(c), ["domain", "viewport", "captured_at", "images"]);
  assert.deepEqual(Object.keys(c.images), ["full", "w320"]);
  assert.equal(Buffer.from(c.images.full, "base64").toString(), "RIFFxxxxWEBP");
});

test("sender batches ≤12 captures per request and tallies results", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url: String(url), n: body.captures.length, auth: init.headers["x-crawl-secret"], run: body.run_id });
    return new Response(JSON.stringify({ ok: true, stored: body.captures.length - 1, rejected: 1, pruned: 0, results: [{ status: "rejected", reason: "opted_out" }] }), { status: 200 });
  };
  const s = makeThumbSender({ endpoint: "https://x.test/api/public/ingest-crawl", secret: "s", runId: "r1", fetchImpl, log: () => {} });
  const cap = { domain: "a.com", viewport: "desktop", captured_at: "2026-11-15T00:00:00Z", images: { full: "QUJD" } };
  for (let i = 0; i < 13; i++) s.add(cap);
  await s.flush();
  assert.deepEqual(calls.map((c) => c.n), [12, 1]);
  assert.equal(calls[0].url, "https://x.test/api/public/ingest-thumbs");
  assert.equal(calls[0].auth, "s"); assert.equal(calls[0].run, "r1");
  assert.equal(s.totals.stored, 11); assert.equal(s.totals.rejected, 2); assert.equal(s.totals.reasons.opted_out, 2);
});

test("sender splits by request size and does not retry a 4xx", async () => {
  let n = 0;
  const s = makeThumbSender({ endpoint: "https://x.test/api/public/ingest-crawl", secret: "s", fetchImpl: async () => { n++; return new Response("{}", { status: 403 }); }, log: () => {} });
  const big = { domain: "a.com", viewport: "desktop", captured_at: "2026-11-15T00:00:00Z", images: { full: "A".repeat(2_000_000) } };
  s.add(big); s.add(big);
  await s.flush();
  assert.equal(n, 2); assert.equal(s.totals.failed, 2);
});

test("dry run never calls the network", async () => {
  const s = makeThumbSender({ endpoint: "https://x.test/", secret: "s", dry: true, fetchImpl: async () => { throw new Error("network"); } });
  s.add({ domain: "a.com", viewport: "desktop", captured_at: "t", images: { full: "QQ" } });
  await s.flush();
  assert.equal(s.totals.stored, 1);
});
