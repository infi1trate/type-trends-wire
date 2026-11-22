// N2 · THE ORDER OF WORK for a story: candidate → drafted → checked → reviewed → published (held, killed, retired as before).
// `reviewed` means standards passed it and the editor in chief placed it; a story is published only from reviewed. The engine stores a
// story it would run as held, "awaiting review"; the desks release it through the door (a restore by the editor in chief). When a
// desk's call fails or its daily cap is used, the story takes today's path (engine order, no second reader) and the state says so.
// A failing desk never stops the day's stories. Orchestration with injected I/O (review.server.ts is the real one); pure otherwise.
import { blockerReason, blockers, checklist, checklistReason, failed, type ItemResult, type Problem, type ReviewInput } from "./standards";
import { enforceChief, offerAgain, slotsFor, type ChiefAnswer, type ChiefInput, type ChiefStory, type Slots } from "./chief";
import { fnv } from "./golden/versions";

/** The desks review stories (true since N2). With it off, the engine publishes as before. */
export const DESKS_ON = true;
export const AWAITING = "awaiting review: standards, then the editor in chief";
export const isAwaitingReason = (r: string | null | undefined) => !!r && r.startsWith("awaiting review");
/** Waiting for review: stored held by the engine as awaiting review, with no desk edit since. */
export const isPending = (s: { state: string; reason: string; stored?: { status: string }; edits: { action: string }[] }) =>
  s.state === "held" && isAwaitingReason(s.reason) && !s.edits.some(e => e.action === "kill" || e.action === "restore" || e.action === "pin");
/** Daily model-call caps per desk (UTC day, like the writers); they count in the spend ledger like the writers. */
import { DESK_CAPS } from "./caps";
export { DESK_CAPS };
export type DeskName = keyof typeof DESK_CAPS;
/** A pending story is reviewed once its text is drafted, the writer cannot write it now, or it has waited this long. */
export const READY_AFTER_MS = 45 * 60_000;
/** A published story is checked again when an edit changed its facts within this window. */
export const RECHECK_HOURS = 48;
/** The editor in chief's lead holds the lead this long (a pin through the door). */
export const LEAD_PIN_HOURS = 24;
/** A model call is not started with less time than this before the review's deadline. */
export const DESK_CALL_MIN_MS = 12_000;
export const DESK_CONCURRENCY = 3;

export type Fallback = "cap used" | "call failed" | "time ran out";
export const reviewedLine = (o: { secondReader: Fallback | "ran"; chief: "placed" | "no decision" | Fallback; place: number; of: number; lead: boolean }) => {
  const sr = o.secondReader === "ran" ? "standards passed it" : `reviewed without second reader: ${o.secondReader}`;
  const ch = o.chief === "placed" ? (o.lead ? "the editor in chief led with it" : `the editor in chief placed it ${o.place} of ${o.of}`) : o.chief === "no decision" ? "placed in engine order (no decision to make)" : `placed in engine order without the editor in chief: ${o.chief}`;
  return `Reviewed: ${sr}; ${ch}.`;
};
/** What the reader-facing review covers, as one fingerprint: the story as shown and its facts sheet. A change re-checks a published story. */
export const factsHash = (i: Pick<ReviewInput, "kicker" | "headline" | "deck" | "body" | "howWeKnow" | "numbers" | "picture" | "sheet" | "facts">) =>
  fnv(JSON.stringify([i.kicker, i.headline, i.deck, i.body, i.howWeKnow, i.numbers, i.picture?.items.map(x => x.credit) ?? [], i.sheet ?? i.facts.map(f => f.text)]));
export const readyForReview = (p: { created_at: string; drafted: boolean }, o: { now: number; writerOut: boolean }) => p.drafted || o.writerOut || o.now - Date.parse(p.created_at) >= READY_AFTER_MS;

// I/O ------------------------------------------------------------------------------------------------------------------------------
export type PendingStory = { id: string; type: string; basis: string | null; score: number; components: ChiefStory["score"]; happened_at: string; created_at: string; domains: string[]; drafted: boolean };
export type ReviewRow = { story_id: string; desk: DeskName; verdict: "pass" | "hold" | "run" | "lead"; reason: string | null; facts_hash: string; checklist?: ItemResult[]; problems?: Problem[];
  second_reader?: "ran" | "cap used" | "call failed" | "time ran out" | "not run"; placement?: number; basis?: "desk" | "engine order"; call_id?: number | null; prompt_version?: string | null };
