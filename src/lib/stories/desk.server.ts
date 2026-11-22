// POST /api/public/desk — the editor's machine endpoint (queue, edits, and the staff pages' data). Crawler-secret auth (compared by SHA-256) BEFORE the body is read;
// per-IP rate limit; every write is an appended row (stories are never changed). N1: every authenticated call goes through the door below
// (actor, level, desk log).
import { createRateLimiter } from "../mcp/rate-limit";
import { DESK_BODY_LIMIT, DESK_RATE_PER_MIN, DESK_REVIEW_BODY_LIMIT, deskBody, pinOk, type DeskBody, type StaffPage } from "./desk";
import type { EditRow } from "./edits";

const NO_STORE = { "cache-control": "no-store" };
const j = (status: number, body: unknown) => Response.json(body, { status, headers: NO_STORE });
const ipOf = (r: Request) => r.headers.get("cf-connecting-ip") ?? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
async function bounded(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) return null;
  const reader = request.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel().catch(() => {}); return null; } chunks.push(value); }
  const all = new Uint8Array(size); let o = 0; for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(all);
}
/** L1 · the design editions: their records, and one appended status row per approval or roll-back. */
export type LivingStore = { records: () => Promise<import("../living/editions").EditionRecord[]>; insertStatus: (row: { edition: number; status: "approved" | "rolled back"; note: string | null }) => Promise<void> };
type LogRow = import("../newsroom/log").LogRow;
/** N1 · the newsroom's stores; each is optional so a test can supply only what it exercises. */
export type NewsroomStore = {
  log?: (r: LogRow) => Promise<void | number>;
  memory?: () => Promise<unknown>;
  newsroom?: (desk: string | null) => Promise<unknown>;
  assign?: (r: { pitch_id: number; desk: string; status: string; actor: string; reason: string | null }) => Promise<unknown | null>;
  spend?: (r: { credits: number; what: string; actor: string }) => Promise<unknown>;
  spendCap?: (r: { model_usd: number | null; build_credits: number | null; reason: string }) => Promise<void>;
  wireOnly?: (on: boolean, reason: string) => Promise<void>;
  capReached?: () => Promise<boolean>;
  /** After a story edit: record the states it implies. Never fails the call. */
  afterEdit?: (storyId: string) => Promise<void>;
  /** N2 · where a story stands for the door's release rule: its state, whether it awaits review, which desk held it, and whether
   *  standards passed what it shows now. */
  holdOf?: (id: string) => Promise<{ state: string; pending: boolean; heldBy: string | null; standardsPassed: boolean; secondReaderOnly?: boolean } | null>;
  /** N3 · standards releases a story only its second reader held: a pass "over its second reader", then the editor in chief places it. */
  overrule?: (r: { story_id: string; reason: string }) => Promise<boolean>;
  /** N3 · the news desk's picks (five a day at most, outlet items only, never twice) and drops. */
  wirePick?: (r: { item_id: number; subject: string; line: string; domain: string | null; call_id: number | null; actor: string }, now: number) => Promise<{ id: number } | { refused: string }>;
  wireDrop?: (r: { pick_id: number; actor: string; reason: string }) => Promise<{ id: number } | null>;
  /** N3 · the graphics desk's picture choice: checked against the stored crops and the quality gate before it is recorded. */
  pictureCheck?: (r: { story_id: string; kind: string; assets: string[] }) => Promise<string | null>;
  picture?: (r: { story_id: string; actor: string; kind: string; assets: string[]; verdict: string; reason: string; per_picture: unknown[]; call_id: number | null }) => Promise<{ id: number }>;
  /** N3 · the data desk's findings: an open finding with the same key is not opened twice. */
  finding?: (r: { kind: string; fkey: string; subject: string; measure: string | null; expected: string | null; found: string | null; receipt: Record<string, unknown>; actor: string }) => Promise<{ id: number; existing: boolean }>;
  findingClose?: (r: { finding_id: number; actor: string; reason: string }) => Promise<{ id: number } | null>;
  note?: (r: { actor: string; subject_kind: string; subject_id: string; text: string }) => Promise<unknown>;
  proposalStatus?: (r: { log_id: number; status: string; reason: string | null }) => Promise<unknown | null>;
  /** L2 · a proposal's desk and text (to link an accepted chart form to the build queue). */
  proposalOf?: (log_id: number) => Promise<{ desk: string; text: string } | null>;
  /** N4 · page reviews, the build queue, gate results, and whether a queue item exists (for spend). */
  review?: (r: { run: string; kind: import("../newsroom/design-review").ReviewKind; page: import("../newsroom/design-review").ReviewPageId; path: string; width: number; against: string | null; measures: import("../newsroom/design-review").Measures; picture: string | null; actor: string }) => Promise<{ id: number; picture: string | null } | { refused: string }>;
  queueAdd?: (r: { title: string; why: string; desk: string; kind: string; expects: string; source_kind: string; source_ref: string | null; proposal_log_id: number | null; ikey: string | null; move: unknown; test: boolean; phase?: string }) => Promise<{ id: number; existing: boolean } | { refused: string }>;
  queueMove?: (r: { item: number; to: string; actor: string; reason: string | null }) => Promise<{ status: string } | { refused: string } | null>;
  gateResult?: (r: { item: number; commit: string; tests: { passed: number; failed: number; skipped: number }; before_run: string; after_run: string; actor: string }) => Promise<{ id: number; pass: boolean; checks: unknown[] } | { refused: string } | null>;
  queueItemExists?: (id: number) => Promise<boolean>;
  /** N4b · the job holds in force. */
  jobHolds?: () => Promise<import("../newsroom/passes").Hold[]>;
  /** N5 · the publisher's draft statuses and audience weeks, the scout's terms readings and candidate statuses (each store checks the
   *  move against its current status). */
  draftStatus?: (r: { draft: number; status: string; reason: string | null }) => Promise<{ status: string } | { refused: string } | null>;
  audience?: (r: import("../newsroom/publisher").AudienceInput & { actor: string }) => Promise<{ id: number; replaces: number | null }>;
  sourceNote?: (r: { source: string; status: string; read_on: string | null; link: string | null; note: string; actor: string }) => Promise<{ id: number }>;
  candidateStatus?: (r: { candidate: number; status: string; actor: string; reason: string | null }) => Promise<{ status: string } | { refused: string } | null>;
};
export type DeskStore = NewsroomStore & { living?: LivingStore; pitch?: (p: import("./pitch").PitchInput) => Promise<unknown>; exists: (id: string) => Promise<boolean>; insertEdit: (e: Omit<EditRow, "id" | "at">) => Promise<EditRow>; queue: (day: string | null) => Promise<unknown>; staff?: (page: StaffPage) => Promise<unknown> };
export type DeskDeps = { authorize: (r: Request) => Promise<boolean>; store: DeskStore; allow: (ip: string) => boolean; now: () => number };
const limiter = createRateLimiter(DESK_RATE_PER_MIN, 60_000);

