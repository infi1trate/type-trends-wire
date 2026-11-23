// PH1 · Product Hunt launches, pure. The run row's wording; (Part 2) the vote floor and slug's beat; (Part 4) what a reader sees.
// The Pacific day (Product Hunt's launch day, midnight to midnight in Los Angeles).
export const PH_TZ = "America/Los_Angeles";
const ptParts = (t: number) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: PH_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const g = (k: string) => Number(f.find(x => x.type === k)?.value ?? 0);
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), mi: g("minute"), s: g("second") };
};
const offsetMs = (t: number) => { const p = ptParts(t); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000; };
/** The instant a Pacific calendar day starts (daylight saving handled: 23- and 25-hour days come out right). */
export function pacificMidnight(y: number, m: number, d: number): number {
  const t0 = Date.UTC(y, m - 1, d); let t = t0 - offsetMs(t0); t = t0 - offsetMs(t); return t;
}
/** The Pacific calendar day an instant falls on, as YYYY-MM-DD. */
export function pacificDay(t: number): string { const p = ptParts(t); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; }
export type PhWindow = { day: string; after: string; before: string };
/** The Pacific day before the one `now` falls in: [start of that day, start of today). */
export function phDayWindow(now: number): PhWindow {
  const p = ptParts(now), prev = new Date(Date.UTC(p.y, p.m - 1, p.d - 1));
  const after = pacificMidnight(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate()), before = pacificMidnight(p.y, p.m, p.d);
  return { day: prev.toISOString().slice(0, 10), after: new Date(after).toISOString(), before: new Date(before).toISOString() };
}
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

// PH1 Part 4 · what a reader sees: Today's "New on the scene" box and the Terminal's LAUNCHES group (the same rows).
/** At most this many launches, most votes first. */
export const LAUNCH_BOX_MAX = 3;
/** The box shows the newest launch day no older than this many Pacific days before today; older, there is no box. */
export const LAUNCH_BOX_DAYS = 2;
export type LaunchStory = { id: string; type: string; state: string; headline: string; deck: string | null; happened_at: string };
export type LaunchRow = { id: string; href: string; title: string; votes: number | null; day: string; votesLine: string | null; dayLine: string };
/** The finished day's votes, from the launch story's deck ("412 upvotes"). */
export const votesOf = (deck: string | null | undefined): number | null => { const m = /^(\d[\d,]*) upvotes?\b/.exec(deck ?? ""); return m ? Number(m[1]!.replace(/,/g, "")) : null; };
/** Published launches of the newest recent launch day, most votes first, at most three; none at all is normal (no box). */
export function launchBox(stories: readonly LaunchStory[], now: number, max = LAUNCH_BOX_MAX): LaunchRow[] {
  const today = pacificDay(now), oldest = pacificDay(now - LAUNCH_BOX_DAYS * 864e5);
  const pool = stories.filter(s => s.type === "launch" && s.state === "published").map(s => ({ s, day: pacificDay(Date.parse(s.happened_at)), votes: votesOf(s.deck) }))
    .filter(x => x.day >= oldest && x.day <= today);
  const newest = pool.map(x => x.day).sort().at(-1);
  return pool.filter(x => x.day === newest).sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1) || a.s.id.localeCompare(b.s.id)).slice(0, max)
    .map(({ s, day, votes }) => ({ id: s.id, href: `/stories/${encodeURIComponent(s.id)}`, title: s.headline, votes, day,
      votesLine: votes == null ? null : `${votes.toLocaleString("en-US")} upvote${votes === 1 ? "" : "s"}`, dayLine: `Launched ${dayLabel(day)}` }));
}