export type DoorResult = { ok: boolean; status: number; reason?: string };
export type ReviewIO = {
  now: () => number;
  /** Stories awaiting review (last few days), best first by the engine, and published stories whose facts an edit changed lately. */
  pending: () => Promise<PendingStory[]>;
  rechecks: () => Promise<PendingStory[]>;
  /** True when the story writer cannot write now (its daily cap is used, or the provider cannot run it). */
  writerOut: () => Promise<boolean>;
  input: (id: string) => Promise<ReviewInput | null>;
  /** The newest standards pass for a story (to reuse when nothing it read has changed). */
  lastStandards: (ids: string[]) => Promise<Map<string, { facts_hash: string; verdict: string; second_reader: string | null; at: string }>>;
  callsToday: (desk: DeskName) => Promise<number>;
  secondReader: (i: ReviewInput, signal: AbortSignal) => Promise<{ problems: Problem[]; call_id: number | null } | null>;
  chief: (i: ChiefInput, ids: string[], signal: AbortSignal) => Promise<{ answer: ChiefAnswer; call_id: number | null } | null>;
  /** The editor in chief's view of the day: lead open, the last seven days of leads, each day's remaining slots (UTC day: what already
   *  runs that day), and beats.md. */
  frontDay: () => Promise<{ leadOpen: boolean; leads: ChiefInput["leads"]; slots: Map<string, Slots>; beats: string }>;
  chiefHolds: (ids: string[]) => Promise<Map<string, { day: string; facts_hash: string }[]>>;
  reoffers: () => Promise<PendingStory[]>;
  record: (rows: ReviewRow[]) => Promise<void>;
  /** One call through the door's own code path (actor, level, desk log). */
  door: (actor: DeskName, body: Record<string, unknown>) => Promise<DoorResult>;
  promptVersion: (desk: DeskName) => string | null;
};
export type ReviewSummary = { checked: number; held: string[]; passed: string[]; released: string[]; lead: string | null; second_reader: { ran: number; skipped: Fallback[] }; chief: "called" | "no decision" | Fallback | "none"; rechecked: number; errors: string[] };

const dayOf = (iso: string) => iso.slice(0, 10);
const chiefStory = (p: PendingStory, i: ReviewInput, now: number, again = false): ChiefStory => ({ id: p.id, type: i.id.startsWith("census:") ? "census" : i.id.startsWith("quiet:") ? "quiet change" : p.type, headline: i.headline, deck: i.deck, facts: i.numbers.length, picture: i.picture?.kind ?? "none",
  basis: p.basis === "measured" || p.basis === "ai" ? p.basis : null, score: p.components, age_hours: Math.max(0, Math.round((now - Date.parse(p.happened_at)) / 36e5)), domains: p.domains, ...(again ? { offered_again: true } : {}) });

