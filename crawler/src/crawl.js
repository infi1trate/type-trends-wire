// slug crawler: renders homepages, extracts design signals, posts them to the terminal.
// Env: CRAWL_ENDPOINT, CRAWL_SECRET, PER_INDEX (default 500), PER_CURATED (default 300), CONCURRENCY (default 6),
//      INDEXES (default "mainstream,vanguard,curated"), DRY_RUN=1 (write out/*.jsonl instead of posting),
//      SEEDS_FILE (JSON {mainstream:[], vanguard:[], curated?:[{domain,galleries}]} to skip seed fetch)
// Indexes: mainstream = what the mass web ships (CrUX); vanguard = hand-picked product sites + Show HN launches;
//          curated = what design galleries (and Are.na / Product Hunt, via the terminal) are featuring right now.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSeeds, registrable, hostOf } from "./seeds.js";
import { galleryDomains } from "./galleries.js";
import { VIEWPORTS, makePoster, robotsOk, openPage, analyzePage, errorCode } from "./core.js";

export { ADULT_TEXT, GAMBLING_TEXT } from "./core.js";

const PER_INDEX = Number(process.env.PER_INDEX ?? 500);
const PER_CURATED = Number(process.env.PER_CURATED ?? 300);
const INDEXES = (process.env.INDEXES ?? "mainstream,vanguard,curated").split(",").map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const DRY = process.env.DRY_RUN === "1";
const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const RUN_ID = process.env.RUN_ID ?? new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 6);
const ALLOW_HTTP = process.env.ALLOW_HTTP === "1"; // tests only
const post = makePoster({ endpoint: ENDPOINT, secret: SECRET, dry: DRY, runId: RUN_ID });

async function crawlOne(browser, domain, index, extra = {}) {
  const started = Date.now();
  const origin = domain.startsWith("http") ? domain.replace(/\/$/, "") : (ALLOW_HTTP ? "http://" : "https://") + domain;
  const base = { run_id: RUN_ID, domain: domain.replace(/^https?:\/\//, "").replace(/^www\./, ""), index, crawled_at: new Date().toISOString(), ...extra };
  if (!(await robotsOk(origin))) return { ...base, ok: false, error: "robots_disallow" };
  const context = await browser.newContext({ ...VIEWPORTS.desktop, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const err = await openPage(page, origin);
    if (err) return { ...base, ok: false, error: err };
    return { ...base, ...(await analyzePage(page, { started })) };
  } catch (e) {
    return { ...base, ok: false, error: errorCode(e) };
  } finally {
    await context.close().catch(() => {});
  }
}

async function crawlIndex(browser, index, candidates, target, onResult) {
  let next = 0, ok = 0, tried = 0;
  const worker = async () => {
    while (ok < target && next < candidates.length) {
      const c = candidates[next++]; tried++;
      const r = typeof c === "string" ? await crawlOne(browser, c, index) : await crawlOne(browser, c.domain, index, { galleries: c.galleries });
      if (r.ok) ok++;
      await onResult(r);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { ok, tried };
}

/** Terminal-side candidates (Are.na link blocks, Product Hunt launches). Optional: an older terminal without the
 *  endpoint, or a failed request, just means galleries only. */
async function seedCandidates() {
  if (DRY || !ENDPOINT) return [];
  try {
    const r = await fetch(new URL("seed-candidates", ENDPOINT), { headers: { authorization: `Bearer ${SECRET}` }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { console.warn(`seed-candidates ${r.status}`); return []; }
    return (await r.json()).domains ?? [];
  } catch (e) { console.warn("seed-candidates failed:", String(e)); return []; }
}

/** Curated index: gallery-featured sites first (most galleries first), then terminal candidates; disjoint from the
 *  other indexes so each index stays its own sample. */
export function mergeCurated(galleryFound, candidates, taken) {
  const byDomain = new Map();
  for (const [d, set] of galleryFound) byDomain.set(d, new Set(set));
  for (const c of candidates) {
    const h = hostOf(c.domain); if (!h) continue;
    const d = /\.(webflow\.io|framer\.(website|app|ai)|vercel\.app|netlify\.app|pages\.dev|github\.io)$/i.test(h) ? h : registrable(h);
    if (!byDomain.has(d)) byDomain.set(d, new Set());
    for (const s of c.sources ?? []) byDomain.get(d).add(s);
  }
  return [...byDomain].filter(([d]) => !taken.has(registrable(d)))
    .sort((a, b) => b[1].size - a[1].size)
    .map(([domain, set]) => ({ domain, galleries: [...set].slice(0, 10) }));
}

async function curatedSeeds(browser, seeds) {
  const { found, stats } = await galleryDomains(browser);
  const candidates = await seedCandidates();
  const taken = new Set([...(seeds.mainstream ?? []), ...(seeds.vanguard ?? [])].map((d) => registrable(hostOf(d) ?? d)));
  const curated = mergeCurated(found, candidates, taken);
  seeds.meta = { ...(seeds.meta ?? {}), curated: { galleries: stats, terminal_candidates: candidates.length, candidates: curated.length } };
  console.log("curated seeds", JSON.stringify(seeds.meta.curated));
  return curated.slice(0, PER_CURATED * 2);
}

async function main() {
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  const seeds = process.env.SEEDS_FILE ? JSON.parse(readFileSync(process.env.SEEDS_FILE, "utf8")) : await buildSeeds({ perIndex: PER_INDEX, curatedPath: new URL("../seeds/vanguard.txt", import.meta.url).pathname });
  console.log(`run ${RUN_ID}: ${seeds.mainstream.length} mainstream / ${seeds.vanguard.length} vanguard candidates`);
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  if (INDEXES.includes("curated") && !seeds.curated) seeds.curated = process.env.SEEDS_FILE ? [] : await curatedSeeds(browser, seeds);
  await post({ kind: "start", run_id: RUN_ID, started_at: new Date().toISOString(), seeds_meta: seeds.meta ?? null, target_per_index: PER_INDEX });
  let buffer = [];
  const errors = {};
  const flush = async () => { if (!buffer.length) return; const sites = buffer; buffer = []; await post({ kind: "sites", run_id: RUN_ID, sites }); };
  const onResult = async (r) => {
    if (!r.ok) errors[r.error] = (errors[r.error] ?? 0) + 1;
    buffer.push(r);
    if (buffer.length >= 25) await flush();
  };
  const stats = {};
  for (const index of INDEXES) {
    stats[index] = await crawlIndex(browser, index, seeds[index] ?? [], index === "curated" ? PER_CURATED : PER_INDEX, onResult);
    console.log(index, stats[index]);
  }
  await flush();
  await browser.close();
  await post({ kind: "finish", run_id: RUN_ID, finished_at: new Date().toISOString(), stats: { ...stats, errors } });
  if (DRY) writeFileSync(`out/${RUN_ID}.summary.json`, JSON.stringify({ stats, errors }, null, 2));
  console.log("done", JSON.stringify({ stats, errors }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