type Outcome = { status: number; body: unknown; decision: LogRow["decision"]; reason?: string | null; edit_id?: number | null; detail?: Record<string, unknown> };
const subjectOf = (b: DeskBody): string | null =>
  "id" in b ? b.id : b.action === "pitch" ? b.ref : b.action === "assign" ? String(b.pitch) : b.action === "living_approve" || b.action === "living_rollback" ? String(b.edition)
    : b.action === "wire_only" ? "wire_only" : b.action === "propose" ? (b.subject ?? b.kind) : b.action === "queue" ? (b.day ?? null) : b.action === "staff" ? b.page
    : b.action === "note" ? (b.subject_kind === "story" || b.subject_kind === "study" ? b.subject : `${b.subject_kind}:${b.subject}`) : b.action === "proposal_status" ? `log:${b.log}` : b.action === "copy_sweep" ? b.page
    : b.action === "wire_pick" ? `item:${b.item}` : b.action === "wire_drop" ? `pick:${b.pick}` : b.action === "finding" ? b.key : b.action === "finding_close" ? `finding:${b.finding}` : b.action === "data_run" ? (b.ref ?? b.run)
    : b.action === "review" ? `${b.run}:${b.page}@${b.width}` : b.action === "queue_add" ? (b.key ?? b.title) : b.action === "queue_move" || b.action === "gate_result" ? `item:${b.item}` : b.action === "job_hold" || b.action === "job_release" ? `job:${b.job}`
    : b.action === "draft_status" ? `draft:${b.draft}` : b.action === "audience" ? b.week : b.action === "source_note" ? `source:${b.source}` : b.action === "candidate_status" ? `candidate:${b.candidate}` : null;

/**
 * N1 · THE DOOR. Every authenticated call is logged in the desk log (allowed, proposed, refused or failed) with its actor, level,
 * subject, decision and reason; unauthenticated and rate-limited calls are answered before the body is read and are not logged (they
 * carry no actor, and logging them would let anyone write to the table). Levels and refusals come from the pure register and door.
 */
export async function handleDesk(request: Request, deps?: DeskDeps): Promise<Response> {
  if (request.method !== "POST") return j(405, { error: "method_not_allowed" });
  const d = deps ?? await prodDeps();
  if (!d.allow(ipOf(request))) return j(429, { error: "rate_limited" });
  if (!(await d.authorize(request))) return j(401, { error: "unauthorized" });
  // N4 · a review may carry one small picture; every other action keeps the 8 KB limit (checked once the action is known).
  const text = await bounded(request, DESK_REVIEW_BODY_LIMIT);
  if (text === null) return refuse(d, 413, "unknown", "unknown", "The body is larger than the desk accepts.", { error: "body_too_large" });
  let raw: unknown; try { raw = JSON.parse(text); } catch { return refuse(d, 400, "unknown", "unknown", "The body is not JSON.", { error: "invalid_json" }); }
  if (text.length > DESK_BODY_LIMIT && !(raw && typeof raw === "object" && (raw as Record<string, unknown>)["action"] === "review")) {
    const o = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return refuse(d, 413, typeof o["actor"] === "string" ? String(o["actor"]).slice(0, 40) : "unknown", typeof o["action"] === "string" ? String(o["action"]).slice(0, 40) : "unknown", "The body is larger than the desk accepts.", { error: "body_too_large" });
  }
  const r = await doorCall(d, raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {});
  return j(r.status, r.body);
}
const logWith = (d: DeskDeps) => async (r: LogRow): Promise<number | null> => { if (!d.store.log) return null; const id = await d.store.log(r).catch(() => { console.error("desk_log_failed"); return null; }); return typeof id === "number" ? id : null; };
async function refuse(d: DeskDeps, status: number, actor: string, action: string, reason: string, body: Record<string, unknown>) {
  const { actionDef } = await import("../newsroom/register"), def = actionDef(action);
  await logWith(d)({ actor, action, level: def?.level ?? null, subject_kind: def?.subject ?? null, subject_id: null, decision: "refused", reason });
  return j(status, body);
}
/**
 * N2 · the door's own code path, after the key: the HTTP endpoint and the desks inside the product (standards and the editor in chief
 * on every story build) both call it, so every desk decision is decided by the same register and lands in the desk log with its actor.
 */
