// Colour families: the named groups the palette strips draw (white, grey, black; otherwise hue and light or dark). Pure, no imports, so
// the study strips (data-stories/templates/drift.ts) and the museum comparison (art/palette.ts) read "one colour" the same way.
/** Named hue ranges (degrees, start inclusive): red wraps around 0. */
const HUES: [number, string][] = [[15, "orange"], [45, "yellow"], [70, "green"], [165, "teal"], [195, "blue"], [255, "violet"], [290, "pink"], [345, "red"]];
const hueName = (h: number) => (h < 15 ? "red" : [...HUES].reverse().find(([from]) => h >= from)![1]);
export function hsl(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
/** Colour family: neutrals by lightness (white, grey, black), colours by hue and light/dark. */
export function familyOf(hex: string): { id: string; name: string } {
  const { h, s, l } = hsl(hex);
  if (s < 0.15 || l > 0.95 || l < 0.06) return l > 0.85 ? { id: "n-white", name: "White and off-white" } : l < 0.2 ? { id: "n-black", name: "Black and near-black" } : { id: "n-grey", name: "Grey" };
  const hue = hueName(h), tone = l >= 0.5 ? "light" : "dark";
  return { id: `${hue}-${tone}`, name: `${tone === "light" ? "Light" : "Dark"} ${hue}` };
}
export const familyName = (id: string) => (id.startsWith("n-") ? { "n-white": "White and off-white", "n-grey": "Grey", "n-black": "Black and near-black" }[id] ?? id : `${id.endsWith("light") ? "Light" : "Dark"} ${id.split("-")[0]}`);
