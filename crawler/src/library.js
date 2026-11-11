// DSGN/TERMINAL library crawler: snapshots the 300 tracked sites over time; the terminal diffs snapshots into events.
// Env: CRAWL_ENDPOINT, CRAWL_SECRET (same as crawl.js), DRY_RUN=1, CONCURRENCY (default 6),
//      LIBRARY_MODE=full|check  full = weekly: discover pages, snapshot everything (desktop all pages, mobile home)
//                               check = daily: fetch server HTML, snapshot only pages whose html_hash moved
//      LIBRARY_FILE (default seeds/library.csv), LIMIT (first N sites), STATE_FILE (dry-run state), ALLOW_HTTP=1 (tests)
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { VIEWPORTS, UA, makePoster, robotsOk, openPage, analyzePage, evalSettled, errorCode } from "./core.js";
import { extractLibraryExtras } from "./extract-library.js";
import { parseLibrary, discoverPages, htmlHash, contentHash, signalsHash } from "./library-lib.js";

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
async function snapshot(page, { domain, page_type, viewport, url }) {
  const started = Date.now();
  const path = new URL(url).pathname || "/";
  if (!(await robotsOk(new URL(url).origin, path))) return { error: "robots_disallow" };
  try {
    const err = await openPage(page, url);
    if (err) return { error: err };
    const a = await analyzePage(page, { started });
    if (!a.ok) return { error: a.error };
    const x = await evalSettled(page, extractLibraryExtras);
    const { ok, final_url, ...fields } = a;
    const signals = { ...fields, css_features: x.css_features, prices: x.prices, nav: x.nav, skeleton: x.skeleton, page: { w: x.page_w, h: x.page_h } };
    return {
      links: x.links,
      record: {
        domain, page_type, viewport, source: "live", captured_at: new Date().toISOString(), url: final_url,
        html_hash: await fetchHtmlHash(url), content_hash: contentHash(x.text), signals_hash: signalsHash(signals),
        signals,
        ...(viewport === "desktop" && TEXT_PAGES.has(page_type) && x.text ? { raw_text: x.text } : {}),
      },
    };
  } catch (e) { return { error: errorCode(e) }; }
}

/** Decide which page:viewport keys to snapshot for one site. */
async function plan(site, latest, pages, origin) {
  const known = { home: origin + "/", ...(pages ?? {}) };
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

async function crawlSite(browser, site, st, emitRaw, errors) {
  const origin = (ALLOW_HTTP ? "http://" : "https://") + site.domain;
  // Unchanged since the last stored snapshot (same design signals and same text): don't store a duplicate.
  const emit = async (rec) => {
    const prev = st?.latest?.[`${rec.page_type}:${rec.viewport}`];
    if (prev && prev.signals_hash === rec.signals_hash && prev.content_hash === rec.content_hash && !rec.discovered_pages) return emitRaw(null);
    return emitRaw(rec);
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
      await emit(home.record); n++;
      jobs = [...Object.entries({ ...known, ...found }).filter(([t]) => t !== "home").map(([page_type, url]) => ({ page_type, viewport: "desktop", url })), { page_type: "home", viewport: "mobile", url: origin + "/" }];
    }
    for (const j of jobs) {
      const r = await snapshot(await pageFor(j.viewport), { domain: site.domain, ...j });
      if (r.error) { errors[`${j.page_type}:${r.error}`] = (errors[`${j.page_type}:${r.error}`] ?? 0) + 1; continue; }
      await emit(r.record); n++;
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
  if (LIMIT) sites = sites.slice(0, LIMIT);
  const state = await getState();
  const byDomain = Object.fromEntries((state.sites ?? []).map((s) => [s.domain, s]));
  console.log(`run ${RUN_ID}: mode=${MODE}, ${sites.length} sites, state for ${Object.keys(byDomain).length}`);

  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  let buffer = [], bufBytes = 0;
  const totals = { snapshots: 0, unchanged: 0, events: 0, sites_ok: 0, sites_failed: 0, sites_skipped: 0 };
  const errors = {};
  const flush = async () => {
    if (!buffer.length) return;
    const snapshots = buffer; buffer = []; bufBytes = 0;
    const res = await post({ kind: "library_snapshots", run_id: RUN_ID, snapshots });
    totals.events += res?.events ?? 0;
  };
  const emit = async (rec) => {
    if (!rec) { totals.unchanged++; return; }
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
