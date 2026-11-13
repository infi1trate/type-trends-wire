// DSGN/TERMINAL library crawler: snapshots the 300 tracked sites over time; the terminal diffs snapshots into events.
// Env: CRAWL_ENDPOINT, CRAWL_SECRET (same as crawl.js), DRY_RUN=1, CONCURRENCY (default 6),
//      LIBRARY_MODE=full|check  full = weekly: discover pages, snapshot everything (desktop all pages, mobile home)
//                               check = daily: fetch server HTML, snapshot only pages whose html_hash moved
//                               tag   = one-off: re-snapshot every home page (desktop) and send it for AI tagging
//      LIBRARY_FILE (default seeds/library.csv), LIMIT (first N sites), STATE_FILE (dry-run state), ALLOW_HTTP=1 (tests)
//                               wayback = 5-year history: one archived homepage per half-year since FROM_YEAR (default 2021),
//                                         rendered via the Wayback Machine, posted as source=wayback (+ tagged)
//      SECTOR (only this sector), WAYBACK_BASE (tests), WAYBACK_DELAY_MS (default 2500, politeness between archive loads)
//      LIBRARY_TAG=0 disables image capture/tagging (default on). Images go to /api/public/library-tag and are never stored.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { VIEWPORTS, UA, makePoster, robotsOk, openPage, analyzePage, evalSettled, errorCode } from "./core.js";
import { extractLibraryExtras } from "./extract-library.js";
import { parseLibrary, discoverPages, htmlHash, contentHash, signalsHash, pickCaptures } from "./library-lib.js";
import sharp from "sharp";

const MODE = process.env.LIBRARY_MODE ?? "full";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const DRY = process.env.DRY_RUN === "1";
const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const ALLOW_HTTP = process.env.ALLOW_HTTP === "1";
const LIMIT = Number(process.env.LIMIT ?? 0);
const RUN_ID = process.env.RUN_ID ?? `lib-${MODE}-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;
const post = makePoster({ endpoint: ENDPOINT, secret: SECRET, dry: DRY, runId: RUN_ID });
const TEXT_PAGES = new Set(["pricing", "changelog", "about", "home", "product"]);
const TAG = process.env.LIBRARY_TAG !== "0";
const SECTOR = process.env.SECTOR || null;
const WAYBACK_BASE = (process.env.WAYBACK_BASE ?? "https://web.archive.org").replace(/\/$/, "");
const WAYBACK_DELAY_MS = Number(process.env.WAYBACK_DELAY_MS ?? 2500);
const FROM_YEAR = Number(process.env.FROM_YEAR ?? 2021);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdx(domain) {
  const url = `${WAYBACK_BASE}/cdx/search/cdx?url=${encodeURIComponent(domain + "/")}&output=json&from=${FROM_YEAR}&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:8&fl=timestamp,original,statuscode&limit=4000`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(45000) }).catch(() => null);
    if (r?.ok) return r.json().catch(() => []);
    await sleep(attempt * (r?.status === 429 ? 30000 : 5000));
  }
  throw new Error("cdx_unavailable");
}

/** Fold (960w) + up to 4 page sections below it (each 2 viewports tall, 720w) as JPEG data URLs, for transient
 *  AI tagging. Never written to disk; dropped from memory once the tag request returns. */
async function captureImages(page) {
  const { width, height } = page.viewportSize();
  const total = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => height);
  const h = Math.min(total, height * 9);
  // Walk the page once so lazy images below the fold load, then return to the top.
  for (let y = height; y < h; y += height) { await page.evaluate((yy) => window.scrollTo(0, yy), y).catch(() => {}); await page.waitForTimeout(250); }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(500);
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

async function getState() {
  if (DRY) return process.env.STATE_FILE ? JSON.parse(readFileSync(process.env.STATE_FILE, "utf8")) : { sites: [] };
  const r = await fetch(new URL("library-state", ENDPOINT), { headers: { "x-crawl-secret": SECRET } });
  if (!r.ok) throw new Error(`library-state ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function fetchHtmlHash(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) return null;
    return htmlHash(await r.text());
  } catch { return null; }
}

