// U1 · the search params every object address shares: `view=data` (its Data view) and `receipt=<type>:<id>` (an open receipt drawer, U2).
// Pure; each object route spreads these into its own validateSearch so neither is dropped on navigation.
export type ViewSearch = { view?: "data" | undefined; receipt?: string | undefined };
export const viewSearch = (s: Record<string, unknown>): ViewSearch => ({
  ...(s["view"] === "data" ? { view: "data" as const } : {}),
  ...(typeof s["receipt"] === "string" && s["receipt"].length > 2 && s["receipt"].length <= 240 ? { receipt: s["receipt"] } : {}),
});
/** The brand record's compare tool (Data view only): which page and viewport, and the two captures compared. */
export type BrandDataSearch = { viewport?: string | undefined; page_type?: string | undefined; a?: string | undefined; b?: string | undefined };
const short = (v: unknown, n = 40) => (typeof v === "string" && v.length <= n ? v : typeof v === "number" ? String(v) : undefined);
export const brandDataSearch = (s: Record<string, unknown>): BrandDataSearch => {
  const o: BrandDataSearch = {};
  for (const k of ["viewport", "page_type", "a", "b"] as const) { const v = short(s[k]); if (v) o[k] = v; }
  return o;
};
