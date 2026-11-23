// Digest thumbnails: small above-the-fold crops of library homepages, sent to /api/public/ingest-thumbs.
// Policy (owner-approved): small crops only, credited and linked by the site, removable on request (server-side opt-outs).
// Contract: x-crawl-secret auth; { run_id?, captures: [{ domain, viewport, captured_at, images: { full, w640?, w320? } }] }
// base64 WebP; full ≤1280×800 and ≤150 KB, variants ≤640/≤320 wide with the same aspect; ≤12 captures and ≤4 MB per request.
import sharp from "sharp";
import { gateFor } from "./gate.js";

export const LIMITS = { maxWidth: 1280, maxHeight: 800, storedBytes: 150 * 1024, variants: [640, 320], maxCaptures: 12, requestBytes: 3_500_000 };
const QUALITIES = [72, 62, 52, 42, 34];

/** Smallest-quality-first fallback: the first WebP encoding at or under the byte cap, else null. */
async function webpUnder(img, cap) {
  for (const quality of QUALITIES) {
    const buf = await img.clone().webp({ quality, effort: 4 }).toBuffer();
    if (buf.length <= cap) return buf;
  }
  return null;
}

/**
 * Fold screenshot (PNG/JPEG buffer of the visible viewport) → { full, w640?, w320? } WebP buffers + dims.
 * Downscales to fit 1280×800 (stepping down to 1024/800 wide if needed for 150 KB); variants only when narrower than the full image.
 */
export async function encodeThumb(shot) {
  // Busy pages may not fit 150 KB at 1280 wide even at low quality: step the width down rather than ship mush.
  for (const maxW of [LIMITS.maxWidth, 1024, 800]) {
    const { data: png, info } = await sharp(shot).rotate().resize({ width: maxW, height: LIMITS.maxHeight, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const full = await webpUnder(sharp(png), LIMITS.storedBytes);
    if (!full) continue;
    const out = { width: info.width, height: info.height, full };
    for (const w of LIMITS.variants) {
      if (w >= info.width) continue;
      const v = await webpUnder(sharp(png).resize({ width: w }), LIMITS.storedBytes);
      if (v) out[`w${w}`] = v;
    }
    return out;
  }
  return null;
}

const b64 = (buf) => Buffer.from(buf).toString("base64");
export const captureBody = (domain, viewport, captured_at, enc) => ({
  domain, viewport, captured_at,
  images: { full: b64(enc.full), ...(enc.w640 ? { w640: b64(enc.w640) } : {}), ...(enc.w320 ? { w320: b64(enc.w320) } : {}) },
});
const captureSize = (c) => c.images.full.length + (c.images.w640?.length ?? 0) + (c.images.w320?.length ?? 0) + 200;

/** Buffers captures and posts them in requests under the server's 12-capture / 4 MB limits. Never throws. */
export function makeThumbSender({ endpoint, secret, dry = false, runId, fetchImpl = fetch, log = console.log }) {
  const ready = dry || fetchImpl !== fetch ? async () => {} : () => gateFor(endpoint)();
  let buf = [], bytes = 0;
  const totals = { stored: 0, rejected: 0, pruned: 0, failed: 0, reasons: {} };
  const send = async (captures) => {
    if (dry) { totals.stored += captures.length; return; }
    const body = JSON.stringify({ run_id: runId, captures });
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!(await ready().then(() => true, e => (log(String(e?.message ?? e)), false)))) break;   // gate.js: ask the site first
      const r = await fetchImpl(new URL("ingest-thumbs", endpoint), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": secret }, body }).catch(() => null);
      if (r?.ok) {
        const j = await r.json().catch(() => ({}));
        totals.stored += j.stored ?? 0; totals.rejected += j.rejected ?? 0; totals.pruned += j.pruned ?? 0;
        for (const x of j.results ?? []) if (x.status === "rejected") totals.reasons[x.reason] = (totals.reasons[x.reason] ?? 0) + 1;
        return;
      }
      if (r && r.status >= 400 && r.status < 500 && r.status !== 429) { log(`thumbs: request refused ${r.status}`); break; }
      await new Promise((s) => setTimeout(s, attempt * 3000));
    }
    totals.failed += captures.length;
  };
  let chain = Promise.resolve();
  const flush = () => { if (!buf.length) return chain; const c = buf; buf = []; bytes = 0; chain = chain.then(() => send(c)); return chain; };
  return {
    totals,
    add(capture) {
      const size = captureSize(capture);
      if (buf.length && (buf.length >= LIMITS.maxCaptures || bytes + size > LIMITS.requestBytes)) flush();
      buf.push(capture); bytes += size;
      return chain;
    },
    flush,
  };
}
