// W1d · the capture dates a story's own stored lines state, so "How we know" names both sides of a single-brand change with the same
// dates the deck uses ("between 13 and 20 Nov" → "Measured from captures on 13 and 20 November"). Pure.
const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const M = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
const BETWEEN = new RegExp(`between (\\d{1,2})(?: ${M})? and (\\d{1,2}) ${M}\\b`, "g");
/** The YYYY-MM-DD dates in a line's "between 13 and 20 Nov" / "between 30 Oct and 2 Nov" phrases (year from `year`). */
export function betweenDates(text: string, year: string): string[] {
  const iso = (d: string, mo: string) => `${year}-${MON[mo]}-${d.padStart(2, "0")}`;
  return [...text.matchAll(BETWEEN)].flatMap(m => [iso(m[1]!, m[2] ?? m[4]!), iso(m[3]!, m[4]!)]);
}
/** The capture dates a story's lines state: change lines ("· between 11 and 14 Nov", "· 20 Nov") and the capture-dated "Changed between …"
 *  line, never a confirmation line; else the deck's "between … and …". Sorted, unique; empty when none is stated. */
export function storedCaptureDates(s: { happened_at: string; facts: unknown; deck?: string | null }): string[] {
  const facts = Array.isArray(s.facts) ? (s.facts as { text?: unknown; kind?: unknown }[]) : [];
  const year = s.happened_at.slice(0, 4), found = new Set<string>(), iso = (d: string, mo: string) => `${year}-${MON[mo]}-${d.padStart(2, "0")}`;
  for (const f of facts) {
    const t = String(f.text ?? "");
    // E2g: a date line is the confirmation (machinery), except the quiet change's capture-dated "Changed between …" line.
    if (f.kind === "date") { if (/^Changed between /.test(t)) for (const d of betweenDates(t, year)) found.add(d); continue; }
    for (const m of t.matchAll(new RegExp(`· between (\\d{1,2})(?: ${M})? and (\\d{1,2}) ${M}\\b`, "g"))) { found.add(iso(m[1]!, m[2] ?? m[4]!)); found.add(iso(m[3]!, m[4]!)); }
    for (const m of t.matchAll(new RegExp(`· (\\d{1,2}) ${M}\\b`, "g"))) found.add(iso(m[1]!, m[2]!));
  }
  if (!found.size && s.deck) for (const d of betweenDates(s.deck, year)) found.add(d);
  return [...found].sort();
}
