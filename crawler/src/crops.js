// Section crops: named regions of a live homepage (hero, nav, pricing, cta, footer), kept over time by the site so
// moves and rebrands can show before/after and pattern pages can show real examples.
// Policy is the thumbnail policy: small crops only, credited and linked by the site, removable on request (server-side
// opt-outs), robots.txt honored before the page is loaded. Desktop viewport, live captures only (never archive renders).
// Contract (POST /api/public/ingest-crops, x-crawl-secret):
//   { run_id, captures: [{ domain, section, viewport: "desktop", captured_at, width (≤1280), height (≤1600),
//     hash (hex, 16–64 chars), webp_base64 (decoded ≤150 KB) }] }, 1–12 captures and ≤4 MB per request.
//   → { stored, unchanged, refused: [{ domain, section, reason }] }
// The server keeps a new version only when the hash differs from the newest stored crop of that domain + section.
import sharp from "sharp";
import { createHash } from "node:crypto";

export const SECTIONS = ["hero", "nav", "pricing", "cta", "footer"];
export const CROP_LIMITS = { maxWidth: 1280, maxHeight: 1600, storedBytes: 150 * 1024, maxCaptures: 12, requestBytes: 3_500_000, minCssHeight: 40, maxCssHeight: 1700 };
const QUALITIES = [72, 62, 52, 42, 34];

/**
 * Runs IN THE PAGE (serialized by page.evaluate; no closures). Finds the section boxes in document coordinates and a
 * small style signature per section (fonts and colors, never copy), so a real identity change makes a new version even
 * when the pixels hash the same. Returns { viewport: { w, h }, doc_h, sections: { name: { x, y, width, height, sig } } }.
 */
