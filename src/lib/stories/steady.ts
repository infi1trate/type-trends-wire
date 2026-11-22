// W3a Part E · a reading that is not steady is not a change. For an AI-read field, a sector (or "all") and two forecast runs, take the
// homepages read in both runs; when more than STEADY_MAX_CHANGED of them changed their value (with at least STEADY_MIN_BOTH read in
// both), the field is "not steady" there between those runs, and crossovers and stage changes on any value of that field there are
// refused. Measured fields (the crawler's computed styles and pixel ratios) are never subject to it. Pure.

/** The AI-read fields (the forecast's AI dimensions); every other dimension is measured. */
export const AI_FIELDS = ["imagery", "aesthetic", "components", "hero_layout", "ai_positioning", "tone", "color_mood"] as const;
export type AiField = (typeof AI_FIELDS)[number];
export const isAiField = (d: string): d is AiField => (AI_FIELDS as readonly string[]).includes(d);
/** More than this share of the homepages read in both runs changed: the reading follows the day's page, not a redesign. */
export const STEADY_MAX_CHANGED = 0.25;
/** The rule reads a field only with at least this many homepages read in both runs (fewer: no judgment, the rule stays silent). */
export const STEADY_MIN_BOTH = 15;
export const notSteadyReason = (n: number, m: number) => `reading not steady: ${n} of ${m} homepages changed between the two forecasts`;

/** One homepage's usable AI reading as a forecast run saw it: the value of the field and when the capture behind it was taken. */
export type FieldReading = { value: string; at: string };
export type Readings = ReadonlyMap<string, Partial<Record<AiField, FieldReading>>>;
/** A field's value as one comparable string (sets sorted), or null when the field is absent. */
export function fieldValue(tags: Record<string, unknown>, f: AiField): string | null {
  const v = tags[f];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) { const xs = v.filter((x): x is string => typeof x === "string").sort(); return xs.length ? xs.join(",") : null; }
  return null;
}
export type ChangedHome = { domain: string; before: string; after: string; beforeAt: string; afterAt: string };
export type Steadiness = { field: AiField; scope: string; both: number; changed: number; steady: boolean; judged: boolean; homes: ChangedHome[] };
/** Steadiness of one field in one scope: `domains` are the scope's homepages; `early`/`late` the two runs' readings. */
export function steadiness(field: AiField, scope: string, domains: readonly string[], early: Readings, late: Readings): Steadiness {
  let both = 0; const homes: ChangedHome[] = [];
  for (const d of [...domains].sort()) {
    const a = early.get(d)?.[field], b = late.get(d)?.[field];
    if (!a || !b) continue;
    both++;
    if (a.value !== b.value) homes.push({ domain: d, before: a.value, after: b.value, beforeAt: a.at, afterAt: b.at });
  }
  const judged = both >= STEADY_MIN_BOTH;
  return { field, scope, both, changed: homes.length, judged, steady: !judged || homes.length / both <= STEADY_MAX_CHANGED, homes };
}
/** A comparison refused because its field's reading was not steady: the story id, the reason and the counts. */
export type NotSteady = { id: string; field: AiField; scope: string; changed: number; both: number; reason: string };
/** What the story build passes in: unsteady (field, scope) pairs for the build's run pair. */
export type Unsteady = { field: AiField; scope: string; changed: number; both: number };
export const unsteadyKey = (field: string, scope: string) => `${field}|${scope}`;
