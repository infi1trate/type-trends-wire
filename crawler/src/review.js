// The page review: opens slug's own pages in a browser at three widths, measures them, and sends each measurement (with a small picture)
// through the site's door as the design review or engineering desk. The product cannot look at its own pages; this job does, and the
// product's budgets, design review and release gate read what it sends. It measures the live site, never the preview.
//
// One call per page and width: POST /api/public/desk {actor, action:"review", run, kind, page, path, width, against?, measures, picture?}.
// Live text (clocks, "12 minutes ago") is hidden before measuring, so two runs of unchanged code compare as unchanged.
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const WIDTHS = [1440, 768, 390];
export const KINDS = ["weekly", "before", "after", "test"];
export const ACTORS = ["design review", "engineering"];
export const PICTURE = { maxWidth: 1280, maxHeight: 1600, maxBytes: 150_000 }; // the door takes the top of the page: at most 1280 × 1600 and 150 KB
export const FIRST_BYTE_LOADS = 3;
export const COMPARE_WIDTH = 720, COMPARE_MAX_HEIGHT = 12_000, PIXEL_TOLERANCE = 24;
/** The pages the product reviews; `story` is resolved from the front page's own feed at run time. */
export const PAGES = [
  { page: "front", path: "/" },
  { page: "story", path: null },
  { page: "brand", path: "/brands/netlify.com" },
  { page: "study", path: "/data/which-sector-changes-its-mind" },
  { page: "terminal", path: "/terminal" },
  { page: "digest", path: "/digest" },
  { page: "studies", path: "/data" },
  { page: "brands", path: "/brands" },
  { page: "signals", path: "/signals" },
];

/** Pure: the ISO week name of a date, e.g. 2026-W47 (the weekly run's name). */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), week = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
/** Pure: the run's settings from the environment, or the reason it cannot start. */
export function settings(env, now = new Date()) {
  const kind = String(env.KIND || "weekly").trim().toLowerCase();
  if (!KINDS.includes(kind)) return { error: `kind must be one of ${KINDS.join(", ")}` };
  const actor = String(env.ACTOR || (kind === "weekly" || kind === "test" ? "design review" : "engineering")).trim().toLowerCase();
  if (!ACTORS.includes(actor)) return { error: `actor must be one of ${ACTORS.join(", ")}` };
  const run = String(env.RUN || (kind === "weekly" ? isoWeek(now) : "")).trim();
  if (!/^[A-Za-z0-9 ._:-]{1,40}$/.test(run)) return { error: "run needs a name of 1 to 40 letters, digits, spaces or . _ : -" };
  const against = String(env.AGAINST || "").trim();
  if (against && !/^[A-Za-z0-9 ._:-]{1,40}$/.test(against)) return { error: "against is not a run name" };
  if (against && against === run) return { error: "a run cannot be compared with itself" };
  const base = String(env.REVIEW_BASE || "https://slug.global").replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/.test(base)) return { error: "REVIEW_BASE must be an https origin" };
  return { kind, actor, run, against: against || null, base, dry: env.DRY_RUN === "1" };
}
/** Pure: the newest story's path from the front page's feed (its lead, else its first item). */
export function storyPath(front) {
  const id = front?.lead?.id ?? front?.items?.[0]?.id;
  return typeof id === "string" && id.length > 2 && id.length < 200 ? `/stories/${encodeURIComponent(id)}` : null;
}
/** Pure: the share of pixels that differ between two raw RGB pictures of the same width; rows only one of them has count as changed. */
export function changedShare(a, b, width, tolerance = PIXEL_TOLERANCE) {
  const rowsA = a.length / (width * 3), rowsB = b.length / (width * 3), rows = Math.min(rowsA, rowsB), most = Math.max(rowsA, rowsB);
  if (!most) return 0;
  let diff = 0;
  for (let i = 0, n = rows * width * 3; i < n; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > tolerance) diff++;
  return (diff + (most - rows) * width) / (most * width);
}
/** Pure: the measures the door accepts, from what the browser reported (a value that was not measured is left out, never sent as zero). */
export function measuresOf(m, extra = {}) {
  const out = {}, int = k => { if (Number.isFinite(m[k])) out[k] = Math.max(0, Math.round(m[k])); }, num = (k, dp) => { if (Number.isFinite(m[k])) out[k] = Math.round(m[k] * 10 ** dp) / 10 ** dp; };
  for (const k of ["height_px", "words", "links", "images", "small_targets", "low_contrast", "h1", "headings", "console_errors", "failed_requests"]) int(k);
  num("image_kb", 1); num("first_byte_ms", 0); num("lcp_ms", 0); num("cls", 3);
  if (typeof m.overflow_x === "boolean") out.overflow_x = m.overflow_x;
  if (Number.isFinite(extra.changed_share)) out.changed_share = Math.min(1, Math.max(0, Math.round(extra.changed_share * 1e4) / 1e4));
  return out;
}
/** Pure: the middle value of the numbers that were measured (the lower middle of an even count); NaN when none was. */
export function middle(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : NaN;
}
/** Pure: only the door's verdict, never the body it echoed. */
export function verdict(status, text) {
  let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
  const say = j && typeof j === "object" ? ["ok", "error", "reason", "status"].filter(k => typeof j[k] !== "object" && j[k] !== undefined).map(k => `${k}=${String(j[k]).slice(0, 120)}`).join(" ") : "";
  return `${status}${say ? ` ${say}` : ""}`;
}

