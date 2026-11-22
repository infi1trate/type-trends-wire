// The editor's overlay: stored stories never change; edits (pin, kill, correct, restore) are appended and applied at read time.
// Brand names are applied here too (E2a): every reader of a stored story sees "DocuSign", never "docusign.com"; ids, domains and links stay.
import { nameText } from "../brand-names";
export const EDIT_ACTIONS = ["pin", "kill", "correct", "restore"] as const;
export type EditAction = (typeof EDIT_ACTIONS)[number];
export type EditRow = { id: number; story_id: string; action: EditAction; payload: Record<string, unknown>; note: string | null; at: string };
export type StoredStory = {
  id: string; type: string; status: "published" | "held"; reason: string; score: number; components: unknown; why_ran: string; kicker: string; headline: string; deck: string | null;
  facts: unknown; why_line: string | null; why_model: string | null; why_at: string | null; sector: string | null; signal_keys: string[]; domains: string[]; evidence: unknown;
  source_ids: string[]; basis: string | null; happened_at: string; created_at: string;
  /** Permanent public number (story_numbers), attached at read time and only while the story is published. */
  number?: number | null;
};
export type State = "published" | "held" | "killed";
export type Shown<S extends StoredStory = StoredStory> = S & {
  state: State; stored: { status: S["status"]; type: string; kicker: string; headline: string; deck: string | null; why_line: string | null; facts: unknown };
  pinnedUntil: string | null; correctedAt: string | null; killReason: string | null; edits: EditRow[];
  /** N2 · when a desk put the story back to held (a `hold`: a kill edit marked as a hold); its reason is the story's `reason`. */
  heldAt?: string | null;
  /** I3b · dated correction lines a reader sees under the deck ("Corrected 21 Nov: …"), oldest first. */
  correctionNotes?: string[];
};
const str = (v: unknown) => (typeof v === "string" ? v : null);
/** The subset of `stored` a correction keeps (null when the payload has no list): strings only, stored order, never an addition. */
// A reader that loads only some columns (the numbering pass reads id, status and dates) has no stored list: nothing to narrow.
const narrowed = (v: unknown, stored: string[] | undefined) => (Array.isArray(stored) && Array.isArray(v) && v.length > 0 && v.every(x => typeof x === "string") ? stored.filter(x => (v as string[]).includes(x)) : null);
/** Types a correct edit may re-label a story to (only ever downward: a rebrand that no longer qualifies becomes a move). */
const RELABEL_TYPES = new Set(["move"]);

/** N2 · a hold is stored as a kill edit marked as a hold (the stored action list is a fixed check): the story goes back to held, with a
 *  reason, instead of being taken down. Older engine holds carry only the "Held:" note. */
export const isHoldEdit = (e: Pick<EditRow, "action" | "payload" | "note">) => e.action === "kill" && (e.payload?.["hold"] === true || !!e.note?.startsWith("Held:"));
/** Whether a story ever ran: stored as published, or restored or pinned into the stream later (N2: stories wait for review as held). */
export const everPublished = (s: { stored: { status: string }; edits: Pick<EditRow, "action" | "payload" | "note">[] }) => s.stored.status === "published" || s.edits.some(e => e.action === "restore" || e.action === "pin");
/** Apply edits in order. Kill hides; restore undoes a kill (or runs a held story anyway); correct replaces text (headline, deck, why line, or the
 * facts list when a maintenance pass rewords them); pin holds the lead until its time. */
