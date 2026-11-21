// Editor's desk request schema (pure). Every story write is one appended story_edits row; a pitch is one appended pitches row.
import { z } from "zod";
import { WHY_MAX_CHARS } from "./why";
import { pitchBody } from "./pitch";

export const DESK_BODY_LIMIT = 8 * 1024;
/** Desk calls per IP per minute (failed auth counts too). */
export const DESK_RATE_PER_MIN = 30;
/** A pin lasts at most 7 days. */
export const PIN_MAX_DAYS = 7;
const id = z.string().min(3).max(200), note = z.string().max(500).optional();
// E3: our own words carry no "$"; a quotation (“…”, ‘…’, "…") is the captured text and may.
const noDollar = (s: string) => !s.replace(/“[^”]*”|‘[^’]*’|"[^"]*"/g, "").includes("$");
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
  // U4 · a pitch asks the engine; it never edits a story.
  pitchBody,
  // L1 · approve a proposed design edition (after the gate) or roll one back; each appends one living_edition_status row.
  z.object({ action: z.literal("living_approve"), edition: z.number().int().min(1).max(100_000), note }).strict(),
  z.object({ action: z.literal("living_rollback"), edition: z.number().int().min(1).max(100_000), note }).strict(),
]);
export type DeskBody = z.infer<typeof deskBody>;
/** Pin must end in the future and within PIN_MAX_DAYS. */
export const pinOk = (until: string, now: number) => { const t = Date.parse(until); return t > now && t <= now + PIN_MAX_DAYS * 864e5; };
