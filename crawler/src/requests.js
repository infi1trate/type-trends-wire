// DSGN/TERMINAL render queue: renders URLs the public "critique" tool could only analyse in LITE mode
// (declared CSS), and reports rendered design signals back so later critiques use real measurements.
// Env: CRAWL_ENDPOINT (…/api/public/ingest-crawl; the queue lives next to it at crawl-requests), CRAWL_SECRET,
//      LIMIT (1..25, default 10), DRY_RUN=1 (read the queue, render, print; post nothing), QUEUE_FILE (tests: JSON
//      {requests:[…]} instead of GET), ALLOW_PRIVATE=1 (tests only: local fixture server).
// URLs come from anonymous public users, so each one is treated as untrusted: http(s) on standard ports only,
// every hostname must resolve to public addresses, every in-page request to a private/loopback host is aborted,
// robots.txt is honoured for the exact path, and the usual adult/gambling filters apply.
import { chromium } from "playwright";
import { lookup } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { VIEWPORTS, robotsOk, openPage, analyzePage, errorCode } from "./core.js";

const ENDPOINT = process.env.CRAWL_ENDPOINT;
const SECRET = process.env.CRAWL_SECRET;
const DRY = process.env.DRY_RUN === "1";
const LIMIT = Math.min(25, Math.max(1, Number(process.env.LIMIT ?? 10) || 10));
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE === "1";
const SIGNALS_MAX = 56 * 1024; // queue POST body cap is 64 KB

/** True for addresses a public crawler must never reach. */
export function privateAddress(ip) {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v.includes(":")) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return privateAddress(mapped[1]);
    return v === "::" || v === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(v) || v.startsWith("2001:db8:") || v.startsWith("64:ff9b:");
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) || a >= 224;
}

/** Validates scheme/port/host shape. Returns a URL or throws a short error code. */
export function checkUrl(raw, { allowPrivate = ALLOW_PRIVATE } = {}) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("bad_url"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad_scheme");
  if (u.username || u.password) throw new Error("bad_url");
  if (u.port && !["80", "443"].includes(u.port) && !allowPrivate) throw new Error("bad_port");
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!allowPrivate && (h === "localhost" || !h.includes(".") || /\.(localhost|local|internal|test|invalid|home|lan)$/.test(h))) throw new Error("private_host");
  return u;
}

async function publicHost(hostname) {
  if (ALLOW_PRIVATE) return true;
  try {
    const addrs = await lookup(hostname.replace(/^\[|\]$/g, ""), { all: true, verbatim: true });
    return addrs.length > 0 && !addrs.some((a) => privateAddress(a.address));
  } catch { return false; }
}

const queueUrl = () => new URL("crawl-requests", ENDPOINT);
const headers = () => ({ authorization: `Bearer ${SECRET}`, "content-type": "application/json" });

async function readQueue() {
  if (process.env.QUEUE_FILE) return JSON.parse(readFileSync(process.env.QUEUE_FILE, "utf8")).requests ?? [];
  const u = queueUrl(); u.searchParams.set("limit", String(LIMIT));
  const r = await fetch(u, { headers: headers() });
  if (!r.ok) throw new Error(`crawl-requests GET ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).requests ?? [];
}

/** Drop bulky optional detail until the payload fits under the queue's body cap. */
export function fitSignals(signals, max = SIGNALS_MAX) {
  const size = (o) => Buffer.byteLength(JSON.stringify(o));
  if (size(signals) <= max) return signals;
  const s = structuredClone(signals);
  for (const drop of [["layout", "skeleton"], ["lexicon", "nav"], ["lexicon", "ctas"], ["layout", "components"], ["lexicon"]]) {
    let o = s; for (const k of drop.slice(0, -1)) o = o?.[k];
    if (o && drop.at(-1) in o) delete o[drop.at(-1)];
    if (size(s) <= max) return s;
  }
  return null;
}

async function report(result) {
  if (DRY) { console.log(JSON.stringify({ ...result, signals: result.signals ? "(omitted)" : undefined })); return; }
  const r = await fetch(queueUrl(), { method: "POST", headers: headers(), body: JSON.stringify({ results: [result] }) });
  if (!r.ok) console.error(`crawl-requests POST ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function renderOne(browser, raw) {
  const started = Date.now();
  let u;
  try { u = checkUrl(raw); } catch (e) { return { url: raw, status: "error", error: e.message }; }
  if (!(await publicHost(u.hostname))) return { url: raw, status: "error", error: "private_or_unresolvable_host" };
  if (!(await robotsOk(u.origin, u.pathname + u.search))) return { url: raw, status: "error", error: "robots_disallow" };
  const context = await browser.newContext({ ...VIEWPORTS.desktop, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "reduce", serviceWorkers: "block" });
  // Every request the page makes (redirects, subresources) must go to a public host.
  const hostCache = new Map();
  await context.route("**/*", async (route) => {
    let host;
    try {
      const ru = new URL(route.request().url());
      if (!["http:", "https:", "data:", "blob:"].includes(ru.protocol)) return route.abort();
      if (ru.protocol === "data:" || ru.protocol === "blob:") return route.continue();
      host = ru.hostname;
    } catch { return route.abort(); }
    if (!hostCache.has(host)) hostCache.set(host, publicHost(host));
    return (await hostCache.get(host)) ? route.continue() : route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  try {
    const err = await openPage(page, u.href);
    if (err) return { url: raw, status: "error", error: err };
    const r = await analyzePage(page, { started });
    if (!r.ok) return { url: raw, status: "error", error: r.error };
    const { ok, ...signals } = r;
    const fitted = fitSignals(signals);
    return fitted ? { url: raw, status: "done", signals: fitted } : { url: raw, status: "error", error: "signals_too_large" };
  } catch (e) {
    return { url: raw, status: "error", error: errorCode(e).slice(0, 300) };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  if (!process.env.QUEUE_FILE && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET");
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  const queue = (await readQueue()).slice(0, LIMIT);
  console.log(`queue: ${queue.length} pending`);
  if (!queue.length) return;
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const tally = {};
  try {
    for (const item of queue) {
      const result = await renderOne(browser, item.url);
      tally[result.status === "done" ? "done" : result.error] = (tally[result.status === "done" ? "done" : result.error] ?? 0) + 1;
      await report(result);
    }
  } finally { await browser.close(); }
  console.log("done", JSON.stringify(tally));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
