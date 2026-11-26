// M2 · The App Store shop window, as measured facts.
// Reads the same public charts as the icon reading (top free apps, US store, eighteen categories), then asks Apple's public lookup
// for each chart's apps in ONE request per category (ids batched), and sends what a listing says about itself: version and its
// date, the "What's New" note, the opening of the description with its length, price, category, rating, size, languages, the
// maker's website, and how many screenshots it shows in which orientation. The first two screenshots are fetched once in memory
// and measured for colour with the homepage method.
//
// No picture is stored, sent or written to disk (Apple's terms allow listing artwork only to promote store content): the site
// gets numbers, short text and the App Store link. Text is cut short here (LISTING_LIMITS) and every app the site names links
// to its App Store page.
//
// Manners: one chart read and one lookup per category, LOOKUP_GAP_MS apart (Apple asks for about 20 calls a minute at most).
//
// Env: CRAWL_ENDPOINT, CRAWL_SECRET, DRY_RUN=1 (read and print, send nothing), LISTING_GENRES (comma-separated names, default
// all), LISTING_LIMIT (apps per category, default 100), LISTING_SHOTS (screenshots measured per app, 0-2, default 2),
// LISTINGS_OUT (a folder: dry runs write the rows there as JSON lines, for reading by hand).
import { pathToFileURL } from "node:url";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { gateFor } from "./gate.js";
import { GENRES, STORE, CHART, feedUrl, appsOf, measureIcon } from "./icons.js";

export const AGENT = "slug.global design-trend newsroom (app listings; measured facts and short text, no pictures kept)";
export const LISTING_LIMITS = {
  perGenre: 100, perPost: 25, requestBytes: 256 * 1024, notes: 800, about: 600, version: 40, genre: 60, minOs: 12, age: 8, site: 120, shots: 2,
};
export const LOOKUP_GAP_MS = 3500;
export const lookupUrl = (ids) => `https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${STORE}&entity=software`;

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const iso = (s) => { const t = Date.parse(String(s ?? "")); return Number.isFinite(t) && t > Date.parse("2008-01-01") && t < Date.now() + 864e5 ? new Date(t).toISOString() : null; };
const count = (n, max) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.min(max, Math.round(Number(n))) : null);

