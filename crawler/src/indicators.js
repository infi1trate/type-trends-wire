// Leading indicators (roadmap W2): once a day, read two public numbers for each tracked UI library and post them to slug as
// dated points. npm's weekly downloads (api.npmjs.org, public) say how much a library is being installed; GitHub's repository
// record (api.github.com, public) gives stars, forks and open issues. Numbers only: no code, pages or user data are read.
// Env: CRAWL_ENDPOINT (…/api/public/ingest-crawl; this posts to its sibling ingest-series), CRAWL_SECRET, DRY_RUN=1 to print,
// GITHUB_TOKEN (optional, raises GitHub's rate limit), NPM_API / GITHUB_API (test overrides), SEEDS (path to the list).
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makePoster } from "./core.js";

export const SERIES_LIMITS = { batch: 200, timeoutMs: 15_000, tries: 3, gapMs: 150 };
const UA = "slugbot/0.1 (+https://slug.global)";
const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The seed list, checked: label and topic are required, npm and repo are optional but one of them must be there. */
export function readSeeds(rows) {
  if (!Array.isArray(rows)) throw new Error("indicator seeds must be a list");
  const seen = new Set();
  return rows.map((r, i) => {
    const label = String(r?.label ?? "").trim(), topic = String(r?.topic ?? "").trim().toLowerCase();
    const npm = r?.npm ? String(r.npm).trim() : null, repo = r?.repo ? String(r.repo).trim() : null;
    if (!label || !topic) throw new Error(`seed ${i}: label and topic are required`);
    if (!npm && !repo) throw new Error(`seed ${i} (${label}): needs npm or repo`);
    if (npm && !NPM_NAME.test(npm)) throw new Error(`seed ${i} (${label}): bad npm name`);
    if (repo && !REPO_NAME.test(repo)) throw new Error(`seed ${i} (${label}): bad repo name`);
    for (const k of [npm && `npm:${npm}`, repo && `github:${repo.toLowerCase()}`]) { if (!k) continue; if (seen.has(k)) throw new Error(`seed ${i} (${label}): ${k} listed twice`); seen.add(k); }
    return { label, topic, npm, repo };
  });
}

const whole = (n) => (Number.isInteger(n) && n >= 0 ? n : null);
const point = (source, key, metric, value, period_end, seed) => ({ source, key, metric, value, period_end, label: seed.label, topic: seed.topic });

/** npm's answer for one package → one point, or null when the answer is not a usable count. */
export function npmPoint(seed, body) {
  const value = whole(body?.downloads), end = typeof body?.end === "string" ? body.end.slice(0, 10) : "";
  return value != null && DAY.test(end) && seed.npm ? point("npm", seed.npm, "downloads_week", value, end, seed) : null;
}
/** GitHub's repository record → up to three points dated today (UTC). The key is the name we track, so a renamed repo keeps its series. */
export function githubPoints(seed, body, today) {
  if (!seed.repo || !body || typeof body !== "object" || !DAY.test(today)) return [];
  return [["stars", body.stargazers_count], ["forks", body.forks_count], ["open_issues", body.open_issues_count]]
    .map(([metric, v]) => [metric, whole(v)]).filter(([, v]) => v != null)
    .map(([metric, v]) => point("github", seed.repo.toLowerCase(), metric, v, today, seed));
}
export const batches = (xs, n = SERIES_LIMITS.batch) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** GET JSON with a few patient tries. 404 means "not there" (null); rate limits and server errors wait and retry; anything else throws. */
export async function getJson(url, { headers = {}, tries = SERIES_LIMITS.tries, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last = "no answer";
  for (let attempt = 1; attempt <= tries; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json", ...headers }, signal: AbortSignal.timeout(SERIES_LIMITS.timeoutMs) }).catch((e) => ({ ok: false, status: 0, statusText: String(e?.message ?? e) }));
    if (r.ok) return r.json().catch(() => null);
    if (r.status === 404) return null;
    last = `${r.status} ${r.statusText ?? ""}`.trim();
    if (!(r.status === 0 || r.status === 403 || r.status === 429 || r.status >= 500)) break;
    if (attempt < tries) await wait(attempt * 2000);
  }
  throw new Error(last);
}

/** Read every seed. One library failing never stops the rest; failures are returned so the run can say what it skipped. */
export async function collect(seeds, { npmApi, githubApi, token, today, wait, gapMs = SERIES_LIMITS.gapMs } = {}) {
  const points = [], skipped = [], pause = wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const gh = token ? { authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" } : {};
  for (const seed of seeds) {
    if (seed.npm) {
      try { const p = npmPoint(seed, await getJson(`${npmApi}/downloads/point/last-week/${seed.npm}`, { wait })); p ? points.push(p) : skipped.push({ key: `npm:${seed.npm}`, why: "no count" }); }
      catch (e) { skipped.push({ key: `npm:${seed.npm}`, why: String(e.message).slice(0, 80) }); }
    }
    if (seed.repo) {
      try { const ps = githubPoints(seed, await getJson(`${githubApi}/repos/${seed.repo}`, { headers: gh, wait }), today); ps.length ? points.push(...ps) : skipped.push({ key: `github:${seed.repo}`, why: "no record" }); }
      catch (e) { skipped.push({ key: `github:${seed.repo}`, why: String(e.message).slice(0, 80) }); }
    }
    if (gapMs) await pause(gapMs);
  }
  return { points, skipped };
}

async function main() {
  const DRY = process.env.DRY_RUN === "1", ENDPOINT = process.env.CRAWL_ENDPOINT, SECRET = process.env.CRAWL_SECRET;
  if (!DRY && (!ENDPOINT || !SECRET)) throw new Error("Set CRAWL_ENDPOINT and CRAWL_SECRET, or DRY_RUN=1");
  const now = new Date(), runId = `indicators-${now.toISOString().replace(/[:.]/g, "-")}`;
  const seeds = readSeeds(JSON.parse(readFileSync(process.env.SEEDS ?? fileURLToPath(new URL("../seeds/indicators.json", import.meta.url)), "utf8")));
  const { points, skipped } = await collect(seeds, {
    npmApi: process.env.NPM_API ?? "https://api.npmjs.org", githubApi: process.env.GITHUB_API ?? "https://api.github.com",
    token: process.env.GITHUB_TOKEN || null, today: now.toISOString().slice(0, 10),
  });
  // A run that reads almost nothing is a broken run, not a quiet day: fail loudly so the watchdog sees it.
  if (points.length < seeds.length / 2) throw new Error(`only ${points.length} points from ${seeds.length} libraries; first skips: ${JSON.stringify(skipped.slice(0, 5))}`);
  const post = makePoster({ endpoint: DRY ? "" : new URL("ingest-series", ENDPOINT).toString(), secret: SECRET, dry: DRY, runId });
  for (const b of batches(points)) await post({ run_id: runId, captured_at: now.toISOString(), points: b });
  console.log(JSON.stringify({ run_id: runId, libraries: seeds.length, points: points.length, skipped }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
