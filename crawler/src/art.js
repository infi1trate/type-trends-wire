// Museum palettes (W3, the art-history half): public-domain works from two museums' open-access programmes, read with the same
// palette method as brand homepages, so a homepage's colours and a painting's can be compared like with like.
// Sources and terms (read 22 Nov 2026):
//   The Met, Open Access: works the museum marks public domain are CC0. https://www.metmuseum.org/policies/terms-and-conditions
//   Art Institute of Chicago: images and data marked public domain are CC0; the API's `description` field is CC-BY and is never
//   requested here. https://www.artic.edu/terms · https://api.artic.edu/docs (asks for an AIC-User-Agent header; sent below)
// A work's eight colours keep its small vivid areas (see pickColours), because the question asked of a work is whether a brand's one
// signature colour holds real space in it, not whether the two whole palettes look alike (that comparison found paper and varnish).
// Only works the museum itself marks public domain are sent, and the site refuses anything else. A small thumbnail (≤240 px wide,
// ≤20 KB) goes with each work; the site credits and links it and removes it on request.
// Contract (POST /api/public/ingest-art, x-crawl-secret):
//   { run_id, works: [{ source: "met"|"aic", source_id, title, artist|null, date_display, year_start, year_end, tradition,
//     movement|null, kind, credit_line, link, licence: "CC0", palette: [{ hex, share }] (1–8), width (≤240), height (≤480),
//     webp_base64 (decoded ≤20 KB) }] }, 1–20 works and ≤1 MB per request → { stored, unchanged, refused: [{ source, source_id, reason }] }
// Env: CRAWL_ENDPOINT (…/api/public/ingest-crawl; this posts to its sibling ingest-art), CRAWL_SECRET, DRY_RUN=1 to print and send
//      nothing, ART_LIMIT (works per run, default 120), ART_SOURCES ("met,aic"), ART_PROXY / ART_INSECURE=1 for a local run.
import fs from "node:fs";
import { gateFor } from "./gate.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { paletteFromScreenshot } from "./color.js";

export const ART_LIMITS = { thumbWidth: 240, thumbHeight: 480, thumbBytes: 20_000, perRequest: 20, requestBytes: 900_000, perRun: 120, perPlan: 40 };
export const AGENT = "slug.global design-trend newsroom (museum palettes; public-domain works only)";
const QUALITIES = [70, 60, 50, 40, 32];

/** What is asked of each museum: small, named slices, so no style or century crowds out the others. */
/** The Art Institute names a style on few works (and often only a century), so its slices are the styles that hold enough
 *  public-domain works, then paintings by half-century. */
export const AIC_SLICES = [
  ...["Impressionism", "Post-Impressionism", "Realism", "Renaissance", "Modernism", "Japanese (culture or style)", "Chinese (culture or style)", "South Asian"].map(style => ({ style })),
  ...[1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, 1900].map(y => ({ from: y, to: y + 49 })),
];
/** The Met has no style field: its slices are a department and a half-century. */
export const MET_SLICES = [
  ...[1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850].map(y => ({ department: 11, name: "European paintings", from: y, to: y + 49, q: "painting" })),
  ...[1750, 1800, 1850].map(y => ({ department: 1, name: "American paintings", from: y, to: y + 49, q: "painting" })),
  ...[1700, 1750, 1800, 1850].map(y => ({ department: 6, name: "Japanese prints", from: y, to: y + 49, q: "woodblock print" })),
];

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** One name per tradition across the two museums, so the same paintings of the same years fall in one group whichever museum holds
 *  them (the Art Institute's department names differ from the Met slices' names). Paintings only; other kinds keep the museum's name. */
export const TRADITIONS = { "Painting and Sculpture of Europe": "European paintings", "Arts of the Americas": "American paintings" };
export const traditionOf = (department, kind) => (kind === "painting" && TRADITIONS[department]) || department;
export const kindOf = s => { const x = String(s ?? "").toLowerCase(); return /print|woodblock|etching|lithograph|engraving/.test(x) ? "print" : /paint/.test(x) ? "painting" : /draw|watercolor|pastel/.test(x) ? "drawing" : /textile|tapestry/.test(x) ? "textile" : "other"; };

