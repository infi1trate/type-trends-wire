// N1 · the spend ledger's week and cap (pure). A week runs Monday 00:00 to Sunday 24:00, America/New_York. The cap is set only by the
// owner; until it is set nothing is blocked. When either number reaches its cap, writer runs and desk actions that cost are refused.
export type SpendStatus = {
  week_start: string; model_usd: number; build_credits: number;
  by_kind: { kind: string; model: string; calls: number; usd: number }[];
  cap: { model_usd: number | null; build_credits: number | null; set_at: string } | null;
};
export const capReached = (s: Pick<SpendStatus, "model_usd" | "build_credits" | "cap">): boolean =>
  !!s.cap && ((s.cap.model_usd != null && s.model_usd >= s.cap.model_usd) || (s.cap.build_credits != null && s.build_credits >= s.cap.build_credits));
/** Reader model calls (the crawler's AI reads) and writer calls (story_why = the three writers' shared purpose). */
export const WRITER_KINDS: ReadonlySet<string> = new Set(["story_why"]);
export function spendSplit(s: Pick<SpendStatus, "by_kind">) {
  let writers = 0, readers = 0;
  for (const k of s.by_kind) (WRITER_KINDS.has(k.kind) ? (writers += k.usd) : (readers += k.usd));
  return { writers: Math.round(writers * 1e4) / 1e4, readers: Math.round(readers * 1e4) / 1e4 };
}
/** Monday 00:00 America/New_York for an instant, as an ISO instant (DST-safe without a time-zone library). */
export function etWeekStart(now: number): string {
  const parts = (t: number) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date(t)).map(p => [p.type, p.value]));
  const p = parts(now), dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p["weekday"]!);
  // The local date of that Monday, then find the instant whose New York wall clock reads 00:00 on it (offset is −4 or −5 hours).
  const local = Date.UTC(Number(p["year"]), Number(p["month"]) - 1, Number(p["day"])) - dow * 864e5;
  for (const off of [4, 5]) { const t = local + off * 36e5, q = parts(t); if (q["hour"] === "00" && q["minute"] === "00" && Date.UTC(Number(q["year"]), Number(q["month"]) - 1, Number(q["day"])) === local) return new Date(t).toISOString(); }
  return new Date(local + 5 * 36e5).toISOString();
}
/** The sentence health and the desk show. */
export function capLine(s: Pick<SpendStatus, "model_usd" | "build_credits" | "cap">): string {
  if (!s.cap) return "No weekly cap is set; nothing is blocked.";
  return capReached(s) ? "The weekly cap is reached: writer runs and desk actions that cost wait until Monday (Eastern time)." : "Under the weekly cap.";
}
