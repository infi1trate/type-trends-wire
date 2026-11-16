// WCAG 2.x contrast for the theme's hex colours. Pure. The contrast test and /brand/colour both use it.
const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string): number {
  const h = hex.replace("#", ""), n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16)) as [number, number, number];
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** Rounded to one decimal, the way the kit quotes it ("paper 16.8"). */
export const ratioText = (a: string, b: string) => contrast(a, b).toFixed(1);
/** WCAG AA minimums: 4.5 for text, 3 for large display type and UI borders. */
export const AA = { text: 4.5, large: 3 } as const;
