// W3d · app icons as measured colour only: the ingest contract (POST /api/public/ingest-icons), the per-app checks and the week a post
// belongs to. slug stores and shows no icon picture: the crawler measures each icon in memory and sends only its colours with the app's
// name, maker and App Store link. Pure: no I/O.
import { z } from "zod";
import { isoWeek, weekMonday } from "../digest/week";

export const ICON_STORES = ["us"] as const;
export const ICON_CHARTS = ["top-free"] as const;
export const ICON_LIMITS = {
  requestBytes: 256 * 1024, // whole POST body
  minApps: 1, maxApps: 100,
  paletteMin: 1, paletteMax: 8,
  /** Shares may add to a hair over 1 from rounding. */
  shareSum: 1.001,
  /** One snapshot per ISO week per category; at most this many weeks are kept. */
  keepWeeks: 26,
  /** A post may be dated at most this many days after today (UTC), for a crawler a little ahead of the server's clock. */
  aheadDays: 1,
} as const;
/** An app's link must sit on Apple's own store host. */
export const LINK_HOST = "apps.apple.com";
const HEX = /^#[0-9A-Fa-f]{6}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One app on the chart. Checked row by row (a row that fails is refused with a reason and does not sink the post). */
export const iconApp = z.object({
  rank: z.number().int().min(1).max(100),
  app_id: z.string().regex(/^\d{1,20}$/, "1 to 20 digits"),
  name: z.string().trim().min(1).max(120),
  maker: z.string().trim().min(1).max(120),
  link: z.string().url().max(300),
  palette: z.array(z.object({ hex: z.string().regex(HEX, "#RRGGBB"), share: z.number().min(0).max(1) }).strict()).min(ICON_LIMITS.paletteMin).max(ICON_LIMITS.paletteMax),
}).strict();
export type IconApp = z.infer<typeof iconApp>;
/** The post: one category of one day's chart. `apps` is checked per row after the envelope passes. */
export const iconPayload = z.object({
  run_id: z.string().min(1).max(120),
  store: z.enum(ICON_STORES),
  chart: z.enum(ICON_CHARTS),
  day: z.string().regex(DAY, "YYYY-MM-DD"),
  genre: z.object({ id: z.number().int().min(1).max(2_147_483_647), name: z.string().trim().min(1).max(60) }).strict(),
  apps: z.array(z.unknown()).min(ICON_LIMITS.minApps).max(ICON_LIMITS.maxApps),
}).strict();
export type IconPayload = z.infer<typeof iconPayload>;
export type IconRefusal = "removed" | "invalid" | "wrong_link_host" | "palette_shares" | "duplicate_app" | "duplicate_rank";

/** Apple's own store page: https on apps.apple.com exactly. */
export function linkOk(link: string): boolean {
  try { const u = new URL(link); return u.protocol === "https:" && u.hostname.toLowerCase() === LINK_HOST && !u.username && !u.password; } catch { return false; }
}
/** Per-app checks after the shape is valid: the link's host and the palette's shares. */
export function checkApp(a: IconApp): { ok: true } | { ok: false; reason: IconRefusal } {
  if (!linkOk(a.link)) return { ok: false, reason: "wrong_link_host" };
  if (a.palette.reduce((s, c) => s + c.share, 0) > ICON_LIMITS.shareSum) return { ok: false, reason: "palette_shares" };
  return { ok: true };
}
/** A real calendar day (2026-02-30 is not). */
export function realDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === day;
}
/** The ISO week a day belongs to ("2026-W48"). */
export const weekOfDay = (day: string) => isoWeek(new Date(`${day}T00:00:00Z`));
/** The oldest week kept when `week` is the newest: `keepWeeks` weeks in all, this one included. */
export function oldestKept(week: string, keep: number = ICON_LIMITS.keepWeeks): string {
  const mon = weekMonday(week);
  if (!mon) throw new Error("bad week");
  return isoWeek(new Date(+mon - (keep - 1) * 7 * 864e5));
}
/** Why a post's day cannot be stored, or null: not a real day, ahead of today, or older than the kept weeks. */
export function dayProblem(day: string, now: number): string | null {
  if (!realDay(day)) return "day: not a real calendar day";
  const t = Date.parse(`${day}T00:00:00Z`), today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  if (t > today + ICON_LIMITS.aheadDays * 864e5) return "day: later than today";
  if (weekOfDay(day) < oldestKept(isoWeek(new Date(now)))) return `day: older than the ${ICON_LIMITS.keepWeeks} weeks kept`;
  return null;
}
/** The fields a stored row compares on: a row is unchanged when these are the same as stored. */
export const rowKey = (a: Pick<IconApp, "rank" | "name" | "maker" | "link" | "palette">) =>
  JSON.stringify([a.rank, a.name, a.maker, a.link, a.palette.map(p => [p.hex.toUpperCase(), p.share])]);

export const iconRemoveBody = z.object({ app_id: z.string().regex(/^\d{1,20}$/, "1 to 20 digits"), reason: z.string().trim().min(3).max(300) });
export type IconRemove = z.infer<typeof iconRemoveBody>;
/** W3d · the health line: the newest stored week, its categories and apps (not removed), and when its rows were last written. */
export type IconHealth = { week: string | null; categories: number; apps: number; last_stored_at: string | null };
