// E3b · Also today's pictures, pure. Each card's candidates come from the stored `front-cards` record (front.server.ts): a single-brand
// story's own first-screen crop, a gathered story's or a census's member crops in member order, then each brand's latest hero crop.
// No two cards show the same picture: single-brand cards keep theirs; a gathered card takes the next member's crop that no other card on
// the page is using, and shows none when every member's crop is taken. Two crops of one brand count as the same picture (the same
// homepage), so a gathered card moves on to the next brand.
import type { Crop } from "../crops";

export type CardCandidates = Record<string, Crop[]>;
export const ALSO_CANDIDATES_MAX = 6;
export const pictureKey = (c: Pick<Crop, "domain" | "section">) => `${c.domain}|${c.section}`;

/** Unique by brand and section, in order, at most ALSO_CANDIDATES_MAX. */
export function candidateList(crops: readonly (Crop | null | undefined)[]): Crop[] {
  const seen = new Set<string>(), out: Crop[] = [];
  for (const c of crops) { if (!c || seen.has(pictureKey(c))) continue; seen.add(pictureKey(c)); out.push(c); if (out.length >= ALSO_CANDIDATES_MAX) break; }
  return out;
}
/** One picture (or none) per card, in card order. `gathered`: a roundup or census (more than one brand). */
export function pickAlsoPictures(cards: readonly { id: string; gathered: boolean }[], candidates: Readonly<CardCandidates>): Record<string, Crop | null> {
  const out: Record<string, Crop | null> = {}, used = new Set<string>();
  for (const c of cards) if (!c.gathered) { const p = candidates[c.id]?.[0] ?? null; out[c.id] = p; if (p) used.add(p.domain); }
  for (const c of cards) if (c.gathered) { const p = (candidates[c.id] ?? []).find(x => !used.has(x.domain)) ?? null; out[c.id] = p; if (p) used.add(p.domain); }
  return out;
}
