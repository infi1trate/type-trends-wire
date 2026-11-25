// L2 · A NUMBERS LINE SAYS WHEN IT WAS TRUE (pure). A story's Numbers list keeps the numbers it was written from; each line that states a
// share, a stage or a momentum carries the date of the forecast run (or capture) it came from, in the line's own small type ("as of
// 15 Nov"). When a later forecast run changes the stage of a signal that a story published in the last 14 days cites, the story gets one
// dated update line under its list, written here from the facts (no model) and held to the copy desk's rules. The story's text is never
// rewritten.
import { canonical, label, storySectorName as sectorName, stageName } from "../labels";
import { lintLine } from "../newsroom/copy";
import type { Fact } from "./types";
import type { RowOf } from "./sheet";

export const UPDATE_DAYS = 14;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "15 Nov" (UTC), the Read side's one date form. */
export const dayMonth = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const asOfText = (iso: string) => `as of ${dayMonth(iso)}`;
const STAGE_WORD = /\b(emerging|rising|peaking|fading|steady|flat|accelerating|declining)\b/i;
/** Whether a Numbers line states a share, a stage or a momentum (and so is only true as of its run). */
export function statesNumber(f: Pick<Fact, "text" | "kind">): boolean {
  if (f.kind === "share" || f.kind === "stage") return true;
  if (f.kind === "member" || f.kind === "line" || f.kind === "before" || f.kind === "after" || f.kind === "brand" || f.kind === "source" || f.kind === "date") return false;
  return /\d(?:\.\d)?%|\bmomentum\b|points a quarter|\b\d+ of \d+\b/.test(f.text) || (f.kind === "count" && STAGE_WORD.test(f.text));
}
export type DatedFact = Fact & { asOf?: string };
/** The list with each number line's date ("as of 15 Nov"); lines that state no number are left as they are. */
export const datedFacts = <F extends Fact>(facts: readonly F[], asOfIso: string | null): (F & { asOf?: string })[] =>
  facts.map(f => (asOfIso && statesNumber(f) ? { ...f, asOf: asOfText(asOfIso) } : f));

const pct1 = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
export type RunRef = { id: number; at: string };
/** The one update line, or null: the story ran within the last 14 days, a newer run exists, and in it the stage of one of the story's
 *  first three signals (library-wide first, then its sector) is not the stage the story's own run gave. Passes the copy desk or is null. */
export function stageUpdate(o: { publishedAt: string; now: number; storyRun: RunRef | null; newest: RunRef | null; keys: readonly string[]; sector: string | null; then: RowOf; latest: RowOf }): string | null {
  if (!o.storyRun || !o.newest || o.newest.id <= o.storyRun.id) return null;
  if (o.now - Date.parse(o.publishedAt) > UPDATE_DAYS * 864e5) return null;
  const keys = o.keys.slice(0, 3), named = new Set(keys.map(canonical)).size > 1;
  for (const k of keys) {
    const ck = canonical(k);
    for (const scope of ["all", ...(o.sector ? [o.sector] : [])]) {
      const a = o.then(ck, scope), b = o.latest(ck, scope);
      const was = stageName(a?.stage ?? null), is = stageName(b?.stage ?? null);
      if (!was || !is || was === is || b?.current_share == null) continue;
      const where = scope === "all" ? "" : `${sectorName(scope).toLowerCase()} `;
      const line = `Update ${dayMonth(o.newest.at)}: ${named ? `${label(k).name.toLowerCase()} ` : ""}now ${pct1(b.current_share)} of ${where}homepages, ${is.toLowerCase()}`;
      return lintLine(line, "number").length ? null : line;
    }
  }
  return null;
}
