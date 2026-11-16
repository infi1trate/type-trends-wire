// Which kit file each cut of the mark comes from, and the one parser the generator and its test share. Pure.
export const MARK_FILES = {
  display: "slug-wordmark-display.svg",
  standard: "slug-wordmark-standard.svg",
  micro: "slug-wordmark-micro.svg",
  s: "slug-s.svg",
} as const;
export type MarkCut = keyof typeof MARK_FILES;
/** viewBox size and the single path's data from one outlined SVG. */
export function parseMarkSvg(svg: string): { w: number; h: number; d: string } {
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)];
  if (!vb || paths.length !== 1) throw new Error("expected one viewBox and exactly one path");
  return { w: Number(vb[1]), h: Number(vb[2]), d: paths[0]![1]! };
}