export async function doorCall(d: DeskDeps, obj: Record<string, unknown>, inner: { pass?: boolean } = {}): Promise<{ status: number; body: unknown }> {
  const [{ ACTORS, isActor }, { actionDef }, { decide }] = await Promise.all([import("../newsroom/desks"), import("../newsroom/register"), import("../newsroom/door")]);
  const log = logWith(d);
  const refused = async (status: number, actor: string, action: string, reason: string, body: Record<string, unknown>) => { const res = await refuse(d, status, actor, action, reason, body); return { status: res.status, body }; };
  const { actor, confirm, ...rest } = obj;
  const action = typeof rest["action"] === "string" ? String(rest["action"]).slice(0, 40) : "unknown";
  if (!isActor(actor)) return refused(400, typeof actor === "string" && actor.trim() ? actor.trim().slice(0, 40) : "unknown", action, "Every call names its actor: one of the desks, or owner.", { error: "actor_required", actors: ACTORS });
  const p = deskBody.safeParse(rest);
  if (!p.success) { const issues = p.error.issues.slice(0, 5).map(i => ({ path: i.path.join("."), message: i.message })); return refused(400, actor, action, `Invalid input: ${issues.map(i => `${i.path || "body"} ${i.message}`).join("; ")}`.slice(0, 600), { error: "invalid_input", issues }); }
  const b = p.data, def = actionDef(b.action)!;
  const capReached = def.costs && d.store.capReached ? await d.store.capReached().catch(() => true) : false;
  const verdict = decide(def, { actor, confirm }, { capReached });
  // A note on a brand or a signal has no subject kind of its own in the log: it is logged as "none" with the kind in its subject id.
  const subjectKind = b.action === "note" ? (b.subject_kind === "story" || b.subject_kind === "study" ? b.subject_kind : "none") : b.action === "copy_sweep" ? (b.kind === "week" ? "week" : b.kind) : def.subject;
  const base = { actor, action: b.action, level: def.level, subject_kind: subjectKind, subject_id: subjectOf(b) };
  if (verdict.kind === "refused") { await log({ ...base, decision: "refused", reason: verdict.reason }); return { status: 403, body: { error: "refused", level: def.level, reason: verdict.reason, ...(verdict.confirm ? { confirm: verdict.confirm } : {}) } }; }
  if (verdict.kind === "proposal") {
    const detail = b.action === "propose" ? { kind: b.kind, text: b.text } : {};
    const id = await log({ ...base, decision: "proposed", reason: b.action === "propose" ? b.text.slice(0, 600) : null, detail });
    // N4 · the proposal's desk-log id, so a queue item can name it as its source.
    return { status: 202, body: { ok: true, proposed: true, level: def.level, note: "Recorded as a proposal; nothing live changed.", ...(id != null ? { log: id } : {}) } };
  }
  let out: Outcome;
  try { out = await run(b, actor, d, inner); }
  catch (e) { await log({ ...base, decision: "failed", reason: (e instanceof Error ? e.message : "error").slice(0, 200) }); throw e; }
  await log({ ...base, decision: out.decision, reason: out.reason ?? null, edit_id: out.edit_id ?? null, ...(out.detail ? { detail: out.detail } : {}) });
  if (out.edit_id != null && d.store.afterEdit && "id" in b) await d.store.afterEdit(b.id).catch(() => {});
  return { status: out.status, body: out.body };
}
/** N2 · the desks inside the product call the door as themselves (no HTTP, no key: they run inside the server). */
let inside: Promise<DeskDeps> | null = null;
export async function deskDoor(actor: string, body: Record<string, unknown>, inner: { /** N5 · a review pass's own verdict */ pass?: boolean } = {}): Promise<{ status: number; body: unknown }> {
  // The build records the state rows once at its end, so the inside door skips the after-edit refresh (one per edit would be heavy).
  inside ??= prodDeps().then(d => { const { afterEdit: _skip, ...store } = d.store; void _skip; return { ...d, store }; });
  return doorCall(await inside!, { actor, ...body }, inner);
}

