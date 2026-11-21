// N1 · the newsroom's memory as one response (pure part): what a desk session reads at its start. It must stay under 200 KB; when
// it would not, the oldest desk-log rows go first and the response says how many were left out.
export const MEMORY_MAX_BYTES = 200_000;
export const MEMORY_LOG_DAYS = 14;
const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
export function fitMemory<T extends { log: unknown[] }>(m: T, max = MEMORY_MAX_BYTES): T & { bytes: number; log_left_out: number } {
  let log = m.log, left = 0;
  const of = () => ({ ...m, log, bytes: 0, log_left_out: left });
  // The log is newest first: drop from the end in steps until it fits.
  while (size(of()) > max && log.length) { const step = Math.max(1, Math.ceil(log.length / 10)); log = log.slice(0, log.length - step); left += step; }
  const out = of();
  return { ...out, bytes: size(out) };
}
/** A queue item, slimmed to what a desk needs to pick up the day (the full item stays on the queue action). */
export function slimQueueItem(x: Record<string, unknown>) {
  const pick = ["id", "number", "type", "kicker", "headline", "deck", "state", "reason", "score", "happened_at", "killReason", "pinnedUntil", "correctedAt"] as const;
  return Object.fromEntries(pick.filter(k => x[k] !== undefined).map(k => [k, x[k]]));
}
