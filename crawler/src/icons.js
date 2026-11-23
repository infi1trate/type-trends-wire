// W3d · App icons as measured colour only.
// Reads Apple's public chart of top free apps (US store) per category, fetches each icon once in memory, measures its palette
// with the same method as brand homepages and museum works, and sends only the measured colours with the app's name, maker and
// App Store link to the site (POST /api/public/ingest-icons, one post per category).
//
// No icon picture is stored, sent or written to disk: Apple's Search API terms allow app icons only to promote store content,
// so the site keeps numbers, names and links. Every app the site names links to its App Store page.
//
// Env: CRAWL_ENDPOINT (the site's ingest address; the icons endpoint sits beside it), CRAWL_SECRET, DRY_RUN=1 (read and print,
// send nothing), ICON_GENRES (comma-separated genre names, default all), ICON_LIMIT (apps per category, default 100).
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { gateFor } from "./gate.js";
import { paletteFromScreenshot } from "./color.js";

export const AGENT = "slug.global design-trend newsroom (app icon colours; measured numbers only, no pictures kept)";
export const STORE = "us", CHART = "top-free";
/** The App Store's category ids (genres) the study reads. */
export const GENRES = {
  Finance: 6015, "Health & Fitness": 6013, Shopping: 6024, Productivity: 6007, "Food & Drink": 6023, Travel: 6003, News: 6009,
  Entertainment: 6016, Education: 6017, "Social Networking": 6005, Business: 6000, Lifestyle: 6012, Medical: 6020, Music: 6011,
  Utilities: 6002, "Photo & Video": 6008, Games: 6014, "Developer Tools": 6026,
};
export const ICON_LIMITS = { perGenre: 100, palette: 8, name: 120, maker: 120, link: 300, requestBytes: 256 * 1024 };
export const feedUrl = (genreId, limit = ICON_LIMITS.perGenre) => `https://itunes.apple.com/${STORE}/rss/topfreeapplications/limit=${limit}/genre=${genreId}/json`;

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** Pure: the App Store page of an app, without tracking parameters; null unless it is https on apps.apple.com. */
export function storeLink(href) {
  try { const u = new URL(String(href)); if (u.protocol !== "https:" || u.hostname !== "apps.apple.com") return null; u.search = ""; u.hash = ""; const s = u.toString(); return s.length <= ICON_LIMITS.link ? s : null; } catch { return null; }
}
/** Pure: one chart entry as the row the site takes (without its palette) plus the icon's address, or null when a field is missing. */
export function appOf(entry, rank) {
  const id = String(entry?.id?.attributes?.["im:id"] ?? "").trim(), name = clip(entry?.["im:name"]?.label, ICON_LIMITS.name), maker = clip(entry?.["im:artist"]?.label, ICON_LIMITS.maker);
  const link = storeLink(entry?.id?.label ?? (Array.isArray(entry?.link) ? entry.link[0]?.attributes?.href : entry?.link?.attributes?.href));
  const images = Array.isArray(entry?.["im:image"]) ? entry["im:image"] : [], icon = images.length ? String(images[images.length - 1]?.label ?? "") : "";
  if (!/^\d{1,20}$/.test(id) || !name || !maker || !link || !/^https:\/\/[a-z0-9.-]+\.mzstatic\.com\//i.test(icon)) return null;
  return { row: { rank, app_id: id, name, maker, link }, icon };
}
/** Pure: the chart's entries as rows in chart order (rank is the place in the chart, counted from 1). */
export function appsOf(feed, limit = ICON_LIMITS.perGenre) {
  const e = feed?.feed?.entry, list = Array.isArray(e) ? e : e ? [e] : [];
  return list.slice(0, limit).map((x, i) => appOf(x, i + 1)).filter(Boolean);
}
/** Pure: a palette as the site takes it: at most eight colours, largest first, shares as measured and never adding past 1. */
export function paletteOf(palette) {
  const out = [...(palette ?? [])].filter(c => /^#[0-9A-Fa-f]{6}$/.test(String(c?.hex)) && Number.isFinite(c?.share) && c.share > 0)
    .sort((a, b) => b.share - a.share).slice(0, ICON_LIMITS.palette).map(c => ({ hex: String(c.hex).toUpperCase(), share: Math.round(c.share * 1e4) / 1e4 }));
  let sum = 0; const kept = [];
  for (const c of out) { if (sum + c.share > 1.0005) break; sum += c.share; kept.push(c); }
  return kept;
}
/** The icon's measured palette (the homepage method), from the picture's bytes. The picture itself is dropped. */
export async function measureIcon(buf) {
  const png = await sharp(buf).flatten({ background: "#ffffff" }).png().toBuffer().catch(() => null);
  if (!png) return null;
  const { palette } = await paletteFromScreenshot(png, null, 12);
  const p = paletteOf(palette);
  return p.length ? p : null;
}
/** Pure: the request body for one category. */
export const bodyOf = (runId, day, genre, apps) => ({ run_id: runId, store: STORE, chart: CHART, day, genre, apps });

async function get(url, as = "json") {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(25_000) }).catch(() => null);
    if (r?.ok) return as === "json" ? r.json().catch(() => null) : Buffer.from(await r.arrayBuffer());
    if (r && r.status === 404) return null;
    await new Promise(s => setTimeout(s, attempt * 1500));
  }
  return null;
}

