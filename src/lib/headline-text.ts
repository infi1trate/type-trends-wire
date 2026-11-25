// E2h · a headline stored twice is one headline. Some pages render their h1 twice in one element (a visible copy and an animated or
// screen-reader copy), so older captures hold "X X". Pure and dependency-free: every reader of a captured headline (diff fields, census,
// lines in the latest changes, writer facts, the brand page) collapses it, so the doubled and single forms are the same headline everywhere.
/** "X X" (or "XX" glued) where X is the same phrase of at least two words → "X"; any other text is returned unchanged. */
export function oneHeadline(text: string): string {
  const t = text.replace(/\s+/g, " ").trim(), w = t.split(" ");
  if (w.length >= 4 && w.length % 2 === 0) { const h = w.length / 2, a = w.slice(0, h).join(" "); if (a === w.slice(h).join(" ")) return a; }
  if (t.length % 2 === 0) { const a = t.slice(0, t.length / 2); if (a.includes(" ") && a === t.slice(t.length / 2)) return a.trim(); }
  return text;
}
/** The same for an unknown value: strings collapse, anything else passes through. */
export const oneHeadlineOf = <T>(v: T): T => (typeof v === "string" ? (oneHeadline(v) as T) : v);