export function findSectionBoxes() {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const docH = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const MAX_H = 1700, MIN_H = 40;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height }; };
  const visible = (el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.width > 0 && r.height > 0;
  };
  const wide = (r) => r.width >= vw * 0.6;
  const box = (top, height) => {
    const y = Math.max(0, Math.round(top)), h = Math.round(Math.min(height, MAX_H, docH - y));
    return h >= MIN_H ? { x: 0, y, width: vw, height: h } : null;
  };
  // Fonts and colors only: heading font, size bucket and weight, text and background colors, first button's fill and radius.
  const sig = (root) => {
    const first = (sel) => [...root.querySelectorAll(sel)].find(visible);
    const h = first("h1, h2, h3"), btn = first("a[class*='btn' i], a[class*='button' i], button, [role='button']"), rs = getComputedStyle(root);
    const hs = h ? getComputedStyle(h) : null, bs = btn ? getComputedStyle(btn) : null;
    let bg = rs.backgroundColor;
    for (let el = root; el && /rgba\(0, 0, 0, 0\)|transparent/.test(bg); el = el.parentElement) bg = getComputedStyle(el).backgroundColor;
    return [
      hs ? hs.fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase() : "", hs ? Math.round(parseFloat(hs.fontSize) / 4) * 4 : 0, hs ? hs.fontWeight : "",
      hs ? hs.color : "", rs.color, bg, bs ? bs.backgroundColor : "", bs ? Math.round(parseFloat(bs.borderTopLeftRadius) || 0) : 0,
    ].join("|");
  };
  // The closest ancestor that looks like a page band: wide, and between min and max tall.
  const band = (el, min, max) => {
    for (let cur = el; cur && cur !== document.body && cur !== document.documentElement; cur = cur.parentElement) {
      const r = rect(cur);
      if (wide(r) && r.height >= min && r.height <= max) return cur;
      if (r.height > max) return null;
    }
    return null;
  };
  const out = {};
  const put = (name, el, top, height) => { const b = box(top, height); if (b) out[name] = { ...b, sig: sig(el) }; };

  // HERO: the first viewport, as a visitor sees it on arrival.
  put("hero", document.body, 0, Math.min(vh, docH));

  // NAV: the first wide header/nav at the top of the page.
  const navEl = [...document.querySelectorAll("header, nav, [role='banner'], [role='navigation']")].filter(visible).map((el) => ({ el, r: rect(el) }))
    .filter(({ r }) => r.top < 200 && wide(r) && r.height >= 32 && r.height <= 320).sort((a, b) => a.r.top - b.r.top || b.r.height - a.r.height)[0];
  if (navEl) put("nav", navEl.el, navEl.r.top, Math.max(48, Math.min(navEl.r.height, 200)));

  // FOOTER: the last footer-like element.
  const footEl = [...document.querySelectorAll("footer, [role='contentinfo']")].filter(visible).map((el) => ({ el, r: rect(el) })).filter(({ r }) => wide(r) && r.height >= 60).pop();
  const footTop = footEl ? footEl.r.top : docH;
  if (footEl) put("footer", footEl.el, footEl.r.top, footEl.r.height);

  // PRICING: a band marked as pricing, or the band around a pricing heading. Homepages without one simply have no crop.
  const PRICING = /\b(pricing|plans?( (and|&) pricing)?|choose (a|your) plan|simple pricing)\b/i;
  const marked = [...document.querySelectorAll("[id*='pricing' i], [class*='pricing' i], [data-section*='pricing' i], [aria-label*='pricing' i]")].filter(visible)
    .map((el) => ({ el, r: rect(el) })).filter(({ r }) => wide(r) && r.height >= 220 && r.height <= MAX_H * 1.5 && r.top < footTop).sort((a, b) => a.r.top - b.r.top)[0];
  let priceEl = marked ? marked.el : null;
  if (!priceEl) {
    const head = [...document.querySelectorAll("h1, h2, h3")].filter(visible).find((h) => PRICING.test((h.textContent || "").trim().slice(0, 80)) && rect(h).top > vh * 0.5 && rect(h).top < footTop);
    if (head) priceEl = band(head, 220, MAX_H * 1.5);
  }
  if (priceEl) { const r = rect(priceEl); put("pricing", priceEl, r.top, r.height); }

  // CTA: the last call-to-action band above the footer (a heading plus an action), below the first viewport.
  const ACTION = /\b(get started|start (for )?free|start (now|today|building)|sign up|try (it )?(for )?free|try [a-z]+ free|book a demo|request a demo|get a demo|contact sales|talk to sales|download|join (now|the waitlist)|create (an |your )?account|get the app)\b/i;
  const ctas = [...document.querySelectorAll("a, button, [role='button']")].filter(visible).filter((el) => ACTION.test((el.textContent || "").trim().slice(0, 60)))
    .map((el) => ({ el, top: rect(el).top })).filter(({ top }) => top > vh && top < footTop).sort((a, b) => b.top - a.top);
  for (const { el } of ctas) {
    const b = band(el, 140, 760);
    if (b && b.querySelector("h1, h2, h3") && b !== priceEl && !(priceEl && priceEl.contains(b)) && !(footEl && footEl.el.contains(b))) { const r = rect(b); put("cta", b, r.top, r.height); break; }
  }
  return { viewport: { w: vw, h: vh }, doc_h: docH, sections: out };
}

/** First WebP encoding at or under the byte cap, else null. */
async function webpUnder(img, cap) {
  for (const quality of QUALITIES) {
    const buf = await img.clone().webp({ quality, effort: 4 }).toBuffer();
    if (buf.length <= cap) return buf;
  }
  return null;
}