async function run(b: DeskBody, actor: string, d: DeskDeps, inner: { pass?: boolean } = {}): Promise<Outcome> {
  const read = (body: unknown): Outcome => ({ status: 200, body, decision: "read" });
  const missing: Outcome = { status: 404, body: { error: "not_found" }, decision: "refused", reason: "Not available here." };
  if (b.action === "check") return read({ ok: true });
  if (b.action === "staff") return d.store.staff ? read(await d.store.staff(b.page)) : missing;
  if (b.action === "queue") return read(await d.store.queue(b.day ?? null));
  if (b.action === "memory") return d.store.memory ? read(await d.store.memory()) : missing;
  if (b.action === "newsroom") return d.store.newsroom ? read(await d.store.newsroom(b.desk ?? null)) : missing;
  if (b.action === "pitch") { if (!d.store.pitch) return missing; const { action: _, ...p } = b; return { status: 201, body: { ok: true, pitched: await d.store.pitch(p) }, decision: "done" }; }
  if (b.action === "assign") {
    if (!d.store.assign) return missing;
    const a = await d.store.assign({ pitch_id: b.pitch, desk: b.desk, status: b.status, actor, reason: b.reason ?? null });
    return a ? { status: 201, body: { ok: true, assignment: a }, decision: "done", reason: b.reason ?? null } : { ...missing, reason: "No such pitch." };
  }
  if (b.action === "spend") {
    if (!d.store.spend) return missing;
    if (b.item != null && !(d.store.queueItemExists && await d.store.queueItemExists(b.item))) return { ...missing, reason: "No such queue item." };
    return { status: 201, body: { ok: true, entry: await d.store.spend({ credits: b.credits, what: b.what, actor, ...(b.item != null ? { queue_item: b.item } : {}) }) }, decision: "done", reason: b.what, ...(b.item != null ? { detail: { item: b.item } } : {}) };
  }
  if (b.action === "spend_cap") { if (!d.store.spendCap) return missing; await d.store.spendCap({ model_usd: b.model_usd, build_credits: b.build_credits, reason: b.reason }); return { status: 201, body: { ok: true, cap: b.model_usd == null && b.build_credits == null ? null : { model_usd: b.model_usd, build_credits: b.build_credits } }, decision: "done", reason: b.reason }; }
  if (b.action === "wire_only") { if (!d.store.wireOnly) return missing; await d.store.wireOnly(b.on, b.reason); return { status: 201, body: { ok: true, wire_only: b.on }, decision: "done", reason: b.reason, detail: { on: b.on } }; }
  if (b.action === "propose") return { status: 202, body: { ok: true, proposed: true }, decision: "proposed" };
  if (b.action === "living_approve" || b.action === "living_rollback") {
    if (!d.store.living) return missing;
    const records = await d.store.living.records();
    const decision = b.action === "living_approve" ? (await import("../living/gate")).approveDecision(records, b.edition) : (await import("../living/editions")).rollbackDecision(records, b.edition);
    if (!decision.ok) return { status: 409, body: { error: "refused", reasons: decision.reasons }, decision: "refused", reason: decision.reasons.join("; ").slice(0, 600) || "The gate refused it." };
    await d.store.living.insertStatus({ edition: b.edition, status: decision.status as "approved" | "rolled back", note: b.note ?? null });
    return { status: 201, body: { ok: true, edition: b.edition, status: decision.status, ...(decision.restores ? { restores: decision.restores } : {}) }, decision: "done", reason: b.note ?? null };
  }
  if (b.action === "note") { if (!d.store.note) return missing; const n = await d.store.note({ actor, subject_kind: b.subject_kind, subject_id: b.subject, text: b.text }); return { status: 201, body: { ok: true, note: n }, decision: "done", reason: b.text.slice(0, 600) }; }
  if (b.action === "copy_sweep") return { status: 201, body: { ok: true }, decision: "done", reason: b.summary, detail: { page: b.page, lines: b.lines } };
  // N3 · who may take the new actions (the register says the level; this says the desk).
  const { N3_ACTORS, OVERRULE_MIN } = await import("./desk");
  const allowed = N3_ACTORS[b.action];
  if (allowed && !allowed.includes(actor)) return { status: 403, body: { error: "refused", reason: `${b.action} is taken by ${allowed.join(", ")}.` }, decision: "refused", reason: `${actor} cannot take ${b.action}.` };
  if (b.action === "wire_pick") {
    if (!d.store.wirePick) return missing;
    const r = await d.store.wirePick({ item_id: b.item, subject: b.subject, line: b.line, domain: b.domain ?? null, call_id: b.call ?? null, actor }, d.now());
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: 201, body: { ok: true, pick: r.id }, decision: "done", reason: b.line, detail: { item: b.item, subject: b.subject, domain: b.domain ?? null, pick: r.id } };
  }
  if (b.action === "wire_drop") {
    if (!d.store.wireDrop) return missing;
    const r = await d.store.wireDrop({ pick_id: b.pick, actor, reason: b.reason });
    return r ? { status: 201, body: { ok: true, drop: r.id }, decision: "done", reason: b.reason } : { ...missing, reason: "No such pick, or it was dropped already." };
  }
  if (b.action === "finding") {
    if (!d.store.finding) return missing;
    const r = await d.store.finding({ kind: b.kind, fkey: b.key, subject: b.subject, measure: b.measure ?? null, expected: b.expected ?? null, found: b.found ?? null, receipt: b.receipt ?? {}, actor });
    return { status: r.existing ? 200 : 201, body: { ok: true, finding: r.id, existing: r.existing }, decision: "done", reason: `${b.kind}: ${b.subject}${b.found ? ` · ${b.found}` : ""}`.slice(0, 600), detail: { finding: r.id, existing: r.existing } };
  }
  if (b.action === "finding_close") {
    if (!d.store.findingClose) return missing;
    const r = await d.store.findingClose({ finding_id: b.finding, actor, reason: b.reason });
    return r ? { status: 201, body: { ok: true, close: r.id }, decision: "done", reason: b.reason } : { ...missing, reason: "No such open finding." };
  }
  if (b.action === "data_run") return { status: 201, body: { ok: true }, decision: "done", reason: b.summary, detail: { run: b.run, counts: b.counts ?? {} } };
  // N4 · page reviews, the build queue and the gate. The order, the owner's yes and the gate's pass are enforced in the stores' rules.
  if (b.action === "review") {
    if (!d.store.review) return missing;
    const r = await d.store.review({ run: b.run, kind: b.kind, page: b.page, path: b.path, width: b.width, against: b.against ?? null, measures: b.measures, picture: b.picture ?? null, actor });
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: 201, body: { ok: true, review: r.id, picture: r.picture != null, test: b.kind === "test" }, decision: "done", reason: `${b.kind} run ${b.run}: ${b.page} at ${b.width} px`, detail: { run: b.run, kind: b.kind, page: b.page, width: b.width, review: r.id, measured: Object.keys(b.measures).length, picture: r.picture != null } };
  }
  if (b.action === "queue_add") {
    if (!d.store.queueAdd) return missing;
    const src = b.source ?? { kind: "none" as const };
    const phaseWhy = (await import("../newsroom/queue")).phaseProblem(b.kind, b.phase);
    if (phaseWhy) return { status: 409, body: { error: "refused", reason: phaseWhy }, decision: "refused", reason: phaseWhy };
    const r = await d.store.queueAdd({ title: b.title, why: b.why, desk: actor, kind: b.kind, expects: b.expects, source_kind: src.kind, source_ref: src.ref ?? (src.log != null ? `log:${src.log}` : null), proposal_log_id: src.kind === "proposal" ? src.log ?? null : null, ikey: b.key ?? null, move: b.move ?? null, test: b.test ?? false, ...(b.kind === "phase" ? { phase: b.phase!.trim() } : {}) });
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: r.existing ? 200 : 201, body: { ok: true, item: r.id, existing: r.existing }, decision: "done", reason: `${b.kind}${b.kind === "phase" ? ` ${b.phase!.trim()}` : ""} · ${b.title}${b.test ? " (test)" : ""}`.slice(0, 600), detail: { item: r.id, existing: r.existing, kind: b.kind, expects: b.expects, test: b.test ?? false, ...(b.kind === "phase" ? { phase: b.phase!.trim() } : {}) } };
  }
  if (b.action === "queue_move") {
    if (!d.store.queueMove) return missing;
    const r = await d.store.queueMove({ item: b.item, to: b.to, actor, reason: b.reason ?? null });
    if (!r) return { ...missing, reason: "No such queue item." };
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: 201, body: { ok: true, item: b.item, status: r.status }, decision: "done", reason: `${b.to}${b.reason ? `: ${b.reason}` : ""}`.slice(0, 600), detail: { item: b.item, to: b.to } };
  }
  if (b.action === "gate_result") {
    if (!d.store.gateResult) return missing;
    const r = await d.store.gateResult({ item: b.item, commit: b.commit, tests: b.tests, before_run: b.before_run, after_run: b.after_run, actor });
    if (!r) return { ...missing, reason: "No such queue item." };
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: 201, body: { ok: true, gate: r.id, pass: r.pass, checks: r.checks }, decision: "done", reason: `Gate ${r.pass ? "passed" : "failed"} for item ${b.item} at ${b.commit.slice(0, 12)}`, detail: { item: b.item, gate: r.id, pass: r.pass } };
  }
  // N4b · the hold switch: the hold's end must be in the future and at most seven days ahead; a release needs a hold in force.
  if (b.action === "job_hold") {
    const { holdUntilProblem } = await import("../newsroom/passes");
    const why = holdUntilProblem(b.until, d.now());
    if (why) return { status: 400, body: { error: "invalid_input", issues: [{ path: "until", message: why }] }, decision: "refused", reason: `Hold refused: ${why}.` };
    const until = new Date(b.until).toISOString();
    return { status: 201, body: { ok: true, job: b.job, until }, decision: "done", reason: b.reason, detail: { job: b.job, until } };
  }
  if (b.action === "job_release") {
    if (!d.store.jobHolds) return missing;
    if (!(await d.store.jobHolds()).some(h => h.job === b.job)) return { status: 409, body: { error: "refused", reason: `No hold on ${b.job} is in force.` }, decision: "refused", reason: `No hold on ${b.job} is in force.` };
    return { status: 201, body: { ok: true, job: b.job, released: true }, decision: "done", reason: b.reason, detail: { job: b.job } };
  }
  // N5 · the publisher's and scout's records. Every status move is checked against the current status by its store.
  if (b.action === "draft_status") {
    if (!d.store.draftStatus) return missing;
    const r = await d.store.draftStatus({ draft: b.draft, status: b.status, reason: b.reason ?? null });
    if (!r) return { ...missing, reason: "No such draft." };
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: 201, body: { ok: true, draft: b.draft, status: r.status }, decision: "done", reason: `${b.status}${b.reason ? `: ${b.reason}` : ""}`.slice(0, 600), detail: { draft: b.draft, status: b.status } };
  }
  if (b.action === "audience") {
    if (!d.store.audience) return missing;
    const { action: _a, ...a } = b; void _a;
    const r = await d.store.audience({ ...a, test: a.test ?? false, actor });
    return { status: 201, body: { ok: true, audience: r.id, replaces: r.replaces }, decision: "done", reason: `${b.week}: ${b.visitors} visitors, ${b.pageviews} pageviews${b.test ? " (test)" : ""}`, detail: { week: b.week, row: r.id, replaces: r.replaces, paths: b.top.length, sources: b.sources.length, test: b.test ?? false } };
  }
  if (b.action === "source_note") {
    if (!d.store.sourceNote) return missing;
    const r = await d.store.sourceNote({ source: b.source, status: b.status, read_on: b.read_on ?? null, link: b.link ?? null, note: b.note, actor });
    return { status: 201, body: { ok: true, note: r.id }, decision: "done", reason: `${b.source}: ${b.status} · ${b.note}`.slice(0, 600), detail: { source: b.source, status: b.status, read_on: b.read_on ?? null } };
  }
  if (b.action === "candidate_status") {
    if (!d.store.candidateStatus) return missing;
    const r = await d.store.candidateStatus({ candidate: b.candidate, status: b.status, actor, reason: b.reason ?? null });
    if (!r) return { ...missing, reason: "No such candidate." };
    if ("refused" in r) return { status: 409, body: { error: "refused", reason: r.refused }, decision: "refused", reason: r.refused };
    return { status: 201, body: { ok: true, candidate: b.candidate, status: r.status }, decision: "done", reason: `${b.status}${b.reason ? `: ${b.reason}` : ""}`.slice(0, 600), detail: { candidate: b.candidate, status: b.status } };
  }
  if (b.action === "proposal_status") {
    if (!d.store.proposalStatus) return missing;
    const r = await d.store.proposalStatus({ log_id: b.log, status: b.status, reason: b.reason ?? null });
    if (!r) return { ...missing, reason: "No such proposal." };
    // L2 · an accepted chart-form proposal goes on the build queue as a `feature` linked to it; the form becomes live in the registry
    // only in a build that passed the gate.
    if (b.status === "accepted" && d.store.proposalOf && d.store.queueAdd) {
      const p = await d.store.proposalOf(b.log), { chartFormOfProposal } = await import("../chart/forms");
      const f = p ? chartFormOfProposal(p.text) : null;
      if (f) {
        const q = await d.store.queueAdd({ title: `Make the chart form “${f.name}” live`.slice(0, 200), why: p!.text.slice(0, 600), desk: "graphics", kind: "feature", expects: `The registry marks “${f.id}” live in a build that passed the gate; /brand/system shows it without the proposed label and the colophon lists it under that edition.`, source_kind: "proposal", source_ref: `log:${b.log}`, proposal_log_id: b.log, ikey: `chart-form:${f.id}`, move: null, test: false });
        return { status: 201, body: { ok: true, status: r, ...("id" in q ? { queue_item: q.id } : { queue_refused: q.refused }) }, decision: "done", reason: b.reason ?? b.status, detail: { chart_form: f.id, ...("id" in q ? { queue_item: q.id } : {}) } };
      }
    }
    return { status: 201, body: { ok: true, status: r }, decision: "done", reason: b.reason ?? b.status };
  }
  if (!(await d.store.exists(b.id))) return { ...missing, reason: "No such story." };
  // N2 · the release rule: a story waiting for review runs only when the editor in chief places it (after standards passed it) or the
  // owner runs it; a story the standards desk held is released only by the editor in chief or the owner.
  if (b.action === "restore" || b.action === "pin" || b.action === "hold" || b.action === "picture") {
    const h = d.store.holdOf ? await d.store.holdOf(b.id) : null;
    // N3 · standards may release a story only its second reader held: every checklist item passed. It records a pass over the second
    // reader with the reason and sends the story to the editor in chief (no edit: the editor in chief places it). Never a checklist failure.
    if (b.action === "restore" && actor === "standards") {
      if (!h || h.state !== "held" || h.heldBy !== "standards" || !h.secondReaderOnly) return { status: 403, body: { error: "refused", reason: "Standards releases only a story its second reader alone held; a checklist failure is released only by the owner." }, decision: "refused", reason: "standards cannot release this story: not held by its second reader alone." };
      if ((b.note ?? "").trim().length < OVERRULE_MIN) return { status: 400, body: { error: "invalid_input", issues: [{ path: "note", message: `a reason of at least ${OVERRULE_MIN} characters` }] }, decision: "refused", reason: `A release over the second reader needs a reason of at least ${OVERRULE_MIN} characters.` };
      if (!d.store.overrule || !(await d.store.overrule({ story_id: b.id, reason: b.note!.trim() }))) return { ...missing, reason: "The pass could not be recorded." };
      return { status: 201, body: { ok: true, sent_to: "editor in chief" }, decision: "done", reason: `Passed over its second reader: ${b.note!.trim()}`.slice(0, 600) };
    }
    if (b.action === "picture") {
      if (!d.store.picture) return missing;
      const assets = b.assets ?? [];
      const bad = d.store.pictureCheck ? await d.store.pictureCheck({ story_id: b.id, kind: b.choice, assets }) : null;
      if (bad) return { status: 409, body: { error: "refused", reason: bad }, decision: "refused", reason: bad };
      const r = await d.store.picture({ story_id: b.id, actor, kind: b.choice, assets, verdict: b.verdict ?? "door", reason: b.reason, per_picture: b.per_picture ?? [], call_id: b.call ?? null });
      return { status: 201, body: { ok: true, choice: r.id }, decision: "done", reason: b.reason, detail: { choice: b.choice, assets } };
    }
    if (h && b.action === "hold" && h.state === "killed") return { status: 409, body: { error: "refused", reason: "A story that was taken down cannot be held; restore it first." }, decision: "refused", reason: "Only a published, reviewed or held story can be held." };
    if (h && b.action !== "hold" && actor !== "owner") {
      if (h.pending && (actor !== "editor in chief" || !h.standardsPassed)) return { status: 403, body: { error: "refused", reason: "A story waiting for review runs only when standards passed it and the editor in chief places it." }, decision: "refused", reason: `${actor} cannot run a story waiting for review.` };
      if (h.state === "held" && h.heldBy === "standards" && actor !== "editor in chief") return { status: 403, body: { error: "refused", reason: "A story the standards desk held is released only by the editor in chief or the owner." }, decision: "refused", reason: `${actor} cannot release a story standards held.` };
      // N5 · a hold by any desk is released only by a restore from the editor in chief or the owner (standards for a hold of its own,
      // through its release over the second reader above).
      if (h.state === "held" && h.heldBy && h.heldBy !== "engine" && actor !== "editor in chief") return { status: 403, body: { error: "refused", reason: "A held story is released only by the editor in chief or the owner." }, decision: "refused", reason: `${actor} cannot release a story ${h.heldBy} held.` };
      // N4c · the editor in chief releases a story standards held only after standards passed it since (a re-check after a checklist fix,
      // or a pass over its second reader); a checklist hold standing is released only by the owner.
      if (b.action === "restore" && h.state === "held" && h.heldBy === "standards" && actor === "editor in chief" && !h.standardsPassed) return { status: 403, body: { error: "refused", reason: "A story standards held runs only after standards passed it again; a checklist hold is released only by the owner." }, decision: "refused", reason: "editor in chief cannot release a story standards still holds." };
    }
  }
  if (b.action === "hold") {
    // N5 · a hold a review pass makes from its own verdict is marked as the pass's; any other hold (a desk session, the owner) is a
    // hold through the door, which no review pass ever offers again: only a restore releases it.
    const edit = await d.store.insertEdit({ story_id: b.id, action: "kill", payload: { reason: b.reason, hold: true, desk: actor, ...(inner.pass ? { pass: (await import("../newsroom/holds")).PASS_HOLD } : {}) }, note: `Held: ${b.reason}`.slice(0, 500) });
    return { status: 201, body: { ok: true, edit }, decision: "done", reason: b.reason, edit_id: edit.id };
  }
  if (b.action === "pin" && !pinOk(b.until, d.now())) return { status: 400, body: { error: "invalid_input", issues: [{ path: "until", message: "must be in the future and within 7 days" }] }, decision: "refused", reason: "A pin must end in the future and within seven days." };
  const payload: Record<string, unknown> = b.action === "pin" ? { until: new Date(b.until).toISOString() } : b.action === "kill" ? { reason: b.reason }
    : b.action === "correct" ? Object.fromEntries(Object.entries({ headline: b.headline, deck: b.deck, why_line: b.why_line }).filter(([, v]) => v !== undefined)) : {};
  const edit = await d.store.insertEdit({ story_id: b.id, action: b.action, payload, note: b.note ?? null });
  return { status: 201, body: { ok: true, edit }, decision: "done", reason: b.action === "kill" ? b.reason : b.note ?? null, edit_id: edit.id };
}

