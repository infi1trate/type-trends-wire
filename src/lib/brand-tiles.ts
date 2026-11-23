// S1 · the Brands directory's tiles, pure: the logo plate (the stored icon when it is big enough, else a monogram on the brand's
// measured accent with whichever of ink or paper lettering passes 4.5 : 1) and the "Moved this week" band (one card per brand).
import { contrast } from "./theme/contrast";

/** Icons narrower than this are drawn as a monogram instead (a 16 px favicon blown up to 64 px reads as a smudge). */
export const PLATE_MIN_ICON = 48;
export const MONOGRAM_MIN_CONTRAST = 4.5;
export const MOVED_DAYS = 7;
export const MOVED_MAX = 6;
/** The band is not shown when fewer brands than this moved. */
export const MOVED_MIN = 3;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const hex = (c: string | null | undefined) => { const m = c ? HEX.exec(c.trim()) : null; if (!m) return null; const h = m[1]!; return `#${(h.length === 3 ? h.split("").map(x => x + x).join("") : h).toLowerCase()}`; };

export type Plate =
  | { kind: "icon"; src: string; width: number; height: number }
  | { kind: "monogram"; letter: string; bg: string | null; fg: "ink" | "page" };

/** The first letter or digit of a brand's name (or domain), upper-cased; "?" never, a domain always has one. */
export function monogramLetter(name: string | null | undefined, domain: string): string {
  const s = (name ?? "").trim() || domain;
  const m = /[\p{L}\p{N}]/u.exec(s);
  return (m ? m[0] : domain.charAt(0)).toLocaleUpperCase("en");
}

/** `colors`: the hex of the ink and page roles (the typed mirror of the theme). With no usable accent, or when neither lettering passes,
 *  the plate is the ink role with page lettering (bg null): never an empty plate. */
export function plateOf(o: { icon: { src: string; width: number; height: number } | null | undefined; accent: string | null | undefined; name: string | null | undefined; domain: string },
  colors: { ink: string; page: string }): Plate {
  const i = o.icon;
  if (i && Math.min(i.width, i.height) >= PLATE_MIN_ICON) return { kind: "icon", src: i.src, width: i.width, height: i.height };
  const letter = monogramLetter(o.name, o.domain), bg = hex(o.accent);
  if (!bg) return { kind: "monogram", letter, bg: null, fg: "page" };
  const onInk = contrast(bg, colors.ink), onPage = contrast(bg, colors.page);
  if (Math.max(onInk, onPage) < MONOGRAM_MIN_CONTRAST) return { kind: "monogram", letter, bg: null, fg: "page" };
  return { kind: "monogram", letter, bg, fg: onInk >= onPage ? "ink" : "page" };
}

export type MoveIn = { headline: string; at: string; domains: string[] };
export type MovedCard = { domain: string; headline: string; at: string };
/** One card per brand with a confirmed move in the last seven days, newest first, at most six; `eligible` drops brands without a
 *  stored first-screen crop (a card is the picture). Fewer than three: none, the band is not shown. */
export function movedThisWeek(moves: readonly MoveIn[], now: number, eligible: (domain: string) => boolean): MovedCard[] {
  const since = now - MOVED_DAYS * 864e5, seen = new Set<string>(), out: MovedCard[] = [];
  const sorted = [...moves].sort((a, b) => b.at.localeCompare(a.at));
  for (const m of sorted) {
    const t = Date.parse(m.at); if (!(t >= since && t <= now + 36e5)) continue;
    for (const d of m.domains) {
      if (seen.has(d) || !eligible(d)) continue;
      seen.add(d); out.push({ domain: d, headline: m.headline, at: m.at });
      if (out.length >= MOVED_MAX) return out;
    }
  }
  return out.length >= MOVED_MIN ? out : [];
}
/** Brands that moved in the last seven days (the tile's "MOVED" sticker), whatever their pictures. */
export function movedSet(moves: readonly MoveIn[], now: number): string[] {
  const since = now - MOVED_DAYS * 864e5, s = new Set<string>();
  for (const m of moves) { const t = Date.parse(m.at); if (t >= since && t <= now + 36e5) for (const d of m.domains) s.add(d); }
  return [...s].sort();
}

/** A tile or card prints the brand's name above its latest move, so the move's own leading "Name · " (stored headlines open with the
 *  brand) is left out there; any other headline is shown whole. */
export function moveAfterName(headline: string, name: string | null | undefined, domain: string): string {
  for (const n of [name, domain]) {
    const lead = (n ?? "").trim();
    if (lead && headline.toLocaleLowerCase("en").startsWith(`${lead.toLocaleLowerCase("en")} · `)) {
      const rest = headline.slice(lead.length + 3).trim();
      if (rest) return rest.charAt(0).toLocaleUpperCase("en") + rest.slice(1);
    }
  }
  return headline;
}