/** In the page: hide text that changes by the minute, so it is neither counted nor drawn. */
function hideLiveText() {
  const live = /(\b\d{1,2}:\d{2}(:\d{2})?\b)|(\b\d+\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hrs?|hours?)\s+ago\b)|(\bjust now\b)|(\bchecked\b.*\bago\b)/i;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const s = t.nodeValue || "";
    if (s.length < 200 && live.test(s) && t.parentElement) { t.parentElement.style.visibility = "hidden"; n++; }
  }
  for (const el of document.querySelectorAll("time,[data-live],[aria-live]")) { el.style.visibility = "hidden"; n++; }
  return n;
}
/** In the page: what can be counted from the document. */
function measureDocument() {
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const rgb = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(",").map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ground = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage && s.backgroundImage !== "none") return null; const c = rgb(s.backgroundColor); if (c && c.a >= 0.99) return c; if (c && c.a > 0.01) return null; } return { r: 255, g: 255, b: 255, a: 1 }; };
  let low = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!el || seen.has(el) || !(t.nodeValue || "").trim() || !visible(el)) continue;
    seen.add(el);
    const s = getComputedStyle(el), fg = rgb(s.color), bg = ground(el);
    if (!fg || fg.a < 0.99 || !bg || parseFloat(s.opacity) < 0.99) continue;
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    if (ratio < (large ? 3 : 4.5)) low++;
  }
  const targets = [...document.querySelectorAll("a[href],button,[role=button],input,select,summary")].filter(visible);
  const small = targets.filter(el => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 24; }).length;
  const nav = performance.getEntriesByType("navigation")[0];
  const imgs = performance.getEntriesByType("resource").filter(r => r.initiatorType === "img" || /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(r.name));
  const doc = document.documentElement;
  return {
    height_px: doc.scrollHeight,
    words: (document.body.innerText || "").split(/\s+/).filter(Boolean).length,
    links: document.querySelectorAll("a[href]").length,
    images: document.images.length,
    image_kb: imgs.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) / 1024,
    first_byte_ms: nav ? nav.responseStart - nav.requestStart : NaN,
    lcp_ms: window.__lcp ?? NaN,
    cls: window.__cls ?? NaN,
    overflow_x: doc.scrollWidth > window.innerWidth + 1,
    small_targets: small,
    low_contrast: low,
    h1: document.querySelectorAll("h1").length,
    headings: document.querySelectorAll("h1,h2,h3,h4").length,
  };
}
/** The browser name every load of the review uses: a reader's browser, with the review named at the end. */
export const BROWSER_NAME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 slug-review/1";
const OBSERVE = `(() => { window.__cls = 0; try {
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
} catch {} })();`;

