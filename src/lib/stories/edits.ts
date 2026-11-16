// The editor's overlay: stored stories never change; edits (pin, kill, correct, restore) are appended and applied at read time.
export const EDIT_ACTIONS = ["pin", "kill", "correct", "restore"] as const;
export type EditAction = (typeof EDIT_ACTIONS)[number];
export type EditRow = { id: number; story_id: string; action: EditAction; payload: Record<string, unknown>; note: string | null; at: string };
export type StoredStory = {
  id: string; type: string; status: "published" | "held"; reason: string; score: number; components: unknown; why_ran: string; kicker: string; headline: string; deck: string | null;
  facts: unknown; why_line: string | null; why_model: string | null; why_at: string | null; sector: string | null; signal_keys: string[]; domains: string[]; evidence: unknown;
  source_ids: string[]; basis: string | null; happened_at: string; created_at: string;
};
export type State = "published" | "held" | "killed";
export type Shown<S extends StoredStory = StoredStory> = S & {
  state: State; stored: { status: S["status"]; headline: string; deck: string | null; why_line: string | null };
  pinnedUntil: string | null; correctedAt: string | null; killReason: string | null; edits: EditRow[];
};
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Apply edits in order. Kill hides; restore undoes a kill (or runs a held story anyway); correct replaces text; pin holds the lead until its time. */
export function applyEdits<S extends StoredStory>(s: S, edits: EditRow[], now: number): Shown<S> {
  const mine = edits.filter(e => e.story_id === s.id).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  let state: State = s.status, headline = s.headline, deck = s.deck, why = s.why_line, pinnedUntil: string | null = null, correctedAt: string | null = null, killReason: string | null = null;
  for (const e of mine) {
    if (e.action === "kill") { state = "killed"; killReason = str(e.payload["reason"]); pinnedUntil = null; }
    else if (e.action === "restore") { state = "published"; killReason = null; }
    else if (e.action === "pin") { const u = str(e.payload["until"]); pinnedUntil = u; if (state === "held") state = "published"; }
    else if (e.action === "correct") {
      const h = str(e.payload["headline"]), d = str(e.payload["deck"]), w = e.payload["why_line"];
      if (h) headline = h; if (d !== null) deck = d; if (typeof w === "string") why = w || null; correctedAt = e.at;
    }
  }
  if (pinnedUntil && (Date.parse(pinnedUntil) <= now || state !== "published")) pinnedUntil = null;
  return { ...s, headline, deck, why_line: why, state, pinnedUntil, correctedAt, killReason, edits: mine, stored: { status: s.status, headline: s.headline, deck: s.deck, why_line: s.why_line } };
}
export const overlay = <S extends StoredStory>(stories: S[], edits: EditRow[], now: number) => {
  const by = new Map<string, EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  return stories.map(s => applyEdits(s, by.get(s.id) ?? [], now));
};
/** Stories told inside another running story (roundup members, rebrand moves, the move behind a counter-move) are hidden from streams. */
export function foldedIds(shown: { state: State; source_ids: string[] }[]): Set<string> {
  return new Set(shown.filter(s => s.state === "published").flatMap(s => s.source_ids.filter(x => x.startsWith("story:")).map(x => x.slice(6))));
}
