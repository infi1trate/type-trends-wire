// Every recurring job in plain words: what it feeds, how often it should run, when it last ran and finished, when the next one is
// expected and whether it is late (late = more than LATE_FACTOR × its interval since it last finished). Pure; facts are read by
// freshness.server.ts from what is already stored. Nothing here writes.
export const LATE_FACTOR = 2;
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export type Rhythm =
  | { kind: "every"; ms: number; aligned?: boolean }
  | { kind: "daily"; h: number; m: number }
  | { kind: "weekly"; dow: number; h?: number; m?: number }
  | { kind: "after"; of: string; ms: number };
export type JobId = "wire" | "library_ai" | "gfonts" | "producthunt" | "library_check" | "vanguard" | "library_full" | "crawl" | "crops" | "discourse" | "wayback" | "forecast" | "follow_ups" | "stories" | "digest";
/** `rhythm_text` overrides the generated words when the cadence needs more than one interval to describe. */
export type JobDef = { id: JobId; name: string; feeds: string; rhythm: Rhythm; rhythm_text?: string; runs_on: "scheduled" | "crawler" | "chained"; note?: string };
/** Jobs whose lateness a reader notices directly: only these raise the warning in the Read shell. Crawler-side lateness shows on /status only. */
export const READER_FACING: ReadonlySet<JobId> = new Set<JobId>(["wire", "stories", "forecast", "follow_ups", "digest"]);
/** Crawler runs whose id starts with this prefix are the daily vanguard crawl (read from stored snapshots; nothing is written). */
export const VANGUARD_RUN_PREFIX = "lib-vanguard-";

/** The registry. Times are UTC and match the stored schedules; crawler jobs run on the repo's GitHub Actions. */
export const JOBS: readonly JobDef[] = [
  { id: "wire", name: "Wire check", feeds: "Live front page, wire and stories", rhythm: { kind: "every", ms: 15 * MIN, aligned: true }, runs_on: "scheduled" },
  { id: "library_ai", name: "AI reading of captured pages", feeds: "Pricing, message and product changes on brand pages", rhythm: { kind: "every", ms: 5 * MIN, aligned: true }, runs_on: "scheduled", note: "Only works when captures are waiting" },
  { id: "gfonts", name: "Google Fonts popularity", feeds: "Type signals", rhythm: { kind: "daily", h: 6, m: 17 }, runs_on: "scheduled" },
  { id: "producthunt", name: "Product Hunt launches", feeds: "Launch stories", rhythm: { kind: "daily", h: 8, m: 37 }, runs_on: "scheduled" },
  { id: "library_check", name: "Library check", feeds: "Brand pages, moves and stories", rhythm: { kind: "every", ms: HOUR }, rhythm_text: "Hourly slices, every site once a day", runs_on: "crawler" },
  { id: "vanguard", name: "Vanguard crawl", feeds: "Daily full look at the brands most likely to move (top trendsetters and recent movers)", rhythm: { kind: "every", ms: DAY }, rhythm_text: "Daily", runs_on: "crawler" },
  { id: "library_full", name: "Full library crawl", feeds: "Every brand page and the weekly forecast", rhythm: { kind: "weekly", dow: 6 }, runs_on: "crawler" },
  { id: "crawl", name: "Design-signal crawl", feeds: "Vanguard and curation inputs to the weekly forecast", rhythm: { kind: "weekly", dow: 6 }, runs_on: "crawler" },
  { id: "crops", name: "Section crops", feeds: "Before/after images on brand, pattern and story pages", rhythm: { kind: "every", ms: DAY }, runs_on: "crawler" },
  { id: "discourse", name: "Discourse sample", feeds: "What people say about design (forecast input)", rhythm: { kind: "every", ms: 6 * HOUR }, runs_on: "crawler" },
  { id: "wayback", name: "Wayback history", feeds: "Archive captures behind quarterly history", rhythm: { kind: "every", ms: 6 * HOUR }, runs_on: "crawler", note: "Runs while the archive backfill is active" },
  { id: "forecast", name: "Weekly forecast", feeds: "Signals, sector reports, the Digest", rhythm: { kind: "weekly", dow: 0, h: 9, m: 30 }, runs_on: "scheduled" },
  { id: "follow_ups", name: "Forecast follow-ups", feeds: "Weekly brief, chart of the week, ledger, taste tables, story build", rhythm: { kind: "after", of: "the next forecast", ms: 30 * MIN }, runs_on: "chained", note: "One step per five-minute call after the forecast is stored" },
  { id: "stories", name: "Story build", feeds: "Live front page, Morning Line", rhythm: { kind: "after", of: "each wire, library and forecast job", ms: DAY }, runs_on: "chained", note: "Shown as the newest stored story; builds that find nothing new leave no trace" },
  { id: "digest", name: "Weekly Digest brief", feeds: "The Digest", rhythm: { kind: "weekly", dow: 0, h: 9, m: 30 }, runs_on: "chained" },
];

export type JobFact = {
  /** When it last started (or the newest thing it produced, for jobs that leave no run record). */
  ran: string | null;
  finished?: string | null;
  /** Waiting work that has not been picked up yet (oldest first); when set, lateness is measured from it instead. */
  waiting_since?: string | null;
  /** Nothing to do right now (e.g. no captures waiting): on time whatever the last activity. */
  idle?: boolean;
  /** The source is switched off or waiting on a credential; never late. */
  dormant?: string | null;
  /** The last attempt failed. */
  failing?: boolean;
};
export type FreshState = "on_time" | "late" | "never" | "dormant";
export type FreshRow = { id: JobId; name: string; feeds: string; rhythm: string; runs_on: JobDef["runs_on"]; last_ran: string | null; last_finished: string | null; next: string; state: FreshState; note: string | null };

