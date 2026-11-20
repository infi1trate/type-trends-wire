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
};
const str = (v: unknown) => (typeof v === "string" ? v : null);
/** Types a correct edit may re-label a story to (only ever downward: a rebrand that no longer qualifies becomes a move). */
const RELABEL_TYPES = new Set(["move"]);

/** Apply edits in order. Kill hides; restore undoes a kill (or runs a held story anyway); correct replaces text (headline, deck, why line, or the
 * facts list when a maintenance pass rewords them); pin holds the lead until its time. */
export function applyEdits<S extends StoredStory>(s: S, edits: EditRow[], now: number): Shown<S> {
  const mine = edits.filter(e => e.story_id === s.id).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  let state: State = s.status, headline = s.headline, deck = s.deck, why = s.why_line, facts: unknown = s.facts, pinnedUntil: string | null = null, correctedAt: string | null = null, killReason: string | null = null;
  let type = s.type, kicker = s.kicker;
  for (const e of mine) {
    if (e.action === "kill") { state = "killed"; killReason = str(e.payload["reason"]); pinnedUntil = null; }
    else if (e.action === "restore") { state = "published"; killReason = null; }
    else if (e.action === "pin") { const u = str(e.payload["until"]); pinnedUntil = u; if (state === "held") state = "published"; }
    else if (e.action === "correct") {
      const h = str(e.payload["headline"]), d = str(e.payload["deck"]), w = e.payload["why_line"];
      if (h) headline = h; if (d !== null) deck = d; if (typeof w === "string") why = w || null;
      // A maintenance pass may re-label a stored story (a "rebrand" that the rebrand rule no longer earns reads as a move).
      const t = str(e.payload["type"]), k = str(e.payload["kicker"]); if (t && RELABEL_TYPES.has(t)) type = t; if (k) kicker = k;
      const f = e.payload["facts"]; if (Array.isArray(f) && f.every(x => !!x && typeof x === "object" && typeof (x as { text?: unknown }).text === "string")) facts = f;
      correctedAt = e.at;
    }
  }
  if (pinnedUntil && (Date.parse(pinnedUntil) <= now || state !== "published")) pinnedUntil = null;
  const namedFacts = Array.isArray(facts) ? facts.map(f => (f && typeof f === "object" && typeof (f as { text?: unknown }).text === "string" ? { ...f, text: nameText((f as { text: string }).text) } : f)) : facts;
  const evidence = Array.isArray(s.evidence) ? s.evidence.map(e => (e && typeof e === "object" && typeof (e as { label?: unknown }).label === "string" ? { ...e, label: nameText((e as { label: string }).label) } : e)) : s.evidence;
  return { ...s, type, kicker: nameText(kicker), headline: nameText(headline), deck: nameText(deck), why_line: nameText(why), facts: namedFacts, evidence, state, pinnedUntil, correctedAt, killReason, edits: mine, stored: { status: s.status, type: s.type, kicker: s.kicker, headline: s.headline, deck: s.deck, why_line: s.why_line, facts: s.facts } };
}
export const overlay = <S extends StoredStory>(stories: S[], edits: EditRow[], now: number) => {
  const by = new Map<string, EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  return stories.map(s => applyEdits(s, by.get(s.id) ?? [], now));
};
/** Stories told inside another running story (roundup members, rebrand moves, the move behind a counter-move) are hidden from streams. */
export function foldedIds(shown: { state: State; source_ids: string[] }[]): Set<string> {
  return new Set(shown.filter(s => s.state === "published").flatMap(s => s.source_ids.filter(x => x.startsWith("story:")).map(x => x.slice(6))));
}