/** One review pass: standards on what is ready (and on published stories whose facts changed), then the editor in chief. Never throws. */
export async function runDesks(io: ReviewIO, o: { deadline: number }): Promise<ReviewSummary> {
  const sum: ReviewSummary = { checked: 0, held: [], passed: [], released: [], lead: null, second_reader: { ran: 0, skipped: [] }, chief: "none", rechecked: 0, errors: [] };
  const left = () => o.deadline - io.now(), err = (e: unknown, at: string) => sum.errors.push(`${at}: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`);
  try {
    const [pending, rechecks, writerOut] = await Promise.all([io.pending(), io.rechecks().catch(e => (err(e, "rechecks"), [])), io.writerOut().catch(() => true)]);
    const ready = pending.filter(p => readyForReview(p, { now: io.now(), writerOut }));
    const todo = [...ready.map(p => ({ p, published: false })), ...rechecks.filter(r => !ready.some(x => x.id === r.id)).map(p => ({ p, published: true }))];
    if (!todo.length && !(await io.reoffers().catch(() => [])).length) return sum;
    const last = await io.lastStandards(todo.map(t => t.p.id)).catch(() => new Map());
    // A · the checklist, then the second reader for what passed it.
    const inputs = new Map<string, ReviewInput>(), hashes = new Map<string, string>(), passed: { p: PendingStory; published: boolean; secondReader: "ran" | Fallback }[] = [], toRead: { p: PendingStory; published: boolean; i: ReviewInput; hash: string }[] = [];
    for (const t of todo) {
      const i = await io.input(t.p.id).catch(e => (err(e, `input ${t.p.id}`), null)); if (!i) continue;
      const hash = factsHash(i); inputs.set(t.p.id, i); hashes.set(t.p.id, hash);
      const prev = last.get(t.p.id);
      if (prev && prev.facts_hash === hash && prev.verdict === "pass") { if (!t.published) passed.push({ p: t.p, published: false, secondReader: (prev.second_reader as Fallback | "ran" | null) ?? "ran" }); continue; }
      if (t.published && prev && prev.facts_hash === hash) continue;
      sum.checked++; if (t.published) sum.rechecked++;
      const items = checklist(i);
      if (failed(items).length) {
        const reason = checklistReason(items)!;
        await io.record([{ story_id: t.p.id, desk: "standards", verdict: "hold", reason, facts_hash: hash, checklist: items, second_reader: "not run", prompt_version: io.promptVersion("standards") }]);
        const d = await io.door("standards", { action: "hold", id: t.p.id, reason });
        if (d.ok) sum.held.push(t.p.id); else sum.errors.push(`hold ${t.p.id}: ${d.reason ?? d.status}`);
        continue;
      }
      toRead.push({ p: t.p, published: t.published, i, hash });
    }
    // The second reader: at most the desk's daily cap, a few at a time, only while a call still fits before the deadline.
    const used = await io.callsToday("standards").catch(() => Infinity);
    let budget = Math.max(0, (Number.isFinite(used) ? DESK_CAPS.standards - used : 0));
    const queue = [...toRead];
    const worker = async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        const items = checklist(t.i);
        let res: { problems: Problem[]; call_id: number | null } | null = null, why: Fallback | null = null;
        if (budget <= 0) why = "cap used";
        else if (left() < DESK_CALL_MIN_MS) why = "time ran out";
        else { budget--; res = await io.secondReader(t.i, AbortSignal.timeout(Math.max(1000, left() - 2000))).catch(() => null); if (!res) why = "call failed"; }
        // Out of time: a story waiting for review waits for the next build (unless it has waited long); a published one is checked later.
        if (why === "time ran out" && (t.published || io.now() - Date.parse(t.p.created_at) < 2 * READY_AFTER_MS)) continue;
        const problems = res?.problems ?? [];
        if (res && blockers(problems).length) {
          const reason = blockerReason(problems)!;
          await io.record([{ story_id: t.p.id, desk: "standards", verdict: "hold", reason, facts_hash: t.hash, checklist: items, problems, second_reader: "ran", call_id: res.call_id, prompt_version: io.promptVersion("standards") }]);
          const d = await io.door("standards", { action: "hold", id: t.p.id, reason });
          if (d.ok) sum.held.push(t.p.id); else sum.errors.push(`hold ${t.p.id}: ${d.reason ?? d.status}`);
          sum.second_reader.ran++;
          continue;
        }
        if (res) sum.second_reader.ran++; else sum.second_reader.skipped.push(why!);
        await io.record([{ story_id: t.p.id, desk: "standards", verdict: "pass", reason: why ? `reviewed without second reader: ${why}` : null, facts_hash: t.hash, checklist: items, problems, second_reader: res ? "ran" : why!, call_id: res?.call_id ?? null, prompt_version: io.promptVersion("standards") }]);
        if (!t.published) passed.push({ p: t.p, published: false, secondReader: res ? "ran" : why! });
      }
    };
    await Promise.all(Array.from({ length: DESK_CONCURRENCY }, worker));
    sum.passed = passed.map(x => x.p.id);
    // B · the editor in chief places what passed, plus stories it held before that may be offered again.
    const again = await io.reoffers().catch(() => [] as PendingStory[]);
    const pastHolds = await io.chiefHolds(again.map(a => a.id)).catch(() => new Map());
    const offered: { p: PendingStory; i: ReviewInput; again: boolean; secondReader: "ran" | Fallback }[] = passed.flatMap(x => { const i = inputs.get(x.p.id); return i ? [{ p: x.p, i, again: false, secondReader: x.secondReader }] : []; });
    for (const a of again) {
      if (offered.some(x => x.p.id === a.id)) continue;
      const i = await io.input(a.id).catch(() => null); if (!i) continue;
      if (!offerAgain(pastHolds.get(a.id) ?? [], factsHash(i))) continue;
      offered.push({ p: a, i, again: true, secondReader: "ran" });
    }
    if (!offered.length) return sum;
    const day = await io.frontDay();
    const engineOrder = [...offered].sort((a, b) => b.p.score - a.p.score || b.p.happened_at.localeCompare(a.p.happened_at) || a.p.id.localeCompare(b.p.id)).map(x => x.p.id);
    const decision = offered.length >= 2 || day.leadOpen;
    const today = dayOf(new Date(io.now()).toISOString());
    const slotsToday = day.slots.get(today) ?? slotsFor([]);
    let answer: ChiefAnswer | null = null, callId: number | null = null, chiefWhy: "placed" | "no decision" | Fallback = "no decision";
    if (decision) {
      const usedC = await io.callsToday("editor in chief").catch(() => Infinity);
      if (!Number.isFinite(usedC) || usedC >= DESK_CAPS["editor in chief"]) chiefWhy = "cap used";
      else if (left() < DESK_CALL_MIN_MS) {
        // Out of time with a decision to make: the stories wait for the next build (they keep their standards pass), unless stale.
        const stale = offered.filter(x => io.now() - Date.parse(x.p.created_at) >= 2 * READY_AFTER_MS);
        if (!stale.length) { sum.chief = "time ran out"; return sum; }
        chiefWhy = "time ran out";
      } else {
        const ci: ChiefInput = { now: new Date(io.now()).toISOString(), stories: offered.map(x => chiefStory(x.p, x.i, io.now(), x.again)), leads: day.leads, slots: slotsToday, lead_open: day.leadOpen, beats: day.beats };
        const r = await io.chief(ci, offered.map(x => x.p.id), AbortSignal.timeout(Math.max(1000, left() - 1000))).catch(() => null);
        if (r) { answer = r.answer; callId = r.call_id; chiefWhy = "placed"; } else chiefWhy = "call failed";
      }
    }
    sum.chief = chiefWhy === "placed" ? "called" : chiefWhy;
    const slots = new Map(day.slots); for (const x of offered) { const k = dayOf(x.p.happened_at); if (!slots.has(k)) slots.set(k, slotsFor([])); }
    const d = enforceChief(answer, offered.map(x => ({ id: x.p.id, type: x.p.type, basis: x.p.basis as "ai" | "measured" | null, domains: x.p.domains, day: dayOf(x.p.happened_at) })), engineOrder, slots, { leadOpen: day.leadOpen, today });
    const hashOf = (id: string) => hashes.get(id) ?? factsHash(offered.find(x => x.p.id === id)!.i);
    for (const h of d.holds) {
      const reason = h.by === "cap" ? `Held: ${h.why}` : `Editor in chief: ${h.why}`;
      await io.record([{ story_id: h.id, desk: "editor in chief", verdict: "hold", reason, facts_hash: hashOf(h.id), basis: answer ? "desk" : "engine order", call_id: callId, prompt_version: io.promptVersion("editor in chief") }]);
      const r = await io.door("editor in chief", { action: "hold", id: h.id, reason });
      if (r.ok) sum.held.push(h.id); else sum.errors.push(`hold ${h.id}: ${r.reason ?? r.status}`);
    }
    for (const [n, id] of d.run.entries()) {
      const x = offered.find(y => y.p.id === id)!, lead = d.lead === id;
      const note = reviewedLine({ secondReader: x.secondReader, chief: chiefWhy, place: n + 1, of: d.run.length, lead });
      await io.record([{ story_id: id, desk: "editor in chief", verdict: lead ? "lead" : "run", reason: note, facts_hash: hashOf(id), placement: n + 1, basis: answer ? "desk" : "engine order", call_id: callId, prompt_version: io.promptVersion("editor in chief") }]);
      const r = await io.door("editor in chief", { action: "restore", id, note });
      if (!r.ok) { sum.errors.push(`release ${id}: ${r.reason ?? r.status}`); continue; }
      sum.released.push(id);
      // Only the editor's own choice is pinned (24 hours); with no answer the front page's rule picks the lead as before.
      if (lead && answer) { const p = await io.door("editor in chief", { action: "pin", id, until: new Date(io.now() + LEAD_PIN_HOURS * 36e5).toISOString(), note: "The editor in chief's lead." }); if (p.ok) sum.lead = id; }
    }
  } catch (e) { err(e, "desks"); }
  return sum;
}
