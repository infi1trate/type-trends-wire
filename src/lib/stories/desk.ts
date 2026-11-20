// Editor's desk request schema (pure). Every write is one appended story_edits row.
import { z } from "zod";
import { WHY_MAX_CHARS } from "./why";

export const DESK_BODY_LIMIT = 8 * 1024;
/** Desk calls per IP per minute (failed auth counts too). */
export const DESK_RATE_PER_MIN = 30;
/** A pin lasts at most 7 days. */
export const PIN_MAX_DAYS = 7;
const id = z.string().min(3).max(200), note = z.string().max(500).optional();
const noDollar = (s: string) => !s.includes("$");
/** Staff pages whose content loads only through this endpoint, after the editor key is accepted. */
export const STAFF_PAGES = ["status", "launch", "welcome"] as const;
export type StaffPage = (typeof STAFF_PAGES)[number];
export const deskBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check") }).strict(),
  z.object({ action: z.literal("staff"), page: z.enum(STAFF_PAGES) }).strict(),
  z.object({ action: z.literal("queue"), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict(),
  z.object({ action: z.literal("pin"), id, until: z.string().datetime({ offset: true }), note }).strict(),
  z.object({ action: z.literal("kill"), id, reason: z.string().min(3).max(300), note }).strict(),
  z.object({ action: z.literal("correct"), id, headline: z.string().min(3).max(200).refine(noDollar).optional(), deck: z.string().max(400).refine(noDollar).optional(), why_line: z.string().max(WHY_MAX_CHARS).refine(noDollar).optional(), note })
    .strict().refine(b => b.headline !== undefined || b.deck !== undefined || b.why_line !== undefined, { message: "nothing to correct" }),
  z.object({ action: z.literal("restore"), id, note }).strict(),
]);
export type DeskBody = z.infer<typeof deskBody>;
/** Pin must end in the future and within PIN_MAX_DAYS. */
export const pinOk = (until: string, now: number) => { const t = Date.parse(until); return t > now && t <= now + PIN_MAX_DAYS * 864e5; };