/** Render one URL in an open page and build a snapshot record (or { error }). */
async function snapshot(page, { domain, page_type, viewport, url, archive = null }) {
  const started = Date.now();
  const path = new URL(url).pathname || "/";
  if (!archive && !(await robotsOk(new URL(url).origin, path))) return { error: "robots_disallow" };
  try {
    const err = await openPage(page, archive ? archive.wayback_url : url);
    if (err) return { error: err };
    const a = await analyzePage(page, { started });
    if (!a.ok) return { error: a.error };
    const x = await evalSettled(page, extractLibraryExtras);
    const { ok, final_url, ...fields } = a;
    const signals = { ...fields, css_features: x.css_features, prices: x.prices, nav: x.nav, skeleton: x.skeleton, page: { w: x.page_w, h: x.page_h }, ...(archive ? { archive } : {}) };
    const images = TAG && page_type === "home" && viewport === "desktop" ? await captureImages(page).catch(() => null) : null;
    return {
      links: x.links, images,
      record: {
        domain, page_type, viewport, source: archive ? "wayback" : "live",
        captured_at: archive ? archive.iso : new Date().toISOString(), url: archive ? archive.original : final_url,
        html_hash: archive ? null : await fetchHtmlHash(url), content_hash: contentHash(x.text), signals_hash: signalsHash(signals),
        signals,
        ...(!archive && viewport === "desktop" && TEXT_PAGES.has(page_type) && x.text ? { raw_text: x.text } : {}),
      },
    };
  } catch (e) { return { error: errorCode(e) }; }
}

/** Decide which page:viewport keys to snapshot for one site. */
async function plan(site, latest, pages, origin) {
  const known = { home: origin + "/", ...(pages ?? {}) };
  if (MODE === "tag") return { discover: false, jobs: [{ page_type: "home", viewport: "desktop", url: known.home }], known };
  if (MODE === "full" || !latest || !Object.keys(latest).length) return { discover: true, jobs: null, known };
  const jobs = [];
  for (const [type, url] of Object.entries(known)) {
    const prev = latest[`${type}:desktop`];
    if (!prev) continue; // never captured (404, robots): the weekly full run retries it
    const now = await fetchHtmlHash(url);
    if (now && now !== prev.html_hash) {
      jobs.push({ page_type: type, viewport: "desktop", url });
      if (type === "home") jobs.push({ page_type: "home", viewport: "mobile", url });
    }
  }
  return { discover: false, jobs, known };
}