const ms = (iso: string | null | undefined) => { if (!iso) return null; const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
export const intervalMs = (r: Rhythm) => (r.kind === "every" || r.kind === "after" ? r.ms : r.kind === "daily" ? DAY : 7 * DAY);
const pad = (n: number) => String(n).padStart(2, "0");
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayMonth = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
const span = (x: number) => { const m = Math.round(x / MIN); if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`; const h = Math.round(x / HOUR); if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`; const d = Math.round(x / DAY); return `${d} day${d === 1 ? "" : "s"}`; };

/** "Every 15 minutes", "Daily at 06:17 UTC", "Weekly, Sunday 09:30 UTC", "After each wire, library and forecast job". */
export function rhythmText(r: Rhythm): string {
  if (r.kind === "every") return `Every ${span(r.ms)}`.replace("Every 1 day", "Daily").replace("Every 24 hours", "Daily");
  if (r.kind === "daily") return `Daily at ${pad(r.h)}:${pad(r.m)} UTC`;
  if (r.kind === "weekly") return `Weekly, ${DOW[r.dow]}${r.h !== undefined ? ` ${pad(r.h)}:${pad(r.m ?? 0)} UTC` : ""}`;
  return `After ${r.of}`;
}
/** "6 minutes ago", "3 days ago", "just now". */
export function ago(iso: string | null, now: number): string { const t = ms(iso); if (t === null) return "never"; const d = Math.max(0, now - t); return d < MIN ? "just now" : `${span(d)} ago`; }

/** The next expected start, in words or as a UTC time. */
export function nextExpected(r: Rhythm, lastRan: string | null, now: number): string {
  const at = (t: number, withTime = true) => { const d = new Date(t); return withTime ? `${dayMonth(d.toISOString())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` : `${DOW[d.getUTCDay()]} ${dayMonth(d.toISOString())}`; };
  if (r.kind === "after") return `After ${r.of}`;
  if (r.kind === "every") {
    if (r.aligned) return at(Math.ceil((now + 1) / r.ms) * r.ms);
    const last = ms(lastRan);
    if (last === null) return "Not yet scheduled";
    const n = last + r.ms;
    return n > now ? `By ${at(n)}` : `Due since ${at(n)}`;
  }
  const d = new Date(now), base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (r.kind === "daily") { let t = base + r.h * HOUR + r.m * MIN; if (t <= now) t += DAY; return at(t); }
  let t = base + ((r.dow - d.getUTCDay() + 7) % 7) * DAY + (r.h ?? 0) * HOUR + (r.m ?? 0) * MIN;
  if (r.h !== undefined && t <= now) t += 7 * DAY;
  if (r.h === undefined && t + DAY <= now) t += 7 * DAY;
  return at(t, r.h !== undefined);
}

/** One row per job, in registry order. A job is late when its last finish (or waiting work) is older than LATE_FACTOR × its interval. */
export function freshness(facts: Partial<Record<JobId, JobFact>>, now: number, jobs: readonly JobDef[] = JOBS): FreshRow[] {
  return jobs.map(j => {
    const f = facts[j.id] ?? { ran: null }, last = f.finished ?? f.ran, limit = LATE_FACTOR * intervalMs(j.rhythm);
    const waiting = ms(f.waiting_since);
    let state: FreshState;
    if (f.dormant) state = "dormant";
    else if (waiting !== null) state = now - waiting > limit ? "late" : "on_time";
    else if (f.idle) state = "on_time";
    else if (ms(last) === null) state = "never";
    else state = now - ms(last)! > limit ? "late" : "on_time";
    const note = [f.dormant, f.failing && state !== "dormant" ? "Last attempt failed" : null, waiting !== null ? `Work waiting since ${ago(f.waiting_since ?? null, now)}` : f.idle ? "Idle: nothing waiting" : null, j.note].filter(Boolean).join(" · ") || null;
    return { id: j.id, name: j.name, feeds: j.feeds, rhythm: j.rhythm_text ?? rhythmText(j.rhythm), runs_on: j.runs_on, last_ran: f.ran, last_finished: f.finished ?? null, next: nextExpected(j.rhythm, f.ran, now), state, note };
  });
}

/** The single quiet line in the Read shell: three times, or a plain warning naming a late reader-facing job (READER_FACING).
 *  A late crawler-side job does not raise it; its last-run time is still stated plainly and its lateness shows on /status. */
export function freshnessLine(rows: FreshRow[], now: number): { text: string; late: boolean } {
  const by = (id: JobId) => rows.find(r => r.id === id);
  const late = rows.filter(r => r.state === "late" && READER_FACING.has(r.id));
  if (late.length) {
    const words = late.slice(0, 2).map(r => `${r.name} last ran ${ago(r.last_finished ?? r.last_ran, now)} (expected ${r.rhythm.toLowerCase()})`);
    return { late: true, text: `Late: ${words.join(" · ")}${late.length > 2 ? ` · and ${late.length - 2} more on the status page` : ""}` };
  }
  const wire = by("wire"), lib = by("library_check"), fc = by("forecast"), parts: string[] = [];
  if (wire) parts.push(`Wire checked ${ago(wire.last_finished ?? wire.last_ran, now)}`);
  if (lib) parts.push(`Library crawl ${ago(lib.last_finished ?? lib.last_ran, now)}`);
  if (fc) parts.push(fc.last_ran ? `Forecast ${dayMonth(fc.last_ran)}` : "Forecast not run yet");
  return { late: false, text: parts.join(" · ") };
}
/** Live's "next check within 15 minutes" is only true when the wire job is on time. */
export const wireOnTime = (rows: FreshRow[]) => rows.find(r => r.id === "wire")?.state === "on_time";