/** An AIC search hit as a work, or null when the museum does not mark it public domain or it has no picture. */
export function aicWork(d) {
  if (!d || d.is_public_domain !== true || !d.image_id || !d.id || !d.title) return null;
  if (!Number.isInteger(d.date_start) || !Number.isInteger(d.date_end) || d.date_end < d.date_start) return null;
  return { source: "aic", source_id: String(d.id), title: clip(d.title, 300), artist: clip(d.artist_title, 200) || null, date_display: clip(d.date_display || d.date_start, 120),
    year_start: d.date_start, year_end: d.date_end, tradition: clip(traditionOf(d.department_title || d.place_of_origin || "Art Institute of Chicago", kindOf(d.artwork_type_title)), 80), movement: movementOf(d.style_title),
    kind: kindOf(d.artwork_type_title), credit_line: clip(`The Art Institute of Chicago. ${d.credit_line ?? ""}`, 400), link: `https://www.artic.edu/artworks/${d.id}`, licence: "CC0",
    image: `https://www.artic.edu/iiif/2/${d.image_id}/full/843,/0/default.jpg` };
}
/** A Met object as a work, or null when the museum does not mark it public domain or it has no small picture. */
export function metWork(d, slice) {
  if (!d || d.isPublicDomain !== true || !d.primaryImageSmall || !d.objectID || !d.title) return null;
  if (!Number.isInteger(d.objectBeginDate) || !Number.isInteger(d.objectEndDate) || d.objectEndDate < d.objectBeginDate) return null;
  if (!/^https:\/\/www\.metmuseum\.org\//.test(String(d.objectURL ?? ""))) return null;
  return { source: "met", source_id: String(d.objectID), title: clip(d.title, 300), artist: clip(d.artistDisplayName, 200) || null, date_display: clip(d.objectDate || d.objectBeginDate, 120),
    year_start: d.objectBeginDate, year_end: d.objectEndDate, tradition: clip(slice?.name || d.department || "The Met", 80), movement: null,
    kind: kindOf(`${d.classification ?? ""} ${d.objectName ?? ""} ${d.medium ?? ""}`), credit_line: clip(`The Metropolitan Museum of Art. ${d.creditLine ?? ""}`, 400), link: d.objectURL, licence: "CC0",
    image: d.primaryImageSmall };
}
/** The AIC search address for one slice: public domain, with a picture; a style's paintings and prints, or a half-century's
 *  paintings. The description field (CC-BY) is never asked for. */
export function aicSearchUrl(slice, limit = ART_LIMITS.perPlan, page = 1) {
  const f = "id,title,artist_title,date_start,date_end,date_display,style_title,artwork_type_title,place_of_origin,department_title,image_id,credit_line,is_public_domain";
  const filters = ["[term][is_public_domain]=true", "[exists][field]=image_id",
    ...(slice.style ? [`[term][style_title.keyword]=${encodeURIComponent(slice.style)}`, "[terms][artwork_type_title.keyword][0]=Painting", "[terms][artwork_type_title.keyword][1]=Print"]
      : ["[term][artwork_type_title.keyword]=Painting", `[range][date_start][gte]=${slice.from}`, `[range][date_start][lte]=${slice.to}`])];
  // One filter may carry two keys (the two artwork types): they share an index.
  let i = -1; const q = filters.map(x => { if (!/\[terms\]\[artwork_type_title\.keyword\]\[1\]/.test(x)) i++; return `query[bool][filter][${i}]${x}`; });
  return `https://api.artic.edu/api/v1/artworks/search?${[`limit=${limit}`, `page=${page}`, `fields=${f}`, ...q].join("&")}`;
}
/** A style the museum gives that is a movement or a culture, not just a century ("17th Century", "nineteenth century"). */
export const movementOf = s => { const x = clip(s, 80); return !x || /century/i.test(x) ? null : x; };
/** The Met's search (version 1.1; version 1 was retired on 1 Oct 2026): object numbers only, a page at a time. */
export const metSearchUrl = (s, limit = ART_LIMITS.perPlan * 2, offset = 0) => `https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&departmentId=${s.department}&dateBegin=${s.from}&dateEnd=${s.to}&q=${encodeURIComponent(s.q)}&limit=${limit}&offset=${offset}`;

/** Which eight colours of a picture are kept. A painting's largest areas are often ground, varnish or paper, and the colour a viewer
 *  remembers (a robe, a sky, a wave) can be a small part of it. So: the four largest colours, then up to four vivid ones that hold at
 *  least VIVID_MIN_SHARE of the picture, then the next largest until there are eight. Shares are the measured shares, never rescaled. */
export const VIVID_MIN_CHROMA = 0.25, VIVID_MIN_SHARE = 0.015, PALETTE_SIZE = 8;
export function pickColours(palette) {
  const all = [...palette].sort((a, b) => b.share - a.share), keep = all.slice(0, 4);
  const vivid = all.filter(c => !keep.includes(c) && c.chroma >= VIVID_MIN_CHROMA && c.share >= VIVID_MIN_SHARE).slice(0, 4);
  const rest = all.filter(c => !keep.includes(c) && !vivid.includes(c));
  return [...keep, ...vivid, ...rest].slice(0, PALETTE_SIZE).sort((a, b) => b.share - a.share);
}
/** The palette (the homepage method) and a small thumbnail of one picture. Null when the picture cannot be read or made small enough. */
export async function readPicture(buf) {
  const meta = await sharp(buf).metadata().catch(() => null);
  if (!meta?.width || !meta?.height) return null;
  const png = await sharp(buf).removeAlpha().png().toBuffer();
  const { palette } = await paletteFromScreenshot(png, null, 24);
  const colours = pickColours(palette).map(c => ({ hex: c.hex, share: c.share })).filter(c => /^#[0-9A-F]{6}$/.test(c.hex) && c.share > 0);
  if (!colours.length) return null;
  for (const width of [ART_LIMITS.thumbWidth, 200, 160]) {
    const img = sharp(buf).resize({ width, height: ART_LIMITS.thumbHeight, fit: "inside", withoutEnlargement: true });
    for (const quality of QUALITIES) {
      const { data, info } = await img.clone().webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      if (data.length <= ART_LIMITS.thumbBytes) return { palette: colours, width: info.width, height: info.height, webp_base64: data.toString("base64") };
    }
  }
  return null;
}
/** The request body of one work (the picture address stays here; the site gets the museum's page, not the file). */
export const workBody = (w, pic) => { const { image, ...rest } = w; return { ...rest, ...pic }; };

/** Works not sent before, taken in turn across the slices so every run brings a mix. */
export function nextBatch(slices, sent, limit = ART_LIMITS.perRun) {
  const out = [], seen = new Set(sent), queues = slices.map(s => s.filter(w => !seen.has(`${w.source}:${w.source_id}`)));
  for (let i = 0; out.length < limit && queues.some(q => q.length > i); i++) for (const q of queues) { if (out.length >= limit) break; const w = q[i]; if (w && !seen.has(`${w.source}:${w.source_id}`)) { seen.add(`${w.source}:${w.source_id}`); out.push(w); } }
  return out;
}

/** Buffers works and posts them under the server's limits. Never throws. */
export function makeArtSender({ endpoint, secret, dry = false, runId, fetchImpl = fetch, log = console.log }) {
  const ready = dry || fetchImpl !== fetch ? async () => {} : () => gateFor(endpoint)();
  let buf = [], bytes = 0;
  const totals = { read: 0, stored: 0, unchanged: 0, refused: 0, failed: 0, reasons: {}, done: [] };
  const send = async works => {
    const keys = works.map(w => `${w.source}:${w.source_id}`);
    if (dry) { totals.stored += works.length; totals.done.push(...keys); return; }
    const body = JSON.stringify({ run_id: runId, works });
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!(await ready().then(() => true, e => (log(String(e?.message ?? e)), false)))) break;   // gate.js: ask the site first
      const r = await fetchImpl(new URL("ingest-art", endpoint), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": secret }, body }).catch(() => null);
      if (r?.ok) {
        const j = await r.json().catch(() => ({}));
        totals.stored += j.stored ?? 0; totals.unchanged += j.unchanged ?? 0;
        for (const x of j.refused ?? []) { totals.refused++; totals.reasons[x.reason] = (totals.reasons[x.reason] ?? 0) + 1; }
        totals.done.push(...keys); // refused works are not tried again either: the reason does not change by asking twice
        return;
      }
      if (r && r.status >= 400 && r.status < 500 && r.status !== 429) { log(`art: request refused ${r.status}`); break; }
      await new Promise(s => setTimeout(s, attempt * 3000));
    }
    totals.failed += works.length;
  };
  let chain = Promise.resolve();
  const flush = () => { if (!buf.length) return chain; const c = buf; buf = []; bytes = 0; chain = chain.then(() => send(c)); return chain; };
  return { totals, flush,
    add(work) { const size = work.webp_base64.length + 900; if (buf.length && (buf.length >= ART_LIMITS.perRequest || bytes + size > ART_LIMITS.requestBytes)) flush(); buf.push(work); bytes += size; totals.read++; } };
}

async function getJson(url, headers = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": AGENT, "AIC-User-Agent": AGENT, accept: "application/json", ...headers }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (r?.ok) return r.json().catch(() => null);
    if (r && r.status === 404) return null;
    await new Promise(s => setTimeout(s, attempt * 2000));
  }
  return null;
}
async function getPicture(url) {
  const r = await fetch(url, { headers: { "user-agent": AGENT, "AIC-User-Agent": AGENT }, signal: AbortSignal.timeout(40_000) }).catch(() => null);
  if (!r?.ok) return null;
  const b = Buffer.from(await r.arrayBuffer());
  return b.length > 500 && b.length < 8_000_000 ? b : null;
}

