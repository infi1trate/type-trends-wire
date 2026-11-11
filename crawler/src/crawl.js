// DSGN/TERMINAL crawler: renders homepages, extracts design signals, posts them to the terminal.
// Env: CRAWL_ENDPOINT, CRAWL_SECRET, PER_INDEX (default 500), CONCURRENCY (default 6),
//      DRY_RUN=1 (write out/*.jsonl instead of posting), SEEDS_FILE (JSON {mainstream:[], vanguard:[]} to skip seed fetch)
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSeeds } from "./seeds.js";
import { VIEWPORTS, makePoster, robotsOk, openPage, analyzePage, errorCode } from "./core.js";

export { ADULT_TEXT, GAMBLING_TEXT } from "./core.js";

const PER_INDEX = Number(process.env.PER_INDEX ?? 500);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const DRY = process.env.DRY_RUN === "1";
const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const RUN_ID = process.env.RUN_ID ?? new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 6);
const ALLOW_HTTP = process.env.ALLOW_HTTP === "1"; // tests only
const post = makePoster({ endpoint: ENDPOINT, secret: SECRET, dry: DRY, runId: RUN_ID });

async function crawlOne(browser, domain, index) {
  const started = Date.now();
  const origin = domain.startsWith("http") ? domain.replace(/\/$/, "") : (ALLOW_HTTP ? "http://" : "https://") + domain;
  const base = { run_id: RUN_ID, domain: domain.replace(/^https?:\/\//, "").replace(/^www\./, ""), index, crawled_at: new Date().toISOString() };
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
      const d = candidates[next++]; tried++;
      const r = await crawlOne(browser, d, index);
      if (r.ok) ok++;
      await onResult(r);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { ok, tried };
}

async function main() {
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  const seeds = process.env.SEEDS_FILE ? JSON.parse(readFileSync(process.env.SEEDS_FILE, "utf8")) : await buildSeeds({ perIndex: PER_INDEX, curatedPath: new URL("../seeds/vanguard.txt", import.meta.url).pathname });
  console.log(`run ${RUN_ID}: ${seeds.mainstream.length} mainstream / ${seeds.vanguard.length} vanguard candidates`);
  await post({ kind: "start", run_id: RUN_ID, started_at: new Date().toISOString(), seeds_meta: seeds.meta ?? null, target_per_index: PER_INDEX });

  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  let buffer = [];
  const errors = {};
  const flush = async () => { if (!buffer.length) return; const sites = buffer; buffer = []; await post({ kind: "sites", run_id: RUN_ID, sites }); };
  const onResult = async (r) => {
    if (!r.ok) errors[r.error] = (errors[r.error] ?? 0) + 1;
    buffer.push(r);
    if (buffer.length >= 25) await flush();
  };
  const stats = {};
  for (const index of ["mainstream", "vanguard"]) {
    stats[index] = await crawlIndex(browser, index, seeds[index], PER_INDEX, onResult);
    console.log(index, stats[index]);
  }
  await flush();
  await browser.close();
  await post({ kind: "finish", run_id: RUN_ID, finished_at: new Date().toISOString(), stats: { ...stats, errors } });
  if (DRY) writeFileSync(`out/${RUN_ID}.summary.json`, JSON.stringify({ stats, errors }, null, 2));
  console.log("done", JSON.stringify({ stats, errors }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
