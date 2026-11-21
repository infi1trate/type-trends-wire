// slug history backfill: renders archived homepages (Internet Archive) once per quarter since 2021
// and posts them as source:"wayback" library snapshots. Resumable: each run asks the terminal which
// quarters exist and works through the rest, coarse-first, until its time budget runs out.
// Env: CRAWL_ENDPOINT, CRAWL_SECRET, DRY_RUN=1, LIMIT (first N sites), PASS_MAX (1..3, default 3),
//      WB_CONCURRENCY (default 3), TIME_BUDGET_MIN (default 320), LIBRARY_FILE, LIBRARY_TAG=0 to skip tagging,
//      WB_ARCHIVE_BASE (tests: replaces https://web.archive.org), STATE_FILE (dry runs),
//      WB_RECYCLE (renders per browser before a fresh one, default 30), WB_RENDER_DEADLINE_S (default 200),
//      WB_CACHE_FILE (what the Archive holds per brand and what failed, kept between runs; default .cache/wayback.json)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import os from "node:os";
import sharp from "sharp";
import { VIEWPORTS, UA, makePoster, analyzePage, evalSettled, hideOverlays, errorCode } from "./core.js";
import { extractLibraryExtras } from "./extract-library.js";
import { parseLibrary, contentHash, signalsHash } from "./library-lib.js";
import { quarters, parseCdx, pickCaptures, blankArchive, archiveUrl, cdxUrl, tsFromArchiveUrl, tsToDate, ARCHIVE_ERROR, buildQueue } from "./wayback-lib.js";

const DRY = process.env.DRY_RUN === "1";
const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const LIMIT = Number(process.env.LIMIT ?? 0);
const PASS_MAX = Number(process.env.PASS_MAX ?? 3);
const CONCURRENCY = Number(process.env.WB_CONCURRENCY ?? 3);
const BUDGET_MS = Number(process.env.TIME_BUDGET_MIN ?? 320) * 60_000;
const TAG = process.env.LIBRARY_TAG !== "0";
const RECYCLE = Math.max(1, Number(process.env.WB_RECYCLE ?? 30));
const RENDER_DEADLINE_MS = Number(process.env.WB_RENDER_DEADLINE_S ?? 200) * 1000;
const CACHE_FILE = process.env.WB_CACHE_FILE ?? ".cache/wayback.json";
const CACHE_DAYS = 21;   // the Archive keeps adding captures to recent quarters, so its index is asked again after three weeks
const FAIL_LIMIT = 2;    // a capture that failed to render in two runs is left alone until its index entry expires
const LOW_MEMORY = 3e9;  // free bytes below which a worker replaces its browser before the next render
const THROTTLED = /^archive_(429|503|throttled)$/;
const BASE = process.env.WB_ARCHIVE_BASE; // tests only
const RUN_ID = process.env.RUN_ID ?? `wb-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;
const post = makePoster({ endpoint: ENDPOINT, secret: SECRET, dry: DRY, runId: RUN_ID });
const rebase = (u) => (BASE ? u.replace("https://web.archive.org", BASE) : u);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Be gentle with the Archive: at most one page start every 2.5s across all workers, and a global
// pause whenever it says slow down.
let nextStart = 0, pausedUntil = 0;
async function slot() {
  for (;;) {
    const now = Date.now();
    const t = Math.max(nextStart, pausedUntil);
    if (now >= t) { nextStart = now + 2500; return; }
    await sleep(t - now);
  }
}
const backoff = (ms) => { pausedUntil = Math.max(pausedUntil, Date.now() + ms); };

async function fetchCdx(domain) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await slot();
    try {
      const r = await fetch(rebase(cdxUrl(domain)), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
      if (r.status === 429 || r.status >= 500) { backoff(60_000 * attempt); continue; }
      if (!r.ok) return [];
      return parseCdx(await r.json().catch(() => []));
    } catch { backoff(20_000 * attempt); }
  }
  return null; // unknown: retry next run
}

async function getState() {
  if (DRY) return process.env.STATE_FILE ? JSON.parse(readFileSync(process.env.STATE_FILE, "utf8")) : { sites: [] };
  const u = new URL("library-state", ENDPOINT); u.searchParams.set("source", "wayback");
  const r = await fetch(u, { headers: { "x-crawl-secret": SECRET } });
  if (!r.ok) throw new Error(`library-state?source=wayback ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function captureImages(page) {
  const { width, height } = page.viewportSize();
  const total = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => height);
  const h = Math.min(total, height * 9);
  for (let y = height; y < h; y += height) { await page.evaluate((yy) => window.scrollTo(0, yy), y).catch(() => {}); await sleep(300); }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await sleep(600);
  const url = (buf) => "data:image/jpeg;base64," + buf.toString("base64");
  const fold = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  const sections = [];
  for (let y = height; y < h && sections.length < 4; y += height * 2) {
    const sh = Math.min(height * 2, h - y);
    if (sh < 300) break;
    const shot = await page.screenshot({ type: "png", fullPage: true, clip: { x: 0, y, width, height: sh } }).catch(() => null);
    if (shot) sections.push(url(await sharp(shot).resize({ width: 720 }).jpeg({ quality: 65 }).toBuffer()));
  }
  return { fold: url(await sharp(fold).resize({ width: 960 }).jpeg({ quality: 70 }).toBuffer()), sections };
}