/** Pure: the maker's website as a bare host (no path, no "www."), or null. Only http(s) addresses with a dotted host count. */
export function siteOf(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) && h.length <= LISTING_LIMITS.site ? h : null;
  } catch { return null; }
}
/** Pure: width and height Apple's picture address says the screenshot has (".../392x696bb.jpg"), or null. */
export function shotSize(url) {
  const m = /\/(\d{2,5})x(\d{2,5})[a-z]{0,3}\.(?:jpe?g|png|webp)$/i.exec(String(url ?? ""));
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}
/** Pure: how a listing shows itself: how many screenshots per device, and which way up the phone ones are. */
export function shotFacts(r) {
  const list = (k) => (Array.isArray(r?.[k]) ? r[k].filter(u => /^https:\/\/[a-z0-9.-]+\.mzstatic\.com\//i.test(String(u))) : []);
  const phone = list("screenshotUrls"), pad = list("ipadScreenshotUrls"), tv = list("appletvScreenshotUrls");
  const lead = phone.length ? phone : pad, ways = new Set(lead.map(shotSize).filter(Boolean).map(s => (s.w > s.h ? "landscape" : "portrait")));
  return { facts: { phone: phone.length, pad: pad.length, tv: tv.length, way: ways.size === 1 ? [...ways][0] : ways.size > 1 ? "mixed" : null }, lead };
}
/** Pure: one lookup result joined to its chart row, as the row the site takes (without screenshot colours); null when it is not that app. */
export function listingOf(r, row) {
  if (!r || String(r.trackId) !== String(row?.app_id) || (r.kind && r.kind !== "software")) return null;
  const notes = String(r.releaseNotes ?? ""), about = String(r.description ?? ""), price = Number(r.price);
  const rating = Number(r.averageUserRating), size = Number(r.fileSizeBytes);
  return {
    ...row,
    genre: clip(r.primaryGenreName, LISTING_LIMITS.genre) || null,
    price: Number.isFinite(price) && price >= 0 && price < 10_000 ? Math.round(price * 100) / 100 : null,
    currency: /^[A-Z]{3}$/.test(String(r.currency)) ? String(r.currency) : null,
    version: clip(r.version, LISTING_LIMITS.version) || null,
    version_at: iso(r.currentVersionReleaseDate), first_at: iso(r.releaseDate),
    notes: clip(notes, LISTING_LIMITS.notes) || null, notes_chars: notes.trim().length,
    about: clip(about, LISTING_LIMITS.about) || null, about_chars: about.trim().length, about_words: about.trim() ? about.trim().split(/\s+/).length : 0,
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? Math.round(rating * 100) / 100 : null,
    ratings: count(r.userRatingCount, 2_000_000_000),
    size_mb: Number.isFinite(size) && size > 0 ? Math.round(size / 1048576 * 10) / 10 : null,
    min_os: clip(r.minimumOsVersion, LISTING_LIMITS.minOs) || null,
    languages: Array.isArray(r.languageCodesISO2A) ? Math.min(400, r.languageCodesISO2A.length) : null,
    age: clip(r.contentAdvisoryRating ?? r.trackContentRating, LISTING_LIMITS.age) || null,
    site: siteOf(r.sellerUrl),
    shots: shotFacts(r).facts,
  };
}
/** Pure: rows cut into posts of at most `n`. */
export const chunks = (rows, n = LISTING_LIMITS.perPost) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));
/** Pure: the request body for one part of one category. */
export const bodyOf = (runId, day, genre, part, parts, apps) => ({ run_id: runId, store: STORE, chart: CHART, day, genre, part, parts, apps });
/** Pure: what an answer from the site's listings endpoint means. A site that has no such endpoint yet is not a failure. */
export function answerOf(status) {
  if (status >= 200 && status < 300) return "stored";
  if (status === 404 || status === 405) return "not-taken";
  if (status === 429 || status >= 500 || status === 0) return "later";
  return "refused";
}

async function get(url, as = "json") {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(25_000) }).catch(() => null);
    if (r?.ok) return as === "json" ? r.json().catch(() => null) : Buffer.from(await r.arrayBuffer());
    if (r && r.status === 404) return null;
    await new Promise(s => setTimeout(s, attempt * 2500));
  }
  return null;
}