async function shoot(browser, base, p, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: process.env.REVIEW_INSECURE === "1", userAgent: BROWSER_NAME });
  await ctx.addInitScript(OBSERVE);
  const page = await ctx.newPage();
  let consoleErrors = 0, failed = 0;
  page.on("console", m => { if (m.type() === "error") consoleErrors++; });
  page.on("pageerror", () => { consoleErrors++; });
  page.on("requestfailed", () => { failed++; });
  page.on("response", r => { if (r.status() >= 400) failed++; });
  try {
    await page.goto(base + p.path, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => page.waitForLoadState("load", { timeout: 20_000 }).catch(() => null));
    await page.waitForTimeout(1500);
    // Walk the whole page once so every lazy picture loads, then return to the top and let the network settle.
    await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 110)); } window.scrollTo(0, 0); }).catch(() => null);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
    // A lazy picture the walk passed too quickly never starts loading, and the full-page picture then shows an empty box where a
    // reader would see the picture. Every picture is asked for now and waited for (up to 8 s each), so two runs of the same page
    // match. This changes nothing a reader sees.
    await page.evaluate(() => Promise.all([...document.images].map(async i => {
      if (!(i.complete && i.naturalWidth > 0)) { i.loading = "eager"; await new Promise(r => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); setTimeout(r, 8000); if (i.complete) r(); }); }
      await Promise.race([i.decode().catch(() => null), new Promise(r => setTimeout(r, 4000))]); // loaded is not yet drawn: wait for the decode too
    }))).catch(() => null);
    await page.waitForTimeout(500);
    await page.evaluate(hideLiveText).catch(() => 0);
    const m = await page.evaluate(measureDocument);
    const png = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
    return { m: { ...m, console_errors: consoleErrors, failed_requests: failed }, png };
  } finally { await ctx.close().catch(() => null); }
}
/** A bare load of the page that reads only its first byte (request sent to first response byte), in a fresh context. */
async function firstByte(browser, base, p, width) {
  // The same browser name as the measured load. Without one the browser calls itself headless, the site takes it for a
  // crawler and sends the whole page at once, which is slower to its first byte than what a reader's browser gets.
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: process.env.REVIEW_INSECURE === "1", userAgent: BROWSER_NAME });
  try {
    const page = await ctx.newPage();
    await page.goto(base + p.path, { waitUntil: "commit", timeout: 30_000 });
    return await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? n.responseStart - n.requestStart : NaN; });
  } finally { await ctx.close().catch(() => null); }
}
export async function picture(png) {
  const meta = await sharp(png).metadata(), w = meta.width || PICTURE.maxWidth, h = meta.height || PICTURE.maxHeight;
  for (const width of [Math.min(w, PICTURE.maxWidth), 1024, 800, 640].filter((x, i, a) => x <= w && a.indexOf(x) === i)) {
    const scale = width / w, height = Math.min(PICTURE.maxHeight, Math.floor(h * scale));
    // The top of the page, scaled to the width, never taller than the limit.
    const img = sharp(png).extract({ left: 0, top: 0, width: w, height: Math.min(h, Math.ceil(height / scale)) }).resize({ width, height, fit: "fill" });
    for (const quality of [72, 60, 48, 36]) { const buf = await img.clone().webp({ quality, effort: 4 }).toBuffer(); if (buf.length <= PICTURE.maxBytes) return buf; }
  }
  return null;
}
async function compareRaw(png) {
  const meta = await sharp(png).metadata(), scaled = Math.round((meta.height || 0) * COMPARE_WIDTH / (meta.width || COMPARE_WIDTH));
  const img = sharp(png).resize({ width: COMPARE_WIDTH });
  const cut = scaled > COMPARE_MAX_HEIGHT ? img.extract({ left: 0, top: 0, width: COMPARE_WIDTH, height: COMPARE_MAX_HEIGHT }) : img;
  return cut.removeAlpha().raw().toBuffer();
}

