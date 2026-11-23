// D1c · THE STORY BUILD'S QUICK CHECK (pure). A build loads about 18 s of inputs (forecast rows, a week of changes, their integrity
// checks, history, wire, quiet-change inputs) before it can say "0 new". It now reads a few newest ids first (the print below) and, when
// nothing a story can come from has moved since the last full build, finishes at once. A full build still runs at least every
// FULL_BUILD_EVERY_MS (time-based rules: holds that expire, the census pair, the sliding window), and an unreadable print means a full build.

/** The newest of everything a story is built from or changed by. */
export type BuildPrint = {
  /** library_events (live): new changes, reversals, headline-call candidates. */ events: number | null;
  /** wire_items: news, alerts, launches. */ wire: number | null;
  /** forecast_runs (ok): stages, crossovers, shares. */ runs: number | null;
  /** stories (newest created_at) and story_edits (kills, corrections, releases the writer then writes). */ stories: string | null; edits: number | null;
  /** library_rebrands or change checks are derived from events, so they are covered by `events`. */
};
export const FULL_BUILD_EVERY_MS = 2 * 3_600_000;
export const PRINT_KEYS = ["events", "wire", "runs", "stories", "edits"] as const satisfies readonly (keyof BuildPrint)[];
/** The last full build's print and time, as its finish row stored them. */
export type LastFull = { print: BuildPrint; at: string } | null;

export function quickDecision(last: LastFull, cur: BuildPrint | null, now: number): { skip: true; why: string } | { skip: false; why: string } {
  if (!cur || PRINT_KEYS.some(k => cur[k] == null)) return { skip: false, why: "the newest ids could not be read" };
  if (!last) return { skip: false, why: "no earlier full build on record" };
  const age = now - Date.parse(last.at);
  if (!Number.isFinite(age) || age >= FULL_BUILD_EVERY_MS) return { skip: false, why: "the last full build is over two hours old" };
  const moved = PRINT_KEYS.filter(k => last.print[k] !== cur[k]);
  if (moved.length) return { skip: false, why: `new since the last full build: ${moved.join(", ")}` };
  return { skip: true, why: `nothing new since the full build at ${new Date(Date.parse(last.at)).toISOString().slice(11, 16)} UTC` };
}
/** A stored print read back from a finish row's detail (null when it is not one). */
export function printOf(detail: unknown): BuildPrint | null {
  const p = (detail && typeof detail === "object" ? (detail as { print?: unknown }).print : null) as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null), str = (v: unknown) => (typeof v === "string" ? v : null);
  return { events: num(p["events"]), wire: num(p["wire"]), runs: num(p["runs"]), stories: str(p["stories"]), edits: num(p["edits"]) };
}
