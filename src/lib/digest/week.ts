// Pure ISO-week helpers for Digest issues: Monday–Sunday dates and issue numbers (No. 1 = DIGEST_FIRST_WEEK).
import { DIGEST_FIRST_WEEK } from "../site";
export const WEEK_RE = /^(\d{4})-W(\d{2})$/;
const DAY = 864e5;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Monday 00:00 UTC of an ISO week, or null for a malformed/impossible week. */
export function weekMonday(week: string): Date | null {
  const m = WEEK_RE.exec(week); if (!m) return null;
  const y = Number(m[1]), w = Number(m[2]);
  if (w < 1 || w > 53) return null;
  const jan4 = Date.UTC(y, 0, 4), dow = new Date(jan4).getUTCDay() || 7;
  const monday = new Date(jan4 - (dow - 1) * DAY + (w - 1) * 7 * DAY);
  return isoWeek(monday) === week ? monday : null;
}
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((+t - Date.UTC(y, 0, 1)) / DAY + 1) / 7); return `${y}-W${String(w).padStart(2, "0")}`;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const longDate = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
/** Monday–Sunday dates plus the exclusive end instant (next Monday) for range queries. */
export function weekRange(week: string) {
  const mon = weekMonday(week); if (!mon) return null;
  const sun = new Date(+mon + 6 * DAY), next = new Date(+mon + 7 * DAY);
  const sameMonth = mon.getUTCMonth() === sun.getUTCMonth(), sameYear = mon.getUTCFullYear() === sun.getUTCFullYear();
  const label = sameMonth ? `${mon.getUTCDate()}–${sun.getUTCDate()} ${MONTHS[sun.getUTCMonth()]} ${sun.getUTCFullYear()}`
    : `${mon.getUTCDate()} ${MONTHS[mon.getUTCMonth()]}${sameYear ? "" : ` ${mon.getUTCFullYear()}`} – ${sun.getUTCDate()} ${MONTHS[sun.getUTCMonth()]} ${sun.getUTCFullYear()}`;
  return { start: ymd(mon), end: ymd(sun), startIso: mon.toISOString(), endIso: next.toISOString(), label };
}
/** No. 1 = DIGEST_FIRST_WEEK; null before it. */
export function issueNumber(week: string): number | null {
  const a = weekMonday(DIGEST_FIRST_WEEK), b = weekMonday(week);
  if (!a || !b || +b < +a) return null;
  return Math.round((+b - +a) / (7 * DAY)) + 1;
}
export const isIssueWeek = (week: string) => issueNumber(week) !== null;
