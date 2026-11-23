// PH1 · Product Hunt launches, pure. The run row's wording; (Part 2) the vote floor and slug's beat; (Part 4) what a reader sees.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-22" → "22 Nov". */
export const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1] ?? ""}`;

export type PhRun = { day: string | null; fetched: number; written: number; updated: number; topicsRead: boolean | null };
/** The ingest's finish line: "20 fetched for 22 Nov (Pacific), 20 new". */
export function phRunLine(r: PhRun): string {
  const parts = [`${r.fetched} fetched${r.day ? ` for ${dayLabel(r.day)} (Pacific)` : ""}`, `${r.written} new`];
  if (r.updated) parts.push(`${r.updated} brought up to the finished day`);
  if (r.topicsRead === false) parts.push("topics not readable");
  return parts.join(", ");
}