/** The real deps (exported for hand-run checks that supply their own authorize). */
export async function prodDeps(): Promise<DeskDeps> {
  const [{ authenticateQueueCaller }, { supabaseAdmin: db }, { loadQueue }] = await Promise.all([import("../crawl-requests.server"), import("@/integrations/supabase/client.server"), import("./page.server")]);
  return {
    authorize: authenticateQueueCaller, allow: ip => limiter(ip), now: Date.now,
    store: {
      exists: async id => { const { data, error } = await db.from("stories").select("id").eq("id", id).maybeSingle(); if (error) throw new Error("story_lookup_failed"); return !!data; },
      insertEdit: async e => { const { data, error } = await db.from("story_edits").insert(e as never).select("id,story_id,action,payload,note,at").single(); if (error || !data) throw new Error("edit_insert_failed"); return data as unknown as EditRow; },
      queue: async day => {
        const [{ newsWindow }, { listPitches }, nr] = await Promise.all([import("./page.server"), import("./pitch.server"), import("../newsroom/newsroom.server")]);
        const [q, news, pitches] = await Promise.all([loadQueue(day, true), newsWindow(), listPitches(db, 50).catch(() => [])]);
        // N1 · each story's state history beside it.
        const states = await nr.statesFor(db, [...q.published, ...q.held, ...q.killed].map(s => s.id)).catch(() => new Map());
        const withStates = <T extends { id: string }>(xs: T[]) => xs.map(x => ({ ...x, states: states.get(x.id) ?? [] }));
        return { ...q, published: withStates(q.published), held: withStates(q.held), killed: withStates(q.killed), news, pitches };
      },
      log: async r => (await import("../newsroom/newsroom.server")).insertLog(db, r),
      memory: async () => (await import("../newsroom/memory.server")).loadMemory(db),
      newsroom: async desk => {
        const [nr, mem, sp] = await Promise.all([import("../newsroom/newsroom.server"), import("../newsroom/memory.server"), import("../newsroom/spend")]);
        const [log, spend, board, golden, wire, desks, notes, proposals, reviews, n3] = await Promise.all([nr.loadHistory(db, { days: 14, actor: desk, limit: 300 }), nr.spendStatus(db).catch(() => null), nr.loadBoard(db).catch(() => null), mem.goldenView(), nr.wireOnlyOn(),
          nr.deskCaps(db).catch(() => null), nr.loadNotes(db).catch(() => []), nr.loadProposals(db).catch(() => []), nr.recentReviews(db).catch(() => []), import("../newsroom/panels.server").then(m => m.n3Panels(db)).catch(() => null)]);
        const n4 = await import("../newsroom/panels.server").then(m => m.n4Panels(db)).catch(() => null);
        const n5 = await import("../newsroom/panels.server").then(m => m.n5Panels(db)).catch(() => null);
        return { n5, log, spend: spend ? { ...spend, split: sp.spendSplit(spend), reached: sp.capReached(spend), line: sp.capLine(spend) } : null, register: mem.registerView(), board, golden, switches: { wire_only: wire }, desks, notes, proposals, reviews, n3, n4 };
      },
      assign: async r => (await import("../newsroom/newsroom.server")).insertAssignment(db, r),
      spend: async r => (await import("../newsroom/newsroom.server")).insertSpend(db, r),
      spendCap: async r => (await import("../newsroom/newsroom.server")).insertCap(db, r),
      wireOnly: async (on, reason) => { await (await import("../newsroom/newsroom.server")).setWireOnly(db, on, reason); },
      capReached: async () => (await import("../newsroom/newsroom.server")).capReachedNow(db),
      afterEdit: async () => { await (await import("../newsroom/newsroom.server")).syncStoryStates(db, { days: 120, force: true }); },
      pitch: async p => (await import("./pitch.server")).pitchNow(db, p),
      holdOf: async id => (await import("../newsroom/newsroom.server")).holdOf(db, id),
      note: async r => (await import("../newsroom/newsroom.server")).insertNote(db, r),
      proposalStatus: async r => (await import("../newsroom/newsroom.server")).insertProposalStatus(db, r),
      proposalOf: async id => { const { data } = await db.from("desk_log").select("actor,reason,detail").eq("id", id).eq("action", "propose").maybeSingle(); const t = (data?.detail as { text?: string } | null)?.text ?? data?.reason ?? null; return data && t ? { desk: data.actor, text: t } : null; },
      overrule: async r => (await import("../newsroom/newsroom.server")).insertOverrule(db, r),
      wirePick: async (r, now) => (await import("../newsroom/news.server")).insertPick(db, r, now),
      wireDrop: async r => (await import("../newsroom/news.server")).insertDrop(db, r),
      pictureCheck: async r => (await import("../newsroom/graphics.server")).checkChoice(r),
      picture: async r => (await import("../newsroom/graphics.server")).insertChoice(db, r),
      finding: async r => (await import("../newsroom/datadesk.server")).insertFinding(db, r),
      findingClose: async r => (await import("../newsroom/datadesk.server")).closeFinding(db, r),
      review: async r => (await import("../newsroom/design-review.server")).insertReview(db, r),
      queueAdd: async r => (await import("../newsroom/engineering.server")).insertQueueItem(db, r),
      queueMove: async r => (await import("../newsroom/engineering.server")).moveQueueItem(db, r),
      gateResult: async r => (await import("../newsroom/engineering.server")).recordGate(db, r),
      queueItemExists: async id => (await import("../newsroom/engineering.server")).queueItemExists(db, id),
      jobHolds: async () => (await import("../newsroom/passes.server")).heldJobs(db),
      draftStatus: async r => (await import("../newsroom/publisher.server")).insertDraftStatus(db, r),
      audience: async r => (await import("../newsroom/publisher.server")).insertAudience(db, r),
      sourceNote: async r => (await import("../newsroom/scout.server")).insertSourceNote(db, r),
      candidateStatus: async r => (await import("../newsroom/scout.server")).insertCandidateStatus(db, r),
      living: {
        records: async () => (await import("../living/living.server")).loadEditions(db),
        insertStatus: async row => { const { error } = await db.from("living_edition_status").insert(row); if (error) throw new Error("status_insert_failed"); },
      },
      // Staff pages (/status, /status/launch, /welcome) load only here, after the key: nothing reaches the page's HTML first.
      staff: async page => page === "launch" ? (await import("../launch/launch.server")).loadLaunch()
        : page === "welcome" ? (await import("../editions/welcome.server")).loadWelcome()
        : { ok: true },
    },
  };
}
