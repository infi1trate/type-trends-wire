// Editor's desk request schema (pure). Every story write is one appended story_edits row; a pitch is one appended pitches row.
import { z } from "zod";
import { WHY_MAX_CHARS } from "./why";
import { pitchBody } from "./pitch";
import { DESKS } from "../newsroom/desks";

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
/** N1 · a pitch on the board: which desk holds it and how far it got. */
export const ASSIGN_STATUSES = ["open", "assigned", "working", "done", "dropped"] as const;
/** N1 · what a ships-to-preview proposal is about. */
export const PROPOSAL_KINDS = ["chart", "study_series", "layout", "signal", "format", "design_edition"] as const;
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
  // N1 · the newsroom: the memory in one call, the desk page's data, the board, spend, the cap, the wire-only switch and proposals.
  z.object({ action: z.literal("memory") }).strict(),
  z.object({ action: z.literal("newsroom"), desk: z.string().min(1).max(40).optional() }).strict(),
  z.object({ action: z.literal("assign"), pitch: z.number().int().min(1), desk: z.enum(DESKS), status: z.enum(ASSIGN_STATUSES), reason: z.string().trim().min(3).max(300).optional() }).strict()
    .refine(b => b.status !== "dropped" || !!b.reason, { message: "a dropped pitch carries a reason", path: ["reason"] }),
  z.object({ action: z.literal("spend"), credits: z.number().positive().max(100_000), what: z.string().trim().min(3).max(300).refine(noDollar) }).strict(),
  z.object({ action: z.literal("spend_cap"), model_usd: z.number().min(0).max(100_000).nullable(), build_credits: z.number().min(0).max(1_000_000).nullable(), reason: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("wire_only"), on: z.boolean(), reason: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("propose"), kind: z.enum(PROPOSAL_KINDS), subject: z.string().trim().min(1).max(200).optional(), text: z.string().trim().min(3).max(1000) }).strict(),
]);
/** N1 · the call envelope every desk call carries beside its action: who is acting, and the owner's confirmation phrase when needed. */
export const envelopeKeys = ["actor", "confirm"] as const;
export type DeskBody = z.infer<typeof deskBody>;
/** Pin must end in the future and within PIN_MAX_DAYS. */
export const pinOk = (until: string, now: number) => { const t = Date.parse(until); return t > now && t <= now + PIN_MAX_DAYS * 864e5; };