/** Render one archived capture. Returns { record, images } or { error }. */
async function renderCapture(browser, item, ts) {
  await slot();
  const context = await browser.newContext({ ...VIEWPORTS.desktop, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "reduce" });
  const page = await context.newPage();
  const started = Date.now();
  try {
    const res = await page.goto(rebase(archiveUrl(ts, item.domain)), { waitUntil: "domcontentloaded", timeout: 90_000 });
    const status = res?.status() ?? 0;
    if (status === 429 || status === 503) { backoff(120_000); return { error: `archive_${status}` }; }
    if (status >= 400) return { error: `http_${status}` };
    await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.evaluate(async () => {
      const t0 = Date.now();
      while (document.fonts && [...document.fonts].some((f) => f.status === "loading") && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 200));
    }).catch(() => {});
    await hideOverlays(page);
    const head = await page.evaluate(() => `${document.title} ${(document.body?.innerText || "").slice(0, 400)}`).catch(() => "");
    if (ARCHIVE_ERROR.test(head)) return { error: "archive_placeholder" };
    const a = await analyzePage(page, { started });
    if (!a.ok) return { error: a.error };
    const x = await evalSettled(page, extractLibraryExtras);
    const fonts = await page.evaluate(() => { const f = [...(document.fonts || [])]; return { fonts_total: f.length, fonts_failed: f.filter((x) => x.status === "error").length }; }).catch(() => ({ fonts_total: 0, fonts_failed: 0 }));
    const realTs = tsFromArchiveUrl(page.url()) ?? ts;
    const { ok, final_url, ...fields } = a;
    // Nav hrefs point into the archive; keep the original paths.
    const nav = x.nav.map((n) => ({ ...n, href: n.href.replace(/^https?:\/\/[^/]+\/web\/\d+[a-z_]*\//, "") }));
    const signals = { ...fields, css_features: x.css_features, prices: x.prices, nav, skeleton: x.skeleton.slice(0, 250), page: { w: x.page_w, h: x.page_h },
      archive: { timestamp: realTs, quarter: item.quarter, ...fonts } };
    const record = {
      domain: item.domain, page_type: "home", viewport: "desktop", source: "wayback",
      captured_at: tsToDate(realTs).toISOString(), url: `https://${item.domain}/`,
      content_hash: contentHash(x.text), signals_hash: signalsHash(signals), signals,
    };
    const images = TAG ? await captureImages(page).catch(() => null) : null;
    return { record, images };
  } catch (e) {
    const code = errorCode(e);
    if (/CONNECTION_(REFUSED|RESET|CLOSED)|ERR_TIMED_OUT|EMPTY_RESPONSE/.test(code)) { backoff(90_000); return { error: "archive_throttled" }; }
    return { error: code };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  const t0 = Date.now();
  let sites = parseLibrary(readFileSync(process.env.LIBRARY_FILE ?? new URL("../seeds/library.csv", import.meta.url).pathname, "utf8"));
  if (LIMIT) sites = sites.slice(0, LIMIT);
  const state = await getState();
  const have = new Map((state.sites ?? []).map((s) => [s.domain, new Set((s.wayback ?? []).map((w) => w.quarter))]));
  const qs = quarters();
  // Kept between runs: for each brand, the Archive's usable captures per quarter (asking its index took most of
  // a run: about 12 s a brand), and how often a quarter failed to render. A run with a warm file spends its time rendering.
  let cache = { v: 1, cdx: {}, failed: {} };
  try { const c = JSON.parse(readFileSync(CACHE_FILE, "utf8")); if (c?.v === 1 && c.cdx && c.failed) cache = c; } catch { /* first run, or an unreadable file: start empty */ }
  const saveCache = () => { try { mkdirSync(dirname(CACHE_FILE), { recursive: true }); writeFileSync(CACHE_FILE + ".tmp", JSON.stringify(cache)); renameSync(CACHE_FILE + ".tmp", CACHE_FILE); } catch { /* the file is a saving, not a need */ } };
  const fresh = (e) => e && Date.now() - Date.parse(e.at) < CACHE_DAYS * 86400000;
  for (const d of Object.keys(cache.cdx)) if (!fresh(cache.cdx[d])) { delete cache.cdx[d]; for (const k of Object.keys(cache.failed)) if (k.startsWith(d + "|")) delete cache.failed[k]; }
  const all = buildQueue(sites, have, qs, PASS_MAX);
  // Skip, without asking anyone, what the file already knows: quarters with no capture and quarters that failed twice.
  const queue = all.filter((i) => { const e = cache.cdx[i.domain]; return !(e && !(e.picks[i.quarter]?.length)) && (cache.failed[`${i.domain}|${i.quarter}`] ?? 0) < FAIL_LIMIT; });
  console.log(`run ${RUN_ID}: ${sites.length} sites, ${qs.length} quarters, ${all.length} captures missing, ${queue.length} to try (pass ≤ ${PASS_MAX}); known from earlier runs: ${Object.keys(cache.cdx).length} brands indexed, ${all.length - queue.length} skipped`);

  const cdx = new Map(); // domain -> Promise<{ quarter: [timestamps] } | null>
  const picksFor = (d) => {
    if (cache.cdx[d]) return Promise.resolve(cache.cdx[d].picks);
    if (!cdx.has(d)) cdx.set(d, fetchCdx(d).then((stamps) => {
      if (stamps === null) return null;
      const picks = {};
      for (const q of qs) { const c = pickCaptures(stamps, q); if (c.length) picks[q] = c; }
      cache.cdx[d] = { at: new Date().toISOString(), picks };
      return picks;
    }));
    return cdx.get(d);
  };
  if (DRY) mkdirSync("out", { recursive: true });
  // One browser per worker, behind a server handle so it can be killed outright. It is replaced every RECYCLE renders,
  // when a render passes its deadline, and when the machine runs low on memory: on 21 Nov one archived page took
  // 10 GB in 17 minutes and the hosted runner was lost, with the run's log and unsent captures.
  const launch = async () => {
    const server = await chromium.launchServer({ args: ["--disable-dev-shm-usage"] });
    const browser = await chromium.connect(server.wsEndpoint());
    return { browser, kill: async () => { await Promise.race([browser.close().catch(() => {}), sleep(5000)]); await server.kill().catch(() => {}); } };
  };
  const totals = { captured: 0, no_capture: 0, failed: 0, cdx_unknown: 0, tagged: 0, tag_failed: 0, killed: 0, stopped_for_time: false };
  const errors = {};
  let buffer = [], bufBytes = 0;
  const pendingImages = new Map();
  let tagBudgetOut = false;

  const tagOne = async (rec, imgs) => {
    if (tagBudgetOut || !imgs) return;
    const body = { domain: rec.domain, page_type: "home", viewport: "desktop", source: "wayback", captured_at: rec.captured_at, signals_hash: rec.signals_hash, images: imgs };
    if (DRY) { appendFileSync(`out/${RUN_ID}.tags.jsonl`, JSON.stringify({ ...body, images: { fold: imgs.fold.length, sections: imgs.sections.length } }) + "\n"); totals.tagged++; return; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(new URL("library-tag", ENDPOINT), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": SECRET }, body: JSON.stringify(body) }).catch(() => null);
      if (r?.ok) { totals.tagged++; return; }
      if (r?.status === 429 && /budget/i.test(await r.text())) { tagBudgetOut = true; console.log("tagging stopped: AI budget exhausted"); return; }
      if (r && r.status >= 400 && r.status < 500 && r.status !== 429) break;
      await sleep(attempt * 4000);
    }
    totals.tag_failed++;
  };
  const flush = async () => {
    if (!buffer.length) return;
    const snapshots = buffer; buffer = []; bufBytes = 0;
    await post({ kind: "library_snapshots", run_id: RUN_ID, snapshots });
    for (const r of snapshots) { await tagOne(r, pendingImages.get(r)); pendingImages.delete(r); }
  };
  const emit = async (rec, imgs) => {
    const size = JSON.stringify(rec).length;
    if (buffer.length && (bufBytes + size > 1_200_000 || buffer.length >= 5)) await flush();
    buffer.push(rec); bufBytes += size; totals.captured++;
    if (imgs) pendingImages.set(rec, imgs);
  };

  let next = 0, lastLog = Date.now();
  // A line every two minutes, so a run that dies still shows how far it got and what the machine had left.
  const progress = (force = false) => {
    if (!force && Date.now() - lastLog < 120_000) return;
    lastLog = Date.now();
    const why = Object.entries(errors).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n}`).join(", ");
    console.log(`progress ${next}/${queue.length} · captured ${totals.captured} · none ${totals.no_capture} · failed ${totals.failed}${why ? ` (${why})` : ""} · browsers killed ${totals.killed} · ${Math.round((Date.now() - t0) / 60000)} min · rss ${Math.round(process.memoryUsage().rss / 1e6)} MB · free ${Math.round(os.freemem() / 1e6)} MB`);
    saveCache();
  };
  const overBudget = () => Date.now() - t0 > BUDGET_MS;
  const worker = async () => {
    let b = await launch(), renders = 0;
    const replace = async () => { await b.kill(); b = await launch(); renders = 0; };
    try {
    while (next < queue.length) {
      if (overBudget()) { totals.stopped_for_time = true; return; }
      progress();
      const item = queue[next++];
      const picks = await picksFor(item.domain);
      if (picks === null) { totals.cdx_unknown++; continue; }
      const candidates = picks[item.quarter] ?? [];
      if (!candidates.length) { totals.no_capture++; continue; }
      let r = null;
      attempts: for (const ts of candidates) { // nearest mid-quarter first; alternates when the archive render is blank/broken
        // Throttling (429/503/refused) is about the Archive, not the capture: wait out the global back-off and retry it.
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (overBudget()) { totals.stopped_for_time = true; r = r ?? { error: "out_of_time" }; break attempts; }
          if (renders >= RECYCLE || os.freemem() < LOW_MEMORY) await replace();
          renders++;
          // A page that hangs or eats memory never comes back on its own: past the deadline its browser is killed.
          const late = Symbol("late");
          let timer;
          const got = await Promise.race([renderCapture(b.browser, item, ts), new Promise((res) => { timer = setTimeout(() => res(late), RENDER_DEADLINE_MS); })]);
          clearTimeout(timer);
          if (got === late) { totals.killed++; await replace(); r = { error: "render_deadline" }; } else r = got;
          if (!THROTTLED.test(r.error ?? "")) break;
        }
        if (!r.error && blankArchive(r.record.signals)) r = { error: "blank_archive" };
        if (!r.error || THROTTLED.test(r.error)) break;
      }
      if (r.error) {
        totals.failed++; errors[r.error] = (errors[r.error] ?? 0) + 1;
        // The Archive being busy, or the run ending, says nothing about the capture; anything else counts against it.
        if (!THROTTLED.test(r.error) && r.error !== "out_of_time") { const k = `${item.domain}|${item.quarter}`; cache.failed[k] = (cache.failed[k] ?? 0) + 1; }
        continue;
      }
      await emit(r.record, r.images);
    }
    } finally { await b.kill(); }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await flush();
  progress(true);
  const summary = { run_id: RUN_ID, missing: all.length, queue: queue.length, ...totals, errors, minutes: Math.round((Date.now() - t0) / 60000) };
  if (DRY) writeFileSync(`out/${RUN_ID}.summary.json`, JSON.stringify(summary, null, 2));
  console.log("done", JSON.stringify(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
