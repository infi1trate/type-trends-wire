// The crawler's manners toward the site's database (D1, 23 Nov 2026). On 23 Nov the database stopped answering for 92 minutes while
// the archive backfill posted every two to four minutes into a site that was already struggling. Three rules now hold for every post:
//   1. Ask first. Before a post, read /api/public/health. If the site says its database is slow, or does not answer, wait and ask
//      again (30 s, 60 s, 120 s, then every 120 s). After SITE_WAIT_MAX_MIN (default 20) of waiting the run stops with a clear error,
//      so the watchdog opens an issue instead of the crawler piling work onto a database that cannot take it.
//   2. Leave a gap. Posts from one process are at least POST_GAP_MS apart (default 1500; the backfill sets more).
//   3. Take "try later" at its word. A 429 or 503 with Retry-After is waited out (capped at five minutes), not retried at once.
// A health answer is reused for 20 s, so a burst of posts costs one health read. DRY runs never ask.
export const GATE = { gapMs: Number(process.env.POST_GAP_MS ?? 1500), maxWaitMs: Number(process.env.SITE_WAIT_MAX_MIN ?? 20) * 60_000, reuseMs: 20_000, healthTimeoutMs: 6000, waits: [30_000, 60_000, 120_000] };

/** What a health answer means for a crawler: go, or wait (with the reason in plain words). */
export function readHealth(status, body) {
  if (status === 0) return { go: false, why: "the site did not answer its health check" };
  if (status >= 500) return { go: false, why: `the health check answered ${status}` };
  const db = body?.database?.status;
  if (db === "slow" || db === "bad" || db === "down") return { go: false, why: `the site says its database is ${db}` };
  if (body?.safe_mode === true || body?.safe_mode?.on === true || body?.db?.safe_mode?.on === true) return { go: false, why: "the site is in safe mode" };
  if (body?.db?.answer?.state === "bad") return { go: false, why: "the site says its database is answering badly" };   // D1's health lines; "warn" still posts
  return { go: true, why: "ok" };   // an old job being stale is not a reason to stop posting; a slow database is
}
export const healthUrl = (endpoint) => new URL("/api/public/health", endpoint).toString();
/** Seconds a server asked us to wait, from Retry-After (seconds or a date); null when it did not say. Capped at 300. */
export function retryAfterMs(header, now = Date.now()) {
  if (!header) return null; const n = Number(header);
  const ms = Number.isFinite(n) ? n * 1000 : (Date.parse(header) - now);
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 300_000) : null;
}

export function makeGate({ endpoint, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), log = console.log, limits = GATE } = {}) {
  let last = { at: -Infinity, go: false }, lastPost = -Infinity;
  async function ask() {
    const r = await fetchImpl(healthUrl(endpoint), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(limits.healthTimeoutMs) }).catch(() => null);
    const body = r ? await r.json().catch(() => null) : null;
    return readHealth(r ? r.status : 0, body);
  }
  /** Resolves when the site is ready for a post; throws when it stayed unready for the whole wait. */
  return async function ready() {
    const gap = limits.gapMs - (now() - lastPost); if (gap > 0) await sleep(gap);
    if (!(last.go && now() - last.at < limits.reuseMs)) {
      const started = now(); let n = 0;
      for (;;) {
        const h = await ask(); last = { at: now(), go: h.go };
        if (h.go) break;
        const waited = now() - started;
        if (waited >= limits.maxWaitMs) throw new Error(`site not ready after ${Math.round(waited / 60_000)} min (${h.why}); stopping so nothing is posted into a struggling database`);
        const w = limits.waits[Math.min(n++, limits.waits.length - 1)];
        log(`waiting ${Math.round(w / 1000)} s before posting: ${h.why}`);
        await sleep(w);
      }
    }
    lastPost = now();
  };
}
/** One gate per endpoint per process, so every poster in a run shares the same gap and the same health answer. */
const gates = new Map();
export function gateFor(endpoint) {
  const key = new URL("/", endpoint).origin;
  if (!gates.has(key)) gates.set(key, makeGate({ endpoint }));
  return gates.get(key);
}