async function main() {
  const dry = process.env.DRY_RUN === "1", secret = process.env.CRAWL_SECRET, endpoint = process.env.CRAWL_ENDPOINT || "https://slug.global/api/public/ingest-crawl";
  if (!secret && !dry) { console.error("CRAWL_SECRET is not set"); process.exit(2); }
  const want = String(process.env.ICON_GENRES || "").split(",").map(s => s.trim()).filter(Boolean);
  const limit = Math.max(1, Math.min(ICON_LIMITS.perGenre, Number(process.env.ICON_LIMIT) || ICON_LIMITS.perGenre));
  const day = new Date().toISOString().slice(0, 10), runId = `icons-${day}-${Math.random().toString(36).slice(2, 6)}`;
  const ready = dry ? async () => {} : () => gateFor(endpoint)();
  const totals = { categories: 0, read: 0, unreadable: 0, stored: 0, unchanged: 0, refused: 0, failed: 0, reasons: {} };
  for (const [name, id] of Object.entries(GENRES)) {
    if (want.length && !want.includes(name)) continue;
    const feed = await get(feedUrl(id, limit));
    const entries = appsOf(feed, limit);
    if (!entries.length) { console.log(`${name}: the chart could not be read`); continue; }
    const apps = []; let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < entries.length) {
        const e = entries[next++], buf = await get(e.icon, "bytes"), palette = buf && buf.length > 200 && buf.length < 2_000_000 ? await measureIcon(buf).catch(() => null) : null;
        if (palette) apps.push({ ...e.row, palette }); else totals.unreadable++;
      }
    }));
    apps.sort((a, b) => a.rank - b.rank);
    totals.categories++; totals.read += apps.length;
    const body = JSON.stringify(bodyOf(runId, day, { id, name }, apps));
    const top = {}; for (const a of apps) top[a.palette[0].hex] = (top[a.palette[0].hex] ?? 0) + 1;
    console.log(`${name}: ${apps.length} of ${entries.length} icons measured, ${Object.keys(top).length} different grounds, ${body.length} bytes`);
    if (dry) continue;
    if (body.length > ICON_LIMITS.requestBytes) { console.log(`${name}: the request is over ${ICON_LIMITS.requestBytes} bytes, not sent`); totals.failed += apps.length; continue; }
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      if (!(await ready().then(() => true, e => (console.log(String(e?.message ?? e)), false)))) break;   // gate.js: ask the site first
      const r = await fetch(new URL("ingest-icons", endpoint), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": secret }, body, signal: AbortSignal.timeout(60_000) }).catch(() => null);
      if (r?.ok) {
        const j = await r.json().catch(() => ({}));
        totals.stored += j.stored ?? 0; totals.unchanged += j.unchanged ?? 0;
        for (const x of j.refused ?? []) { totals.refused++; totals.reasons[x.reason] = (totals.reasons[x.reason] ?? 0) + 1; }
        done = true;
      } else if (r && r.status >= 400 && r.status < 500 && r.status !== 429) { console.log(`${name}: request refused ${r.status}`); break; }
      else await new Promise(s => setTimeout(s, attempt * 4000));
    }
    if (!done) totals.failed += apps.length;
    await new Promise(s => setTimeout(s, 3000));   // a gap between categories: eighteen small posts, never a burst
  }
  console.log(`done ${JSON.stringify({ run_id: runId, day, dry, ...totals })}`);
  if (!dry && totals.failed && !totals.stored && !totals.unchanged) process.exit(1);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch(e => { console.error(String(e?.message ?? e)); process.exit(1); });