async function main() {
  const dry = process.env.DRY_RUN === "1", secret = process.env.CRAWL_SECRET, endpoint = process.env.CRAWL_ENDPOINT || "https://slug.global/api/public/ingest-crawl";
  if (!secret && !dry) { console.error("CRAWL_SECRET is not set"); process.exit(2); }
  const limit = Math.max(1, Math.min(400, Number(process.env.ART_LIMIT) || ART_LIMITS.perRun));
  const sources = String(process.env.ART_SOURCES || "met,aic").split(",").map(s => s.trim()).filter(Boolean);
  const dir = path.join(".cache", "art"), file = path.join(dir, "sent-3.json") /* a new name sends every work once more: tradition names are one per tradition, and small vivid colours are kept */;
  fs.mkdirSync(dir, { recursive: true });
  const sent = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const slices = [];
  if (sources.includes("aic")) for (const slice of AIC_SLICES) {
    const style = slice.style ?? `paintings ${slice.from} to ${slice.to}`;
    const j = await getJson(aicSearchUrl(slice));
    const works = (j?.data ?? []).map(aicWork).filter(Boolean);
    console.log(`aic · ${style}: ${works.length} public-domain works with a picture${j ? ` of ${j.pagination?.total ?? "?"}` : " (no answer)"}`);
    slices.push(works);
    await new Promise(s => setTimeout(s, 400));
  }
  // The Met answers a search with object numbers only; each object is then read, and only those it marks public domain are kept.
  const metSlices = [];
  if (sources.includes("met")) for (const s of MET_SLICES) {
    const j = await getJson(metSearchUrl(s));
    metSlices.push({ slice: s, ids: (j?.objectIDs ?? []).slice(0, ART_LIMITS.perPlan * 2).filter(id => !sent.includes(`met:${id}`)) });
    console.log(`met · ${s.name} ${s.from} to ${s.to}: ${j?.total ?? 0} found`);
    await new Promise(r => setTimeout(r, 300));
  }
  const budget = Math.ceil(limit / Math.max(1, sources.length)), perSlice = Math.max(2, Math.ceil(budget / Math.max(1, metSlices.length)) + 1);
  for (const { slice, ids } of metSlices) {
    const works = [];
    for (const id of ids) {
      if (works.length >= perSlice) break;
      const w = metWork(await getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`), slice);
      if (w && w.year_start >= slice.from - 60 && w.year_end <= slice.to + 60) works.push(w);
      await new Promise(r => setTimeout(r, 120));
    }
    slices.push(works);
  }
  const batch = nextBatch(slices, sent, limit);
  const sender = makeArtSender({ endpoint, secret, dry, runId: `art-${new Date().toISOString().slice(0, 10)}` });
  let unread = 0;
  for (const w of batch) {
    const buf = await getPicture(w.image), pic = buf ? await readPicture(buf).catch(() => null) : null;
    if (!pic) { unread++; continue; }
    const body = workBody(w, pic);
    if (dry) console.log(`${w.source} ${w.source_id} · ${w.artist ?? "Unknown"} · ${w.title.slice(0, 50)} · ${w.date_display} · ${w.movement ?? w.tradition} · ${pic.palette.slice(0, 4).map(c => `${c.hex} ${Math.round(c.share * 100)}%`).join(" ")} · ${Math.round(pic.webp_base64.length * 0.75 / 1024)} KB`);
    sender.add(body);
    await new Promise(r => setTimeout(r, 250));
  }
  await sender.flush();
  const t = sender.totals;
  if (!dry) fs.writeFileSync(file, JSON.stringify([...new Set([...sent, ...t.done])]));
  console.log(`art: ${batch.length} chosen, ${t.read} read, ${unread} without a readable picture, ${t.stored} stored, ${t.unchanged} unchanged, ${t.refused} refused${Object.keys(t.reasons).length ? ` (${JSON.stringify(t.reasons)})` : ""}, ${t.failed} failed${dry ? " (dry run, nothing sent)" : ""}`);
  if (!dry && t.failed > 0 && t.stored + t.unchanged === 0) process.exit(1);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch(e => { console.error(String(e?.message ?? e).slice(0, 200)); process.exit(1); });
