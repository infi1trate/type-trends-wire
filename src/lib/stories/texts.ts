// The writer's text on the Read side (E2b): the latest checked version of a story's written text replaces its headline and deck wherever
// stories are read; the template headline and deck stay on the record for the Data view and the desk. A correction newer than the
// latest version shows the corrected template until the next version is written. Pure; rows come from story_texts (checked only).
import { howWeKnow } from "./writer";

export type TextRow = { story_id: string; version: number; headline: string; deck: string; body: string[]; how_we_know: string; model: string; created_at: string };
export type Written = { headline: string; deck: string; body: string[]; howWeKnow: string; model: string; version: number; at: string };
type Overlaid = { id: string; headline: string; deck: string | null; correctedAt: string | null };
/** Latest checked version per story. */
export function latestTexts(rows: TextRow[]): Map<string, TextRow> {
  const out = new Map<string, TextRow>();
  for (const r of rows) { const cur = out.get(r.story_id); if (!cur || r.version > cur.version) out.set(r.story_id, r); }
  return out;
}
export function withTexts<S extends Overlaid>(stories: S[], rows: TextRow[]): (S & { written: Written | null; template: { headline: string; deck: string | null } })[] {
  const by = latestTexts(rows);
  return stories.map(s => {
    const t = by.get(s.id), template = { headline: s.headline, deck: s.deck };
    if (!t || (s.correctedAt && s.correctedAt > t.created_at)) return { ...s, written: null, template };
    return { ...s, headline: t.headline, deck: t.deck, written: { headline: t.headline, deck: t.deck, body: t.body ?? [], howWeKnow: t.how_we_know, model: t.model, version: t.version, at: t.created_at }, template };
  });
}
const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
/** The how-we-know line for a story without a written text: from its basis, its kicker (news) and the dates on its change lines. */
export function howWeKnowOf(s: { type: string; basis: string | null; kicker: string; happened_at: string; facts: unknown }): string {
  if (s.type === "news") return howWeKnow({ dates: [], ourRead: false, measured: false, news: s.kicker.split(" · ").slice(1).join(" · ") || "outside news" });
  const facts = Array.isArray(s.facts) ? (s.facts as { text?: unknown; basis?: unknown }[]) : [];
  const year = s.happened_at.slice(0, 4), dates = new Set<string>([s.happened_at.slice(0, 10)]);
  for (const f of facts) for (const m of String(f.text ?? "").matchAll(/· (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g)) dates.add(`${year}-${MON[m[2]!]}-${m[1]!.padStart(2, "0")}`);
  const ourRead = s.basis === "ai" || facts.some(f => f.basis === "ai"), measured = s.basis === "measured" || facts.some(f => f.basis === "measured");
  return howWeKnow({ dates: [...dates], ourRead, measured: measured || !ourRead });
}
