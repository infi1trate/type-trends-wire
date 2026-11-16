// slug discourse sampler: listens to Bluesky's public Jetstream (every new post, no key) for a fixed window,
// keeps design posts, counts mentions of the terms the terminal tracks (fonts, aesthetics, layout, color, tech) and
// "fatigue" language, then posts aggregate counts plus a capped set of design posts (text ≤300 chars + link) to the wire.
// Env: CRAWL_ENDPOINT (…/api/public/ingest-crawl; siblings discourse-terms and ingest-wire), CRAWL_SECRET,
//      DURATION_MIN (default 30), MAX_ITEMS (default 400), JETSTREAM_URL (tests), TERMS_FILE (tests), DRY_RUN=1.
// It is a sample: a window every few hours, not the full firehose. Counts are reported with the posts sampled.
import { readFileSync } from "node:fs";

const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const DRY = process.env.DRY_RUN === "1";
const DURATION_MIN = Number(process.env.DURATION_MIN ?? 30);
const MAX_ITEMS = Number(process.env.MAX_ITEMS ?? 400);
const JETSTREAM = process.env.JETSTREAM_URL ?? "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

// A post must read as design talk before any tracked term counts: one of these, case-insensitive, as a word.
const DESIGN_CONTEXT = /\b(design(er|ers|ing|ed)?|typograph(y|ic|er)|typeface|font(s)?|type ?specimen|branding|rebrand(ed|ing)?|brand identity|visual identity|logo(s|type)?|web ?design|ui|ux|figma|framer|webflow|landing page|design system|color palette|colour palette|palette|layout|kerning|letterform(s)?|grotesk|serif|monospace|motion design|art direction|graphic design|portfolio)\b/i;
const DEFAULT_FATIGUE = ["played out", "overdone", "tired of", "everyone uses", "so 2024", "so 2025", "cliché", "cliche", "bored of", "enough with"];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compile tracked terms. Font names are matched case-sensitively (so "Inter" ≠ "inter"); the rest ignore case. */
export function compileTerms(terms) {
  return terms.filter((t) => t.term && t.term.length >= 3).map((t) => ({
    term: t.term,
    re: new RegExp(`(?<![\\p{L}\\p{N}])${esc(t.term)}(?![\\p{L}\\p{N}])`, t.kind === "font" ? "u" : "iu"),
  }));
}

/** Pure: what one post contributes. Returns null for non-design or non-English posts. */
export function scorePost(record, compiled, fatigue = DEFAULT_FATIGUE) {
  const text = typeof record?.text === "string" ? record.text : "";
  if (!text || record.reply) return null; // replies are conversation, not discourse signal
  const langs = Array.isArray(record.langs) ? record.langs : [];
  if (langs.length && !langs.some((l) => /^en\b/i.test(l))) return null;
  if (!DESIGN_CONTEXT.test(text)) return null;
  const hits = compiled.filter((t) => t.re.test(text)).map((t) => t.term);
  const lower = text.toLowerCase();
  const fatigued = fatigue.some((f) => lower.includes(f));
  return { hits, fatigued, link: firstLink(record) };
}