async function main() {
  const dry = process.env.DRY_RUN === "1", secret = process.env.CRAWL_SECRET, endpoint = process.env.CRAWL_ENDPOINT || "https://slug.global/api/public/ingest-crawl";
  if (!secret && !dry) { console.error("CRAWL_SECRET is not set"); process.exit(2); }
  const want = String(process.env.LISTING_GENRES || "").split(",").map(s => s.trim()).filter(Boolean);
  const limit = Math.max(1, Math.min(LISTING_LIMITS.perGenre, Number(process.env.LISTING_LIMIT) || LISTING_LIMITS.perGenre));
  const shotsWanted = Math.max(0, Math.min(LISTING_LIMITS.shots, process.env.LISTING_SHOTS === undefined || process.env.LISTING_SHOTS === "" ? LISTING_LIMITS.shots : Number(process.env.LISTING_SHOTS) || 0));
  const outDir = dry && process.env.LISTINGS_OUT ? process.env.LISTINGS_OUT : null;
  if (outDir) await mkdir(outDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10), runId = `listings-${day}-${Math.random().toString(36).slice(2, 6)}`;
  const ready = dry ? async () => {} : () => gateFor(endpoint)();
  const totals = { categories: 0, charted: 0, read: 0, missing: 0, shots_measured: 0, shots_unreadable: 0, stored: 0, unchanged: 0, refused: 0, failed: 0, reasons: {} };
  let notTaken = false;
  for (const [name, id] of Object.entries(GENRES)) {
    if (want.length && !want.includes(name)) continue;
    const entries = appsOf(await get(feedUrl(id, limit)), limit);
    if (!entries.length) { console.log(`${name}: the chart could not be read`); continue; }
    await new Promise(s => setTimeout(s, LOOKUP_GAP_MS));
    const found = await get(lookupUrl(entries.map(e => e.row.app_id)));
    const byId = new Map((Array.isArray(found?.results) ? found.results : []).map(r => [String(r.trackId), r]));
    if (!byId.size) { console.log(`${name}: the lookup could not be read`); totals.charted += entries.length; totals.missing += entries.length; continue; }
    const apps = []; let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < entries.length) {
        const e = entries[next++], r = byId.get(e.row.app_id), row = listingOf(r, e.row);
        if (!row) { totals.missing++; continue; }
        const palettes = [];
        for (const url of shotFacts(r).lead.slice(0, shotsWanted)) {
          const buf = await get(url, "bytes"), p = buf && buf.length > 200 && buf.length < 4_000_000 ? await measureIcon(buf).catch(() => null) : null;   // measured in memory, then dropped
          if (p) { palettes.push(p); totals.shots_measured++; } else totals.shots_unreadable++;
        }
        apps.push({ ...row, shots: { ...row.shots, palettes } });
      }
    }));
    apps.sort((a, b) => a.rank - b.rank);
    totals.categories++; totals.charted += entries.length; totals.read += apps.length;
    const parts = chunks(apps), dated = apps.filter(a => a.version_at), week = Date.now() - 7 * 864e5;
    console.log(`${name}: ${apps.length} of ${entries.length} listings read, ${dated.filter(a => Date.parse(a.version_at) > week).length} updated in the last seven days, ${apps.filter(a => a.notes).length} with a note, ${apps.filter(a => a.site).length} with a website, ${parts.length} posts`);
    if (outDir) await appendFile(path.join(outDir, `${runId}.jsonl`), apps.map(a => JSON.stringify({ chart_genre: name, ...a })).join("\n") + "\n");
    if (dry || notTaken) continue;
    for (let i = 0; i < parts.length && !notTaken; i++) {
      const body = JSON.stringify(bodyOf(runId, day, { id, name }, i + 1, parts.length, parts[i]));
      if (body.length > LISTING_LIMITS.requestBytes) { console.log(`${name} part ${i + 1}: over ${LISTING_LIMITS.requestBytes} bytes, not sent`); totals.failed += parts[i].length; continue; }
      let done = false;
      for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        if (!(await ready().then(() => true, e => (console.log(String(e?.message ?? e)), false)))) break;   // gate.js: ask the site first
        const r = await fetch(new URL("ingest-listings", endpoint), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": secret }, body, signal: AbortSignal.timeout(60_000) }).catch(() => null);
        const what = answerOf(r ? r.status : 0);
        if (what === "stored") {
          const j = await r.json().catch(() => ({}));
          totals.stored += j.stored ?? 0; totals.unchanged += j.unchanged ?? 0;
          for (const x of j.refused ?? []) { totals.refused++; totals.reasons[x.reason] = (totals.reasons[x.reason] ?? 0) + 1; }
          done = true;
        } else if (what === "not-taken") { notTaken = true; console.log(`::notice::the site does not take app listings yet (${r.status}); nothing more is sent this run`); break; }
        else if (what === "refused") { console.log(`${name} part ${i + 1}: request refused ${r.status}`); break; }
        else await new Promise(s => setTimeout(s, attempt * 4000));
      }
      if (!done && !notTaken) totals.failed += parts[i].length;
      await new Promise(s => setTimeout(s, 2000));   // small posts with a gap, never a burst
    }
  }
  console.log(`done ${JSON.stringify({ run_id: runId, day, dry, not_taken: notTaken, ...totals })}`);
  if (!dry && !notTaken && totals.failed && !totals.stored && !totals.unchanged) process.exit(1);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch(e => { console.error(String(e?.message ?? e)); process.exit(1); });
