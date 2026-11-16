// Which stored forecast runs may be compared with each other. Pure, no I/O.
// The forecast is weekly. Two runs closer together than MIN_RUN_GAP_DAYS are a rerun of our own pipeline, not a week of the world,
// so a stage or share change between them is not news. Every surface that shows a run-to-run change uses comparisonPair.

/** The forecast is weekly; anything closer together is a rerun. */
export const MIN_RUN_GAP_DAYS = 6;
/** A run is real when the weekly brief, a chart card or the forecast ledger recorded it; sandbox (DEV) runs write none of those. */
export const REAL_RUN_RULE = "A run is real when weekly_briefs, chart_cards or forecast_calls reference it (DEV runs write none of them).";
/** The weekly forecast runs after the Sunday crawl (UTC day 0). */
export const FORECAST_WEEKDAY = 0;

/** Plain-words empty state wherever a run-to-run change would show. */
export const NO_COMPARISON_TEXT = "No stage changes yet. The first week-over-week comparison lands after the next weekly forecast.";

const DAY = 864e5;
export type RunRef = { id: number; at: string };

/** Real runs from ok runs plus the run ids that the brief, chart cards or ledger reference (and any ids the caller knows are real). Oldest first. */
export function realRuns<R extends RunRef>(okRuns: R[], referenced: Iterable<number | null | undefined>, extra: Iterable<number> = []): R[] {
  const ids = new Set<number>(extra);
  for (const id of referenced) if (typeof id === "number") ids.add(id);
  return okRuns.filter(r => ids.has(r.id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id - b.id);
}

/** The only valid comparison: the latest real run against the most recent real run at least MIN_RUN_GAP_DAYS older. Null when none exists. */
export function comparisonPair<R extends RunRef>(runs: R[]): { latest: R; earlier: R; days: number } | null {
  const sorted = [...runs].filter(r => Number.isFinite(Date.parse(r.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id - b.id), latest = sorted.at(-1);
  if (!latest) return null;
  const cut = Date.parse(latest.at) - MIN_RUN_GAP_DAYS * DAY, earlier = sorted.filter(r => r.id !== latest.id && Date.parse(r.at) <= cut).at(-1);
  return earlier ? { latest, earlier, days: Math.round((Date.parse(latest.at) - Date.parse(earlier.at)) / DAY * 10) / 10 } : null;
}
/** True when two runs are far enough apart to compare. */
export const gapOk = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) >= MIN_RUN_GAP_DAYS * DAY;

/**
 * When the next valid week-over-week comparison can land. `earliest` is the first moment a new real run would have a partner at least
 * MIN_RUN_GAP_DAYS older (never before now); `expected` is the first weekly forecast day on or after it.
 */
export function nextComparison(runs: RunRef[], now: number): { earliest: string; expected: string } | null {
  const sorted = [...runs].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), first = sorted[0];
  if (!first) return null;
  // With no pair yet, the oldest real run is the first possible partner; with a pair, the latest run is the next one's partner.
  const anchor = comparisonPair(sorted) ? sorted.at(-1)! : first;
  const earliest = Math.max(now, Date.parse(anchor.at) + MIN_RUN_GAP_DAYS * DAY), d = new Date(earliest);
  const exp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((FORECAST_WEEKDAY - d.getUTCDay() + 7) % 7)));
  return { earliest: new Date(earliest).toISOString(), expected: exp.toISOString().slice(0, 10) };
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
const ids = (xs: number[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
/** /status: which runs count as real and when the next valid week-over-week comparison lands, in one plain line. */
export function realRunLine(r: { real: RunRef[]; pair: { latest: RunRef; earlier: RunRef; days: number } | null; next: { earliest: string; expected: string } | null }): string {
  if (!r.real.length) return "No forecast run counts as real yet (a run is real once the weekly brief, a chart card or the ledger records it). Dev runs never count.";
  const head = `The story engine treats forecast run${r.real.length === 1 ? "" : "s"} ${ids(r.real.map(x => x.id))} as real (recorded by the weekly brief, a chart card or the ledger); dev runs never count.`;
  const next = r.next ? ` The next valid week-over-week comparison can land from ${dm(r.next.earliest)}, expected with the weekly forecast on Sunday ${dm(r.next.expected)}.` : "";
  return r.pair
    ? `${head} Current comparison: run ${r.pair.latest.id} (${dm(r.pair.latest.at)}) against run ${r.pair.earlier.id} (${dm(r.pair.earlier.at)}), ${r.pair.days} days apart.${next}`
    : `${head} No two are at least ${MIN_RUN_GAP_DAYS} days apart yet, so there is no week-over-week comparison.${next}`;
}

// READER RUN ---------------------------------------------------------------------------------------
/**
 * The one sandbox run reader pages may show: run 15 carries the Phase 12 outputs. No other sandbox run is ever shown, and once a real
 * run newer than it exists, reader pages read the latest real run and never a sandbox run again.
 */
export const READABLE_SANDBOX_RUN = 15;
export type ReaderRuns<R extends RunRef> = { latest: R | null; prev: R[]; mode: "real" | "sandbox" | "none" };
/**
 * Which stored run every reader-facing surface reads, plus the two runs before it (tiers compare stages across them).
 * `ok` is every ok run, `real` the real ones (REAL_RUN_RULE). Pure.
 */
export function readerRuns<R extends RunRef>(ok: R[], real: R[], anchor: number = READABLE_SANDBOX_RUN): ReaderRuns<R> {
  const byId = (a: R, b: R) => b.id - a.id, realIds = new Set(real.map(r => r.id));
  const reals = ok.filter(r => realIds.has(r.id)).sort(byId);
  if (reals[0] && reals[0].id > anchor) return { latest: reals[0], prev: reals.slice(1, 3), mode: "real" };
  // Before the switch: the newest ok run up to the anchor (today run 15), with the two ok runs before it, as before.
  const upTo = ok.filter(r => r.id <= anchor).sort(byId), latest = upTo[0] ?? null;
  if (!latest) return { latest: null, prev: [], mode: "none" };
  return { latest, prev: upTo.slice(1, 3), mode: realIds.has(latest.id) ? "real" : "sandbox" };
}

/** Stage-change alerts compare the new run against the most recent real run at least MIN_RUN_GAP_DAYS older, so a rerun cannot fire them. */
export function alertBaseline<R extends RunRef>(real: R[], current: RunRef): R | null {
  const cut = Date.parse(current.at) - MIN_RUN_GAP_DAYS * DAY;
  return [...real].filter(r => r.id !== current.id && Date.parse(r.at) <= cut).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id)[0] ?? null;
}