export function firstLink(record) {
  const ext = record?.embed?.external?.uri ?? record?.embed?.media?.external?.uri;
  if (typeof ext === "string" && /^https?:\/\//.test(ext)) return ext;
  for (const f of record?.facets ?? []) for (const feat of f.features ?? []) {
    if (feat.$type === "app.bsky.richtext.facet#link" && /^https?:\/\//.test(feat.uri ?? "")) return feat.uri;
  }
  return null;
}

/** Fold one Jetstream event into the running tally. */
export function makeTally(compiled, fatigue = DEFAULT_FATIGUE, maxItems = MAX_ITEMS) {
  const t = { sampled_posts: 0, design_posts: 0, counts: {}, items: [] };
  t.add = (ev) => {
    if (ev?.kind !== "commit" || ev.commit?.operation !== "create" || ev.commit?.collection !== "app.bsky.feed.post") return;
    t.sampled_posts++;
    const s = scorePost(ev.commit.record, compiled, fatigue);
    if (!s) return;
    t.design_posts++;
    for (const term of s.hits) {
      const c = (t.counts[term] ??= { n: 0, fatigue: 0 });
      c.n++; if (s.fatigued) c.fatigue++;
    }
    // Wire items: only design posts that carry a tracked term AND (a link or ≥2 terms) — the rest is chatter.
    if (t.items.length < maxItems && s.hits.length && (s.link || s.hits.length >= 2)) {
      t.items.push({
        source_kind: "bluesky",
        url: `https://bsky.app/profile/${ev.did}/post/${ev.commit.rkey}`,
        title: ev.commit.record.text.replace(/\s+/g, " ").trim().slice(0, 300),
        author: String(ev.did).slice(0, 100),
        published_at: new Date(Math.floor(Number(ev.time_us) / 1000) || Date.now()).toISOString(),
        ...(s.link ? { link: s.link } : {}),
        terms: s.hits.slice(0, 20),
      });
    }
  };
  return t;
}

async function getTerms() {
  if (process.env.TERMS_FILE) return JSON.parse(readFileSync(process.env.TERMS_FILE, "utf8"));
  const r = await fetch(new URL("discourse-terms", ENDPOINT), { headers: { authorization: `Bearer ${SECRET}` } });
  if (r.status === 404) { console.log("discourse-terms not deployed yet; nothing to do"); process.exit(0); }
  if (!r.ok) throw new Error(`discourse-terms ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function post(body) {
  if (DRY) { console.log(JSON.stringify(body).slice(0, 600)); return; }
  const r = await fetch(new URL("ingest-wire", ENDPOINT), { method: "POST", headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`ingest-wire ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

/** Split items into ≤200-item, <240 KB batches for the 256 KB ingest cap. */
export function batches(items, maxItems = 200, maxBytes = 240 * 1024) {
  const out = []; let cur = [], size = 0;
  for (const it of items) {
    const b = Buffer.byteLength(JSON.stringify(it)) + 1;
    if (cur.length && (cur.length >= maxItems || size + b > maxBytes)) { out.push(cur); cur = []; size = 0; }
    cur.push(it); size += b;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Listen for `ms`, reconnecting on drops (resuming from the last cursor). */
function listen(url, ms, onEvent) {
  return new Promise((resolve) => {
    const end = Date.now() + ms;
    let cursor = null, ws = null, done = false;
    const finish = () => { if (done) return; done = true; try { ws?.close(); } catch {} resolve(); };
    const open = () => {
      if (done || Date.now() >= end) return finish();
      const u = new URL(url); if (cursor) u.searchParams.set("cursor", String(cursor));
      ws = new WebSocket(u);
      ws.onmessage = (m) => { try { const ev = JSON.parse(m.data); if (ev.time_us) cursor = ev.time_us; onEvent(ev); } catch {} };
      ws.onclose = () => { if (!done) setTimeout(open, 2000); };
      ws.onerror = () => {};
    };
    setTimeout(finish, ms);
    open();
  });
}

async function main() {
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  const { terms = [], fatigue = DEFAULT_FATIGUE } = await getTerms();
  const tally = makeTally(compileTerms(terms), fatigue);
  const window_start = new Date().toISOString();
  console.log(`listening ${DURATION_MIN} min for ${terms.length} terms`);
  await listen(JETSTREAM, DURATION_MIN * 60_000, tally.add);
  const window_end = new Date().toISOString();
  console.log(JSON.stringify({ sampled_posts: tally.sampled_posts, design_posts: tally.design_posts, terms_hit: Object.keys(tally.counts).length, items: tally.items.length }));
  for (const items of batches(tally.items)) await post({ kind: "items", items });
  await post({ kind: "mentions", window_start, window_end, sampled_posts: tally.sampled_posts, design_posts: tally.design_posts, counts: tally.counts });
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