export function applyEdits<S extends StoredStory>(s: S, edits: EditRow[], now: number): Shown<S> {
  const mine = edits.filter(e => e.story_id === s.id).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  let state: State = s.status, headline = s.headline, deck = s.deck, why = s.why_line, facts: unknown = s.facts, pinnedUntil: string | null = null, correctedAt: string | null = null, killReason: string | null = null;
  let type = s.type, kicker = s.kicker, domains = s.domains, sourceIds = s.source_ids, evidence: unknown = s.evidence, heldReason: string | null = null, heldAt: string | null = null;
  const notes: string[] = [];
  for (const e of mine) {
    if (e.action === "kill" && isHoldEdit(e)) { state = "held"; heldReason = str(e.payload["reason"]) ?? e.note?.replace(/^Held:\s*/, "") ?? null; heldAt = e.at; killReason = null; pinnedUntil = null; }
    else if (e.action === "kill") { state = "killed"; killReason = str(e.payload["reason"]); pinnedUntil = null; }
    else if (e.action === "restore") { state = "published"; killReason = null; heldReason = null; heldAt = null; }
    else if (e.action === "pin") { const u = str(e.payload["until"]); pinnedUntil = u; if (state === "held") { state = "published"; heldReason = null; heldAt = null; } }
    else if (e.action === "correct") {
      const h = str(e.payload["headline"]), d = str(e.payload["deck"]), w = e.payload["why_line"];
      if (h) headline = h; if (d !== null) deck = d; if (typeof w === "string") why = w || null;
      // A maintenance pass may re-label a stored story (a "rebrand" that the rebrand rule no longer earns reads as a move).
      const t = str(e.payload["type"]), k = str(e.payload["kicker"]); if (t && RELABEL_TYPES.has(t)) type = t; if (k) kicker = k;
      const f = e.payload["facts"]; if (Array.isArray(f) && f.every(x => !!x && typeof x === "object" && typeof (x as { text?: unknown }).text === "string")) facts = f;
      // E2e: a correction may drop members of a gathered story (brands whose changes failed the integrity check). Only ever narrowing:
      // ids or domains the stored story never had are ignored, so a correction cannot add a brand or a source.
      const keepD = narrowed(e.payload["domains"], s.domains), keepS = narrowed(e.payload["source_ids"], s.source_ids), ev = e.payload["evidence"];
      if (keepD) domains = keepD; if (keepS) sourceIds = keepS;
      if (Array.isArray(ev) && ev.every(x => !!x && typeof x === "object" && typeof (x as { label?: unknown }).label === "string")) evidence = ev;
      const c = str(e.payload["correction"]); if (c && c.trim()) notes.push(c.trim());
      correctedAt = e.at;
    }
  }
  if (pinnedUntil && (Date.parse(pinnedUntil) <= now || state !== "published")) pinnedUntil = null;
  const namedFacts = Array.isArray(facts) ? facts.map(f => (f && typeof f === "object" && typeof (f as { text?: unknown }).text === "string" ? { ...f, text: nameText((f as { text: string }).text) } : f)) : facts;
  const namedEvidence = Array.isArray(evidence) ? evidence.map(e => (e && typeof e === "object" && typeof (e as { label?: unknown }).label === "string" ? { ...e, label: nameText((e as { label: string }).label) } : e)) : evidence;
  return { ...s, ...(state === "held" && heldReason ? { reason: heldReason } : {}), heldAt: state === "held" ? heldAt : null, type, kicker: nameText(kicker), headline: nameText(headline), deck: nameText(deck), why_line: nameText(why), facts: namedFacts, evidence: namedEvidence, domains, source_ids: sourceIds, state, pinnedUntil, correctedAt, killReason, edits: mine, correctionNotes: notes.map(n => nameText(n)), stored: { status: s.status, type: s.type, kicker: s.kicker, headline: s.headline, deck: s.deck, why_line: s.why_line, facts: s.facts } };
}
export const overlay = <S extends StoredStory>(stories: S[], edits: EditRow[], now: number) => {
  const by = new Map<string, EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  return stories.map(s => applyEdits(s, by.get(s.id) ?? [], now));
};
/** Stories told inside another running story (roundup members, rebrand moves, the move behind a counter-move) are hidden from streams. */
export function foldedIds(shown: { state: State; source_ids: string[] }[]): Set<string> {
  return new Set(shown.filter(s => s.state === "published").flatMap(s => s.source_ids.filter(x => x.startsWith("story:")).map(x => x.slice(6))));
}
