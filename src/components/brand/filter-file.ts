// The kit's illustration filter file and the one parser the generator and its test share. Pure.
export const FILTER_FILE = "brand/illustration/slug-filters.svg";
/** The <defs> body (filters, gumball gradients, halftone patterns) and every id it defines, in file order. */
export function parseFilterSvg(svg: string): { defs: string; ids: string[] } {
  const m = svg.match(/<defs>([\s\S]*)<\/defs>/);
  if (!m) throw new Error("expected one <defs> block");
  const defs = m[1]!.trim(), ids = [...defs.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]!);
  return { defs, ids };
}
