// D1 · THE DATABASE GUARD (pure). One cheap read with a one-second limit says whether the database is answering. Crawler posts and
// jobs ask it first: a slow database gets a quick "try later" (with the seconds to wait) or a job that stands down, never a request
// held open behind it. Readings are kept per server instance for ten minutes (health shows their median and worst).
export const PROBE_LIMIT_MS = 1_000;
/** A reading younger than this is reused instead of asking again (many posts or jobs at once ask once). */
export const PROBE_REUSE_MS = 5_000;
export const PROBE_KEEP_MS = 10 * 60_000;
export type Probe = { at: number; ms: number; ok: boolean };
/** Retry-After for a refused post: a minute, two when most of the last five minutes' readings were slow, at most five. */
export function retryAfterS(recent: readonly Probe[], now: number): number {
  const last5 = recent.filter(p => now - p.at <= 5 * 60_000), slow = last5.filter(p => !p.ok).length;
  return slow >= 5 ? 300 : slow >= 3 ? 120 : 60;
}
export const SKIPPED_SLOW = "skipped: database slow";
/** The answer to a post while the database is slow: 503, Retry-After, and a plain reason. */
export function tryLater(seconds: number, why = "The database is slow right now; nothing was stored."): Response {
  return Response.json({ error: "try_later", retry_after_s: seconds, why }, { status: 503, headers: { "retry-after": String(seconds), "cache-control": "no-store" } });
}
export function keepRecent(list: readonly Probe[], p: Probe, now: number): Probe[] {
  return [...list.filter(x => now - x.at <= PROBE_KEEP_MS), p];
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]! : null; };
/** Median and worst answer time of the readings in the last ten minutes (a failed reading counts as its limit). */
export function answerTimes(list: readonly Probe[], now: number): { n: number; median_ms: number | null; worst_ms: number | null; failed: number } {
  const xs = list.filter(p => now - p.at <= PROBE_KEEP_MS);
  const ms = xs.map(p => (p.ok ? p.ms : Math.max(p.ms, PROBE_LIMIT_MS)));
  return { n: xs.length, median_ms: quantile(ms, 0.5), worst_ms: ms.length ? Math.max(...ms) : null, failed: xs.filter(p => !p.ok).length };
}
