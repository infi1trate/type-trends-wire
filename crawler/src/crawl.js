// DSGN/TERMINAL crawler: renders homepages, extracts design signals, posts them to the terminal.
// Env: CRAWL_ENDPOINT, CRAWL_SECRET, PER_INDEX (default 500), CONCURRENCY (default 6),
//      DRY_RUN=1 (write out/*.jsonl instead of posting), SEEDS_FILE (JSON {mainstream:[], vanguard:[]} to skip seed fetch)
import { chromium } from "playwright";
import { mkdirSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { extractInPage } from "./extract-page.js";
import { paletteFromScreenshot, pickAccent, parseCssColor, contrast, rgbToHex } from "./color.js";
import { homepageAllowed } from "./robots.js";
import { buildSeeds } from "./seeds.js";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 DSGNTerminalBot/0.1 (+https://type-trends-wire.lovable.app)";
const PER_INDEX = Number(process.env.PER_INDEX ?? 500);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const DRY = process.env.DRY_RUN === "1";
const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const RUN_ID = process.env.RUN_ID ?? new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 6);
const ALLOW_HTTP = process.env.ALLOW_HTTP === "1"; // tests only

if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");

async function post(body) {
  if (DRY) { mkdirSync("out", { recursive: true }); appendFileSync(`out/${RUN_ID}.jsonl`, JSON.stringify(body) + "\n"); return; }
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": SECRET }, body: JSON.stringify(body) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok) return;
    const msg = await r.text();
    if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new Error(`ingest rejected (${r.status}): ${msg.slice(0, 300)}`);
    await new Promise((s) => setTimeout(s, attempt * 3000));
  }
  throw new Error("ingest failed after 4 attempts");
}

/** Fonts the browser actually rendered (not the CSS stack), via CDP, per role. */
async function renderedFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const roles = { h1: "h1", h2: "h2", body: "main p, article p, p", nav: "header a, nav a", cta: "button, a[class*=button], a[class*=btn]" };
  const out = {};
  for (const [role, sel] of Object.entries(roles)) {
    try {
      const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: sel });
      const counts = new Map();
      for (const nodeId of nodeIds.slice(0, 12)) {
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }).catch(() => ({ fonts: [] }));
        for (const f of fonts) counts.set(f.familyName, (counts.get(f.familyName) ?? 0) + f.glyphCount);
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      if (ranked.length) out[role] = { family: ranked[0][0], glyphs: ranked[0][1], also: ranked.slice(1, 3).map(([f]) => f) };
    } catch { /* selector absent */ }
  }
  await cdp.detach().catch(() => {});
  return out;
}

async function robotsOk(origin) {
  try {
    const r = await fetch(origin + "/robots.txt", { headers: { "user-agent": UA }, signal: AbortSignal.timeout(6000) });
    return r.ok ? homepageAllowed(await r.text()) : true;
  } catch { return true; }
}

async function crawlOne(browser, domain, index) {
  const started = Date.now();
  const origin = domain.startsWith("http") ? domain.replace(/\/$/, "") : (ALLOW_HTTP ? "http://" : "https://") + domain;
  const base = { run_id: RUN_ID, domain: domain.replace(/^https?:\/\//, "").replace(/^www\./, ""), index, crawled_at: new Date().toISOString() };
  if (!(await robotsOk(origin))) return { ...base, ok: false, error: "robots_disallow" };
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const res = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 25000 });
    if (!res || res.status() >= 400) return { ...base, ok: false, error: `http_${res?.status() ?? "none"}` };
    if (!(res.headers()["content-type"] ?? "").includes("html")) return { ...base, ok: false, error: "not_html" };
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(1200);
    const signals = await page.evaluate(extractInPage);
    if (signals.adult) return { ...base, ok: false, error: "adult" };
    const fonts = await renderedFonts(page);
    const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
    const bg = parseCssColor(signals.colors_declared.page_bg);
    const pal = await paletteFromScreenshot(shot, bg);
    const fg = parseCssColor(signals.colors_declared.body_text);
    return {
      ...base, ok: true, final_url: page.url(),
      title: signals.title, lang: signals.lang,
      type: { rendered: fonts, declared: signals.type_declared },
      color: { ...pal, page_bg: bg ? rgbToHex(bg) : null, accent: pickAccent(signals.colors_declared.cta_bgs, pal.palette), body_contrast: bg && fg ? contrast(bg, fg) : null },
      layout: signals.layout,
      composition: { ...signals.composition, whitespace_ratio: pal.whitespace_ratio },
      lexicon: signals.lexicon,
      tech: { ...signals.tech, load_ms: Date.now() - started },
    };
  } catch (e) {
    const msg = String(e.message || e);
    const code = /net::(ERR_[A-Z_]+)/.exec(msg)?.[1] ?? (/Timeout/i.test(msg) ? "timeout" : msg.split("\n")[0].replace(/https?:\S+/g, "").slice(0, 80));
    return { ...base, ok: false, error: code };
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

main().catch((e) => { console.error(e); process.exit(1); });
