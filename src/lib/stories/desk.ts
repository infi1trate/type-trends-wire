// Editor's desk request schema (pure). Every story write is one appended story_edits row; a pitch is one appended pitches row.
import { z } from "zod";
import { WHY_MAX_CHARS } from "./why";
import { pitchBody } from "./pitch";
import { ACTORS, DESKS } from "../newsroom/desks";
import { PICTURE_B64_MAX, REVIEW_KINDS, REVIEW_PAGE_IDS, RUN_MAX, measuresSchema, pathOk } from "../newsroom/design-review";
import { EXPECTS, QUEUE_KINDS, QUEUE_STATUSES, SOURCE_KINDS } from "../newsroom/queue";
import { HOLD_ACTORS, HOLD_JOBS } from "../newsroom/passes";
import { audienceBody } from "../newsroom/publisher";
import { sourceNoteBody } from "../newsroom/scout";

export const DESK_BODY_LIMIT = 8 * 1024;
/** N4 · a `review` call may carry one picture (at most 150 KB as WebP, about 200 KB as base64); every other action keeps 8 KB. */
export const DESK_REVIEW_BODY_LIMIT = 224 * 1024;
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
export const PROPOSAL_KINDS = ["chart", "study_series", "layout", "signal", "format", "design_edition", "brand"] as const;
/** N2 · what a desk note is about, and the statuses the owner sets on a proposal. */
export const NOTE_SUBJECTS = ["story", "study", "brand", "signal"] as const;
export const PROPOSAL_STATUSES = ["open", "accepted", "declined"] as const;
/** N3 · a wire pick's subject, the graphics desk's picture choices and the data desk's finding kinds. */
export const WIRE_SUBJECTS = ["brand", "web", "type"] as const;
export const PICTURE_CHOICES = ["rule", "none", "crop", "pair"] as const;
export const FINDING_KINDS = ["contradiction", "detector", "impossible", "coverage", "wrong website"] as const;
/** Who may take each N3 action (enforced at the door, after the register's level). */
export const N3_ACTORS: Readonly<Record<string, readonly string[]>> = {
  wire_pick: ["news", "owner"], wire_drop: ["news", "standards", "editor in chief", "owner"], picture: ["graphics", "owner"],
  finding: ["data", "owner"], finding_close: ["data", "standards", "editor in chief", "owner"], data_run: ["data", "graphics", "news", "engineering", "design review", "publisher", "scout", "owner"],
  // N4 · page reviews come from the design review and engineering desks' outside sessions; any desk files a queue item; the engineering
  // desk moves items along and records gate results (the owner may decline an item).
  review: ["design review", "engineering"], queue_add: ACTORS, queue_move: ["engineering", "owner"], gate_result: ["engineering"],
  // N4b · a hold switch for any scheduled desk job (engineering or the owner).
  job_hold: HOLD_ACTORS, job_release: HOLD_ACTORS,
  // N5 · the publisher enters the week's audience numbers; the scout appends terms readings; a brand candidate's status is the owner's,
  // except `added`, which the engineering desk marks once the crawler's seed list carries it (the store enforces which status).
  audience: ["publisher", "owner"], source_note: ["scout", "owner"], candidate_status: ["engineering", "owner"],
};
/** N3 · the reason standards gives when it releases a story only its second reader held. */
export const OVERRULE_MIN = 20;
export const deskBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check") }).strict(),
  z.object({ action: z.literal("staff"), page: z.enum(STAFF_PAGES) }).strict(),
  z.object({ action: z.literal("queue"), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict(),
  z.object({ action: z.literal("pin"), id, until: z.string().datetime({ offset: true }), note }).strict(),
  z.object({ action: z.literal("kill"), id, reason: z.string().min(3).max(300), note }).strict(),
  z.object({ action: z.literal("correct"), id, headline: z.string().min(3).max(200).refine(noDollar).optional(), deck: z.string().max(400).refine(noDollar).optional(), why_line: z.string().max(WHY_MAX_CHARS).refine(noDollar).optional(), note })
    .strict().refine(b => b.headline !== undefined || b.deck !== undefined || b.why_line !== undefined, { message: "nothing to correct" }),
  z.object({ action: z.literal("restore"), id, note }).strict(),
  // N3 · the news desk's wire picks and drops, the graphics desk's picture choice, and the data desk's findings.
  z.object({ action: z.literal("wire_pick"), item: z.number().int().min(1), subject: z.enum(WIRE_SUBJECTS), line: z.string().trim().min(3).max(120).refine(noDollar), domain: z.string().trim().max(253).optional(), call: z.number().int().min(1).optional() }).strict(),
  z.object({ action: z.literal("wire_drop"), pick: z.number().int().min(1), reason: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("picture"), id, choice: z.enum(PICTURE_CHOICES), assets: z.array(z.string().trim().min(3).max(300)).max(4).optional(), reason: z.string().trim().min(3).max(600), verdict: z.enum(["keep", "alternate", "none", "fallback"]).optional(), call: z.number().int().min(1).optional(), per_picture: z.array(z.object({ asset: z.string().max(300), usable: z.boolean(), why: z.string().max(300) }).strict()).max(8).optional() }).strict()
    .refine(b => (b.choice === "crop" || b.choice === "pair") === !!b.assets?.length, { message: "a crop or pair names its stored crops; rule and none name none", path: ["assets"] })
    .refine(b => b.choice !== "pair" || b.assets?.length === 2, { message: "a pair is two crops: before, then after", path: ["assets"] }),
  z.object({ action: z.literal("finding"), kind: z.enum(FINDING_KINDS), key: z.string().trim().min(3).max(300), subject: z.string().trim().min(1).max(300), measure: z.string().trim().max(120).optional(), expected: z.string().max(600).optional(), found: z.string().max(600).optional(), receipt: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ action: z.literal("finding_close"), finding: z.number().int().min(1), reason: z.string().trim().min(3).max(600) }).strict(),
  z.object({ action: z.literal("data_run"), run: z.enum(["checks", "backtest", "share", "proposal", "chart", "picks", "health", "design review", "package", "drafts", "candidates"]), ref: z.string().trim().min(3).max(200).optional(), summary: z.string().trim().min(3).max(600), counts: z.record(z.string().max(40), z.number().int().min(0)).optional() }).strict(),
  // N4 · one page at one width from a review run (the outside browser job); the build queue: file, move, and a gate result.
  z.object({ action: z.literal("review"), run: z.string().trim().min(1).max(RUN_MAX).regex(/^[A-Za-z0-9][A-Za-z0-9 ._:-]*$/, "letters, digits, spaces and . _ : -"), kind: z.enum(REVIEW_KINDS), page: z.enum(REVIEW_PAGE_IDS), path: z.string().trim().min(1).max(300),
    width: z.union([z.literal(1440), z.literal(768), z.literal(390)]), against: z.string().trim().min(1).max(RUN_MAX).optional(), measures: measuresSchema,
    picture: z.string().min(16).max(PICTURE_B64_MAX, "the picture is far over 150 KB").regex(/^[A-Za-z0-9+/]+={0,2}$/, "the picture must be base64").optional() }).strict()
    .refine(b => pathOk(b.page, b.path), { message: "the path is not this page's address", path: ["path"] }),
  z.object({ action: z.literal("queue_add"), title: z.string().trim().min(3).max(140).refine(noDollar), why: z.string().trim().min(3).max(600).refine(noDollar), kind: z.enum(QUEUE_KINDS), expects: z.enum(EXPECTS),
    source: z.object({ kind: z.enum(SOURCE_KINDS), log: z.number().int().min(1).optional(), ref: z.string().trim().min(1).max(200).optional() }).strict().optional(),
    key: z.string().trim().min(3).max(200).optional(), move: z.object({ setting: z.string().min(1).max(40), from: z.unknown().optional(), to: z.unknown() }).strict().optional(), test: z.boolean().optional() }).strict()
    .refine(b => (b.source?.kind === "proposal") === (b.source?.log !== undefined), { message: "a proposal source names its desk-log id (log), and only a proposal source does", path: ["source"] })
    .refine(b => b.kind === "design move" || b.move === undefined, { message: "only a design move names a setting move", path: ["move"] }),
  z.object({ action: z.literal("queue_move"), item: z.number().int().min(1), to: z.enum(QUEUE_STATUSES), reason: z.string().trim().min(3).max(600).optional() }).strict(),
  z.object({ action: z.literal("gate_result"), item: z.number().int().min(1), commit: z.string().trim().regex(/^[0-9a-fA-F]{7,40}$/, "a commit sha"), tests: z.object({ passed: z.number().int().min(0), failed: z.number().int().min(0), skipped: z.number().int().min(0) }).strict(),
    before_run: z.string().trim().min(1).max(RUN_MAX), after_run: z.string().trim().min(1).max(RUN_MAX) }).strict(),
  // N4b · hold a scheduled desk job until a time (at most seven days ahead), or release it; both carry a reason.
  z.object({ action: z.literal("job_hold"), job: z.enum(HOLD_JOBS), until: z.string().datetime({ offset: true }), reason: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("job_release"), job: z.enum(HOLD_JOBS), reason: z.string().trim().min(3).max(300) }).strict(),
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
  z.object({ action: z.literal("spend"), credits: z.number().positive().max(100_000), what: z.string().trim().min(3).max(300).refine(noDollar), item: z.number().int().min(1).optional() }).strict(),
  z.object({ action: z.literal("spend_cap"), model_usd: z.number().min(0).max(100_000).nullable(), build_credits: z.number().min(0).max(1_000_000).nullable(), reason: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("wire_only"), on: z.boolean(), reason: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("propose"), kind: z.enum(PROPOSAL_KINDS), subject: z.string().trim().min(1).max(200).optional(), text: z.string().trim().min(3).max(1000) }).strict(),
  // N2 · a desk puts a published or reviewed story back to held (with the reason its page shows), leaves a note for the other desks,
  // and the owner sets a proposal's status.
  z.object({ action: z.literal("hold"), id, reason: z.string().trim().min(3).max(300).refine(noDollar), note }).strict(),
  z.object({ action: z.literal("note"), subject_kind: z.enum(NOTE_SUBJECTS), subject: z.string().trim().min(1).max(200), text: z.string().trim().min(3).max(1000) }).strict(),
  // The copy desk's weekly sweep (inside the product only): one page's failing lines, or the week's closing summary (page "(week)").
  z.object({ action: z.literal("copy_sweep"), page: z.string().trim().min(1).max(200), kind: z.enum(["story", "study", "week"]), lines: z.array(z.object({ lint: z.string().max(40), line: z.string().max(200), where: z.string().max(80) }).strict()).max(15), summary: z.string().trim().min(3).max(300) }).strict(),
  z.object({ action: z.literal("proposal_status"), log: z.number().int().min(1), status: z.enum(PROPOSAL_STATUSES), reason: z.string().trim().min(3).max(300).optional() }).strict(),
  // N5 · the publisher's drafts (the owner sets every status; nothing posts), the week's audience numbers (counts only), the scout's
  // terms readings and the brand candidates' statuses.
  z.object({ action: z.literal("draft_status"), draft: z.number().int().min(1), status: z.enum(["approved", "posted", "declined"]), reason: z.string().trim().min(3).max(300).optional() }).strict(),
  audienceBody.extend({ action: z.literal("audience") }).strict(),
  sourceNoteBody.extend({ action: z.literal("source_note") }).strict(),
  z.object({ action: z.literal("candidate_status"), candidate: z.number().int().min(1), status: z.enum(["accepted", "declined", "added"]), reason: z.string().trim().min(3).max(300).optional() }).strict(),
]);
/** N1 · the call envelope every desk call carries beside its action: who is acting, and the owner's confirmation phrase when needed. */
export const envelopeKeys = ["actor", "confirm"] as const;
export type DeskBody = z.infer<typeof deskBody>;
/** Pin must end in the future and within PIN_MAX_DAYS. */
export const pinOk = (until: string, now: number) => { const t = Date.parse(until); return t > now && t <= now + PIN_MAX_DAYS * 864e5; };
