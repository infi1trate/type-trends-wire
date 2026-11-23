// S1 · time limits, pure: no page waits without limit. A read that passes its limit is answered from what is already in hand (an old
// stored copy, the last health answer) or fails with a short error the page shows as "could not load this part" with a retry.
/** Every reader server function and every late block: answered or failed within this many milliseconds. */
export const READ_DEADLINE_MS = 60_000; // PROOF-TEMP
/** A stored copy past its limit is rebuilt only if the rebuild finishes within this; otherwise the old copy is sent (any age). */
export const STALE_SERVE_MS = 2_500;
/** A late read that has a last good copy on its instance answers with that copy after this long (the library, its history, the front
 *  page's rest), well inside READ_DEADLINE_MS. */
export const LAST_GOOD_MS = 3_000;
/** /api/public/health answers within this whatever the database does. */
export const HEALTH_DEADLINE_MS = 1_800;
export const TIMEOUT = "read_timeout";
export class Timeout extends Error { constructor(what: string, ms: number) { super(`${TIMEOUT}: ${what} took over ${ms} ms`); this.name = "Timeout"; } }

/** `p` or, after `ms`, `late()` (a fallback value) — or a Timeout error when there is no fallback. `p` keeps running either way. */
export function within<T>(p: Promise<T>, ms: number, what: string, late?: () => T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timer = new Promise<T>((resolve, reject) => { t = setTimeout(() => { try { if (late) resolve(late()); else reject(new Timeout(what, ms)); } catch (e) { reject(e); } }, ms); });
  p.catch(() => undefined); // a late rejection after the limit is not an unhandled one
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}
/** Reader server functions that get the time limit (by file): the public pages' reads, never the desk's or the jobs'. */
export const READER_FILES = /(^|\/)(read|views|data-stories|digest|signals|showcase|indicators|library|brand|ledger)\.functions\.ts$/;
export const isReaderFn = (method: string, filename: string | undefined) => method === "GET" && !!filename && READER_FILES.test(filename);
