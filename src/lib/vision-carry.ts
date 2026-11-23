// T2 · A: when a capture's picture read is carried forward instead of made again (pure). A live capture whose section crops (the
// crawler's stored above-the-fold and section pictures, by hash) are the same as at the previous capture with a reading is not read
// again: the reading is copied and marked "carried from <date>". It is read again when the previous reading is older than
// CARRY_MAX_AGE_DAYS (counted from the fresh read a carried chain began with), was low confidence or unusable, when the site is in the
// leading group (the top LEADING_GROUP trendsetters), when any section's crops for either capture are not stored, or for an archive
// capture (archive captures have no crops). Every doubt reads again.
import { VANGUARD_TOP_TRENDSETTERS } from "./vanguard";

export const CARRY_MAX_AGE_DAYS = 28;
export const LEADING_GROUP = VANGUARD_TOP_TRENDSETTERS;
/** A crop version covers a capture when it was first seen no later, and last seen no earlier, than the capture (within this much: the
 *  crop's own time and the capture's are taken a few seconds to minutes apart in the same crawl). */
export const CROP_MATCH_MS = 30 * 60_000;

export type CropVersion = { section: string; hash: string; first_seen_at: string; last_seen_at: string };
export type PreviousRead = { captured_at: string; carried_from: string | null; usable: boolean };
export type CarryInput = { source: string; captured_at: string; previous: PreviousRead | null; crops: readonly CropVersion[]; leading: boolean; now: number };
export type CarryDecision = { carry: true; from: string } | { carry: false; reason: string };

/** Each section's crop hash at time `t` (a section with no covering version is absent). */
export function sectionsAt(crops: readonly CropVersion[], t: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of crops) if (Date.parse(c.first_seen_at) <= t + CROP_MATCH_MS && Date.parse(c.last_seen_at) >= t - CROP_MATCH_MS) out.set(c.section, c.hash);
  return out;
}
export function carryDecision(i: CarryInput): CarryDecision {
  if (i.source !== "live") return { carry: false, reason: "archive capture" };
  if (i.leading) return { carry: false, reason: "leading group" };
  const p = i.previous;
  if (!p) return { carry: false, reason: "no earlier reading" };
  if (!p.usable) return { carry: false, reason: "earlier reading low confidence" };
  const readAt = p.carried_from ?? p.captured_at;
  if (i.now - Date.parse(readAt) > CARRY_MAX_AGE_DAYS * 864e5) return { carry: false, reason: `reading older than ${CARRY_MAX_AGE_DAYS} days` };
  const now = sectionsAt(i.crops, Date.parse(i.captured_at)), then = sectionsAt(i.crops, Date.parse(p.captured_at));
  if (!now.size || !then.size || !now.has("hero")) return { carry: false, reason: "crops not stored" };
  if (now.size !== then.size || [...now].some(([s, h]) => then.get(s) !== h)) return { carry: false, reason: "crops changed" };
  return { carry: true, from: readAt };
}
/** "carried from 14 Nov 2026" for a carried reading's stamp. */
export const carriedLine = (from: string) => `carried from ${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(from))}`;