/** Section screenshot (PNG/JPEG buffer) → { webp, width, height } within 1280×1600 and 150 KB, stepping the width down if needed. */
export async function encodeCrop(shot) {
  for (const maxW of [CROP_LIMITS.maxWidth, 1024, 800, 640]) {
    const { data: png, info } = await sharp(shot).rotate().resize({ width: maxW, height: CROP_LIMITS.maxHeight, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const webp = await webpUnder(sharp(png), CROP_LIMITS.storedBytes);
    if (webp) return { webp, width: info.width, height: info.height };
  }
  return null;
}

/**
 * 64 hex chars: a 192-bit perceptual hash of the pixels (16×12 grid, blurred, each cell against the image mean) followed by
 * 64 bits of the style signature. The perceptual part ignores compression and sub-pixel noise; the signature part moves when
 * fonts or colors change, so an identity change is a new version even if the layout is pixel-similar.
 */
export async function cropHash(shot, sig = "") {
  const W = 16, H = 12;
  const px = await sharp(shot).rotate().greyscale().resize(W * 4, H * 4, { fit: "fill" }).blur(1.2).resize(W, H, { fit: "fill", kernel: "cubic" }).raw().toBuffer();
  let mean = 0; for (const v of px) mean += v; mean /= px.length;
  let hex = "";
  for (let i = 0; i < px.length; i += 4) {
    let nib = 0; for (let b = 0; b < 4; b++) nib = (nib << 1) | (px[i + b] > mean ? 1 : 0);
    hex += nib.toString(16);
  }
  return hex + createHash("sha256").update(String(sig)).digest("hex").slice(0, 16);
}

/** Bits that differ between the perceptual parts of two hashes (for tests and tuning). */
export function hashDistance(a, b) {
  let d = 0;
  for (let i = 0; i < 48; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
}

export const cropBody = (domain, section, captured_at, enc, hash) => ({
  domain, section, viewport: "desktop", captured_at, width: enc.width, height: enc.height, hash, webp_base64: Buffer.from(enc.webp).toString("base64"),
});

/** Clip rectangles for page.screenshot({ fullPage: true, clip }) from findSectionBoxes output; drops unknown or degenerate boxes. */
export function clipsFrom(found) {
  const out = [];
  for (const name of SECTIONS) {
    const b = found?.sections?.[name];
    if (!b || !(b.width > 0) || b.height < CROP_LIMITS.minCssHeight) continue;
    out.push({ section: name, sig: b.sig ?? "", clip: { x: 0, y: Math.max(0, Math.round(b.y)), width: Math.round(b.width), height: Math.round(Math.min(b.height, CROP_LIMITS.maxCssHeight)) } });
  }
  return out;
}

/** Captures every section found on an open desktop homepage and queues them. Returns the section names captured. Never throws. */
export async function captureCrops(page, domain, sender, { now = () => new Date().toISOString(), walked = false } = {}) {
  const done = [];
  try {
    if (!walked) {
      // Walk the page once so lazy images below the fold load before the lower sections are cropped.
      const { height } = page.viewportSize() ?? { height: 900 };
      const total = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => height);
      for (let y = height; y < Math.min(total, height * 9); y += height) { await page.evaluate((yy) => window.scrollTo(0, yy), y).catch(() => {}); await page.waitForTimeout(200); }
    }
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(walked ? 0 : 300);
    const found = await page.evaluate(findSectionBoxes);
    for (const { section, sig, clip } of clipsFrom(found)) {
      const shot = await page.screenshot({ type: "png", fullPage: true, clip }).catch(() => null);
      if (!shot) continue;
      const enc = await encodeCrop(shot);
      if (!enc) continue;
      sender.add(cropBody(domain, section, now(), enc, await cropHash(shot, sig)));
      done.push(section);
    }
  } catch { /* a page that fights screenshots just has no crops this run */ }
  return done;
}

/** Buffers crops and posts them under the server's 12-capture / 4 MB limits. Never throws. */
export function makeCropSender({ endpoint, secret, dry = false, runId, fetchImpl = fetch, log = console.log }) {
  let buf = [], bytes = 0;
  const totals = { captured: 0, stored: 0, unchanged: 0, refused: 0, failed: 0, by_section: {}, reasons: {} };
  const send = async (captures) => {
    if (dry) { totals.stored += captures.length; return; }
    const body = JSON.stringify({ run_id: runId, captures });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetchImpl(new URL("ingest-crops", endpoint), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": secret }, body }).catch(() => null);
      if (r?.ok) {
        const j = await r.json().catch(() => ({}));
        totals.stored += j.stored ?? 0; totals.unchanged += j.unchanged ?? 0;
        for (const x of j.refused ?? []) { totals.refused++; totals.reasons[x.reason] = (totals.reasons[x.reason] ?? 0) + 1; }
        return;
      }
      if (r && r.status >= 400 && r.status < 500 && r.status !== 429) { log(`crops: request refused ${r.status}`); break; }
      await new Promise((s) => setTimeout(s, attempt * 3000));
    }
    totals.failed += captures.length;
  };
  let chain = Promise.resolve();
  const flush = () => { if (!buf.length) return chain; const c = buf; buf = []; bytes = 0; chain = chain.then(() => send(c)); return chain; };
  return {
    totals,
    add(capture) {
      const size = capture.webp_base64.length + 300;
      if (buf.length && (buf.length >= CROP_LIMITS.maxCaptures || bytes + size > CROP_LIMITS.requestBytes)) flush();
      buf.push(capture); bytes += size;
      totals.captured++; totals.by_section[capture.section] = (totals.by_section[capture.section] ?? 0) + 1;
      return chain;
    },
    flush,
  };
}