async function main() {
  const s = settings(process.env);
  if (s.error) { console.error(`refused before starting: ${s.error}`); process.exit(2); }
  const key = process.env.CRAWL_SECRET;
  if (!key && !s.dry) { console.error("CRAWL_SECRET is not set"); process.exit(2); }
  const dir = path.join(".cache", "review"), mine = path.join(dir, s.run), theirs = s.against ? path.join(dir, s.against) : null;
  fs.mkdirSync(mine, { recursive: true });
  // Keep the compare pictures of the six newest runs (this one and the one it is compared with are always kept).
  const old = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== s.run && d.name !== s.against).map(d => ({ name: d.name, at: fs.statSync(path.join(dir, d.name)).mtimeMs })).sort((a, b) => b.at - a.at).slice(4);
  for (const d of old) fs.rmSync(path.join(dir, d.name), { recursive: true, force: true });
  const front = await fetch(`${s.base}/front.json`, { signal: AbortSignal.timeout(30_000) }).then(r => r.json()).catch(() => null);
  const only = String(process.env.REVIEW_ONLY || "").split(",").map(x => x.trim()).filter(Boolean); // a local check of a few pages; a real run sends all nine
  const pages = PAGES.map(p => (p.page === "story" ? { ...p, path: storyPath(front) } : p)).filter(p => !only.length || only.includes(p.page));
  // A local run behind a proxy sets REVIEW_PROXY (and REVIEW_INSECURE=1 for its certificate); the scheduled job sets neither.
  const proxy = process.env.REVIEW_PROXY ? { server: process.env.REVIEW_PROXY } : undefined, insecure = process.env.REVIEW_INSECURE === "1";
  const browser = await chromium.launch({ headless: true, proxy, args: insecure ? ["--ignore-certificate-errors"] : [] });
  let sent = 0, refused = 0, skipped = 0;
  try {
    for (const p of pages) {
      if (!p.path) { console.log(`${p.page}: no address found, skipped`); skipped += WIDTHS.length; continue; }
      for (const width of WIDTHS) {
        let shot = null;
        try {
          shot = await shoot(browser, s.base, p, width);
          // One load can meet a cold start. First byte is the middle of three loads, so a single slow or lucky one decides nothing.
          const more = [];
          for (let i = 0; i < FIRST_BYTE_LOADS - 1; i++) more.push(await firstByte(browser, s.base, p, width).catch(() => NaN));
          shot.m.first_byte_ms = middle([shot.m.first_byte_ms, ...more]);
        } catch (e) { console.log(`${p.page} ${width}: could not be opened (${String(e?.message ?? e).slice(0, 80)})`); skipped++; continue; }
        const raw = await compareRaw(shot.png), file = `${p.page}-${width}.png`;
        await sharp(raw, { raw: { width: COMPARE_WIDTH, height: raw.length / (COMPARE_WIDTH * 3), channels: 3 } }).png({ compressionLevel: 9 }).toFile(path.join(mine, file));
        let share = NaN;
        if (theirs && fs.existsSync(path.join(theirs, file))) share = changedShare(await sharp(path.join(theirs, file)).removeAlpha().raw().toBuffer(), raw, COMPARE_WIDTH);
        const webp = await picture(shot.png);
        const body = { actor: s.actor, action: "review", run: s.run, kind: s.kind, page: p.page, path: p.path, width, ...(s.against && Number.isFinite(share) ? { against: s.against } : {}), measures: measuresOf(shot.m, { changed_share: share }), ...(webp ? { picture: webp.toString("base64") } : {}) };
        const line = `${p.page} ${width}: ${body.measures.height_px} px, ${body.measures.words} words, first byte ${body.measures.first_byte_ms ?? "?"} ms${Number.isFinite(share) ? `, ${(share * 100).toFixed(2)}% changed` : ""}`;
        if (s.dry) { console.log(`${line} (dry run, not sent)`); continue; }
        const res = await fetch(`${s.base}/api/public/desk`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) }).catch(e => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }));
        const text = await res.text();
        if (res.ok) sent++; else refused++;
        console.log(`${line} → ${verdict(res.status, text)}`);
        await new Promise(r => setTimeout(r, 2300)); // the door allows 30 calls a minute
      }
    }
  } finally { await browser.close().catch(() => null); }
  console.log(`run ${s.run} (${s.kind}) as ${s.actor}: ${sent} sent, ${refused} refused, ${skipped} skipped${s.against ? `, compared with ${s.against}` : ""}`);
  fs.writeFileSync(path.join(dir, "last-run.json"), JSON.stringify({ run: s.run, kind: s.kind, sent, refused, skipped }));
  if (!s.dry && (refused > 0 || sent === 0)) process.exit(1);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch(e => { console.error(String(e?.message ?? e).slice(0, 200)); process.exit(1); });