async function crawlWayback(browser, site, st, emit, errors) {
  const picks = pickCaptures(await cdx(site.domain), { fromYear: FROM_YEAR, have: st?.wayback ?? [] });
  if (!picks.length) return { skipped: true };
  const ctx = await browser.newContext({ ...VIEWPORTS.desktop, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let n = 0;
  try {
    for (const p of picks) {
      const wayback_url = `${WAYBACK_BASE}/web/${p.timestamp}if_/${p.original}`;
      const r = await snapshot(page, { domain: site.domain, page_type: "home", viewport: "desktop", url: p.original, archive: { timestamp: p.timestamp, wayback_url, iso: p.iso, original: p.original, bucket: p.bucket } });
      if (r.error) errors[`wayback:${r.error}`] = (errors[`wayback:${r.error}`] ?? 0) + 1;
      else {
        const { iso, original, ...archiveMeta } = r.record.signals.archive; // keep signals.archive = {timestamp, wayback_url, bucket}
        r.record.signals.archive = archiveMeta;
        await emit(r.record, r.images); n++;
      }
      await sleep(WAYBACK_DELAY_MS);
    }
    return n ? { snapshots: n } : { error: "no_archive_renders" };
  } finally { await ctx.close().catch(() => {}); }
}

async function crawlSite(browser, site, st, emitRaw, errors) {
  if (MODE === "wayback") return crawlWayback(browser, site, st, emitRaw, errors);
  const origin = (ALLOW_HTTP ? "http://" : "https://") + site.domain;
  // Unchanged since the last stored snapshot (same design signals and same text): don't store a duplicate.
  const emit = async (rec, images) => {
    const prev = st?.latest?.[`${rec.page_type}:${rec.viewport}`];
    if (MODE !== "tag" && prev && prev.signals_hash === rec.signals_hash && prev.content_hash === rec.content_hash && !rec.discovered_pages) return emitRaw(null);
    return emitRaw(rec, images);
  };
  const { discover, jobs: planned, known } = await plan(site, st?.latest, st?.pages, origin);
  if (planned && !planned.length) return { skipped: true };
  const ctx = { desktop: null, mobile: null };
  const pageFor = async (vp) => {
    if (!ctx[vp]) { ctx[vp] = await browser.newContext({ ...VIEWPORTS[vp], deviceScaleFactor: 1, locale: "en-US", reducedMotion: "reduce" }); ctx[vp].page = await ctx[vp].newPage(); }
    return ctx[vp].page;
  };
  let n = 0;
  try {
    let jobs = planned;
    if (discover) {
      const home = await snapshot(await pageFor("desktop"), { domain: site.domain, page_type: "home", viewport: "desktop", url: origin + "/" });
      if (home.error) { errors[home.error] = (errors[home.error] ?? 0) + 1; return { error: home.error }; }
      const found = discoverPages(home.links, home.record.url || origin + "/");
      home.record.discovered_pages = found;
      await emit(home.record, home.images); n++;
      jobs = [...Object.entries({ ...known, ...found }).filter(([t]) => t !== "home").map(([page_type, url]) => ({ page_type, viewport: "desktop", url })), { page_type: "home", viewport: "mobile", url: origin + "/" }];
    }
    for (const j of jobs) {
      const r = await snapshot(await pageFor(j.viewport), { domain: site.domain, ...j });
      if (r.error) { errors[`${j.page_type}:${r.error}`] = (errors[`${j.page_type}:${r.error}`] ?? 0) + 1; continue; }
      await emit(r.record, r.images); n++;
    }
    return { snapshots: n };
  } finally {
    for (const c of Object.values(ctx)) if (c) await c.close().catch(() => {});
  }
}

async function main() {
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  let sites = parseLibrary(readFileSync(process.env.LIBRARY_FILE ?? new URL("../seeds/library.csv", import.meta.url).pathname, "utf8"));
  await post({ kind: "library_sync", sites });
  if (SECTOR) sites = sites.filter((s) => s.sector === SECTOR);
  if (LIMIT) sites = sites.slice(0, LIMIT);
  const state = await getState();
  const byDomain = Object.fromEntries((state.sites ?? []).map((s) => [s.domain, s]));
  console.log(`run ${RUN_ID}: mode=${MODE}, ${sites.length} sites, state for ${Object.keys(byDomain).length}`);

  if (DRY) mkdirSync("out", { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  let buffer = [], bufBytes = 0;
  const totals = { snapshots: 0, unchanged: 0, events: 0, sites_ok: 0, sites_failed: 0, sites_skipped: 0, tagged: 0, tag_reused: 0, tag_failed: 0 };
  const errors = {};
  const images = new Map(); // record -> images, released once tagged
  let tagBudgetOut = false;
  const tagOne = async (rec, imgs) => {
    if (tagBudgetOut) return;
    const body = { domain: rec.domain, page_type: rec.page_type, viewport: rec.viewport, source: rec.source, captured_at: rec.captured_at, signals_hash: rec.signals_hash, images: imgs };
    if (DRY) { appendFileSync(`out/${RUN_ID}.tags.jsonl`, JSON.stringify({ ...body, images: { fold: imgs.fold.length, sections: imgs.sections.map((x) => x.length) } }) + "\n"); totals.tagged++; return; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(new URL("library-tag", ENDPOINT), { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": SECRET }, body: JSON.stringify(body) }).catch(() => null);
      if (r?.ok) { const j = await r.json().catch(() => ({})); if (j.reused) totals.tag_reused++; else totals.tagged++; return; }
      if (r?.status === 429 && /budget/i.test(await r.text())) { tagBudgetOut = true; console.log("tagging stopped: AI budget exhausted"); return; }
      if (r && r.status >= 400 && r.status < 500 && r.status !== 429) break;
      await new Promise((s) => setTimeout(s, attempt * 4000));
    }
    totals.tag_failed++;
  };
  const flush = async () => {
    if (!buffer.length) return;
    const snapshots = buffer; buffer = []; bufBytes = 0;
    const res = await post({ kind: "library_snapshots", run_id: RUN_ID, snapshots });
    totals.events += res?.events ?? 0;
    // Tag only after the snapshots exist server-side; images are dropped from memory right after.
    const todo = snapshots.filter((r) => images.has(r));
    for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map((r) => tagOne(r, images.get(r)).finally(() => images.delete(r))));
  };
  const emit = async (rec, imgs) => {
    if (!rec) { totals.unchanged++; return; }
    if (imgs) images.set(rec, imgs);
    // Server caps a request at 2 MB and a batch at 25 snapshots.
    const size = JSON.stringify(rec).length;
    if (buffer.length && (bufBytes + size > 1_200_000 || buffer.length >= 25)) await flush();
    buffer.push(rec); bufBytes += size; totals.snapshots++;
  };

  let next = 0;
  const worker = async () => {
    while (next < sites.length) {
      const site = sites[next++];
      const r = await crawlSite(browser, site, byDomain[site.domain], emit, errors).catch((e) => ({ error: errorCode(e) }));
      if (r.skipped) totals.sites_skipped++; else if (r.error) totals.sites_failed++; else totals.sites_ok++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await flush();
  await browser.close();
  const summary = { run_id: RUN_ID, mode: MODE, ...totals, errors };
  if (DRY) writeFileSync(`out/${RUN_ID}.summary.json`, JSON.stringify(summary, null, 2));
  console.log("done", JSON.stringify(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
