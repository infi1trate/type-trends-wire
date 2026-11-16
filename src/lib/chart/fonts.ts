// Text measurement for the image drawer (share cards, OG images, embeds' figures). Pure: reads only the generated glyph tables, so
// layout (fit, wrap, right-aligned text) and the rasterizer agree to the pixel. Big Shoulders sets headlines and figures, Newsreader
// decks, IBM Plex Mono only code-like values (brand/README.md, "Type").
import { FACE_ADVANCES, FACE_ASCENT, GLYPH_ADVANCE, GLYPH_ASCENT, GLYPH_CHARS } from "./glyphs.gen";

export type Face = "mono" | "display" | "text";
export type TextSize = 22 | 28 | 44 | 96;
export type TextWeight = 400 | 600 | 700 | 900;
/** The atlases that exist, per face and weight (each face is drawn at its optical size). */
export const FACE_SIZES: Record<Face, Partial<Record<TextWeight, readonly TextSize[]>>> = {
  mono: { 400: [22, 28, 44, 96], 600: [22, 28, 44, 96] },
  display: { 700: [22, 28, 44], 900: [44, 96] },
  text: { 400: [22, 28] },
};
export const hasAtlas = (face: Face, weight: TextWeight, size: TextSize) => (FACE_SIZES[face][weight] ?? []).includes(size);
export function atlasKey(face: Face, weight: TextWeight, size: TextSize): string {
  if (!hasAtlas(face, weight, size)) throw new Error(`no ${face} ${weight} atlas at ${size}px`);
  return face === "mono" ? `${weight}-${size}` : `${face}-${weight}-${size}`;
}
const INDEX = new Map([...GLYPH_CHARS].map((c, i) => [c, i] as const));
const Q = INDEX.get("?")!;
/** Per-character advance widths in px. Characters outside the atlas take "?" (as the rasterizer draws them). */
export function advances(text: string, size: TextSize, weight: TextWeight = 400, face: Face = "mono"): number[] {
  const chars = [...text];
  if (face === "mono") return chars.map(() => GLYPH_ADVANCE * size);
  const table = FACE_ADVANCES[atlasKey(face, weight, size)]!;
  return chars.map(c => table[INDEX.get(c) ?? Q]! / 16);
}
export const measureText = (text: string, size: TextSize, weight: TextWeight = 400, face: Face = "mono") => advances(text, size, weight, face).reduce((a, b) => a + b, 0);
export const ascentOf = (face: Face = "mono") => (face === "mono" ? GLYPH_ASCENT : FACE_ASCENT[face]!);
