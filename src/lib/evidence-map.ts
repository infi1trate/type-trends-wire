// Which homepage section illustrates what. Pure, one file: patterns → section, story changes → section.
import type { CropSection } from "./crops";

/**
 * The section that illustrates a pattern: hero media and hero layout → hero; pricing and comparison tables → pricing;
 * call-to-action bands and button shapes → cta; navigation patterns → nav; footers → footer; everything else → hero.
 */
export function patternSection(key: string): CropSection {
  const [dim = "", value = ""] = key.split(":");
  if (dim === "hero_media" || dim === "hero_layout") return "hero";
  if (key === "components:pricing_table" || key === "components:comparison_table") return "pricing";
  if (key === "components:cta_band" || dim === "cta_shape") return "cta";
  if (dim === "nav" || /(^|_)nav(igation)?($|_)|mega_menu/.test(value)) return "nav";
  if (dim === "footer" || /footer/.test(value)) return "footer";
  return "hero";
}

/** One recorded change behind a story or timeline entry: a library event (type + the fields it touched) or a confirmed rebrand. */
export type ChangeRef = { kind: "event"; type: string | null; fields?: string[] } | { kind: "rebrand"; reasons: string[] };

/** Event types → section. Type, color, theme, headline copy, imagery, aesthetic and redesigns read in the hero. */
export const EVENT_SECTION: Record<string, CropSection | null> = {
  type_change: "hero", palette_shift: "hero", theme_flip: "hero", message_pivot: "hero", imagery_shift: "hero", aesthetic_shift: "hero", redesign: "hero",
  nav_change: "nav", pricing_change: "pricing", layout_change: "hero",
  stack_change: null, new_surface: null, // not visible in a crop
};
/** Layout fields that live outside the hero. */
export const LAYOUT_FIELD_SECTION: Record<string, CropSection> = { cta_radius_px: "cta", hero_media: "hero", h1_align: "hero", grid_max_cols: "hero" };
/** Rebrand reasons (font, accent, palette, theme, redesign) all read in the hero. */
export const REBRAND_SECTION: CropSection = "hero";

export function changeSection(c: ChangeRef): CropSection | null {
  if (c.kind === "rebrand") return REBRAND_SECTION;
  if (c.type === "layout_change") {
    const fs = (c.fields ?? []).map(f => LAYOUT_FIELD_SECTION[f]).filter((x): x is CropSection => !!x);
    return fs.find(s => s !== "hero") ?? "hero";
  }
  return c.type ? EVENT_SECTION[c.type] ?? null : null;
}
/** MOVE, COUNTER-MOVE and REBRAND stories: the section of their first visible change; any other story type has none. */
export function storySection(type: string, changes: ChangeRef[]): CropSection | null {
  if (type !== "move" && type !== "counter_move" && type !== "rebrand") return null;
  for (const c of changes) { const s = changeSection(c); if (s) return s; }
  return null;
}
