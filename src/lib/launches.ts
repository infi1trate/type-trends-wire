// PH1 · Product Hunt launches, pure. The run row's wording; (Part 2) the vote floor and slug's beat; (Part 4) what a reader sees.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-22" → "22 Nov". */
export const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1] ?? ""}`;

/**
 * slug's beat on Product Hunt: a launch is a story candidate only when it carries at least one of these topics (matched on the
 * topic's slug, as the API gives it): design tools, web design, branding, typography, user experience, no-code, developer tools and
 * website builders. Everything else is an ordinary wire item and nothing more.
 */
export const LAUNCH_BEAT_TOPICS = ["design-tools", "web-design", "branding", "typography", "user-experience", "no-code", "developer-tools", "website-builder"] as const;
/** Votes a launch needs on its finished day to become a story candidate. */
export const LAUNCH_VOTE_FLOOR = 150;
/** The floor when the API gave no topics for the day: the beat is not guessed from the tagline, the floor is raised instead. */
export const LAUNCH_VOTE_FLOOR_NO_TOPICS = 300;
export type LaunchIn = { votes?: number | null | undefined; topics?: readonly string[] | null | undefined };
export type LaunchVerdict = { pass: boolean; floor: number; why: "no_votes" | "below_floor" | "off_beat" | null };
const BEAT = new Set<string>(LAUNCH_BEAT_TOPICS);
/** Both must hold: votes at the floor or above, and (when topics were read) one topic on the beat. Unread votes never pass. */
export function launchVerdict(l: LaunchIn): LaunchVerdict {
  const topicsRead = Array.isArray(l.topics), floor = topicsRead ? LAUNCH_VOTE_FLOOR : LAUNCH_VOTE_FLOOR_NO_TOPICS;
  if (l.votes == null) return { pass: false, floor, why: "no_votes" };
  if (l.votes < floor) return { pass: false, floor, why: "below_floor" };
  if (topicsRead && !l.topics!.some(t => BEAT.has(t.toLowerCase()))) return { pass: false, floor, why: "off_beat" };
  return { pass: true, floor, why: null };
}
export const onTheLine = (l: LaunchIn) => launchVerdict(l).pass;
/** A wire row a reader may see: every source as before, a Product Hunt launch only when it is over the line. */
export const wireShown = (w: LaunchIn & { source_kind: string }) => w.source_kind !== "producthunt" || onTheLine(w);

export type PhRun = { day: string | null; fetched: number; written: number; updated: number; topicsRead: boolean | null; passed?: number | undefined };
/** The ingest's finish line: "20 fetched for 22 Nov (Pacific), 3 over the floor and on topic, 20 new". */
export function phRunLine(r: PhRun): string {
  const over = r.passed == null ? null : r.topicsRead === false ? `${r.passed} over the ${LAUNCH_VOTE_FLOOR_NO_TOPICS}-vote floor (topics not readable)` : `${r.passed} over the floor and on topic`;
  const parts = [`${r.fetched} fetched${r.day ? ` for ${dayLabel(r.day)} (Pacific)` : ""}`, ...(over ? [over] : []), `${r.written} new`];
  if (r.updated) parts.push(`${r.updated} brought up to the finished day`);
  if (r.topicsRead === false && r.passed == null) parts.push("topics not readable");
  return parts.join(", ");
}
