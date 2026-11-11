export type LibraryEventType = "type_change" | "palette_shift" | "theme_flip" | "layout_change" | "redesign" | "message_pivot" | "pricing_change" | "new_surface" | "stack_change" | "nav_change";
export type LibraryEvent = { type: LibraryEventType; severity: 1 | 2 | 3; summary: string; before: Record<string, unknown>; after: Record<string, unknown> };
type Signals = Record<string, unknown>;
export type DiffContext = { page_type: string; viewport: string; prev_content_hash?: string | null; content_hash?: string | null; new_surface?: boolean };
const record = (value: unknown): Signals => value && typeof value === "object" && !Array.isArray(value) ? value as Signals : {};
const at = (value: unknown, ...path: string[]): unknown => path.reduce((v, key) => record(v)[key], value);
const text = (value: unknown) => typeof value === "string" ? value : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const changed = (a: unknown, b: unknown) => a != null && b != null && a !== b;
const display = (value: unknown) => String(value ?? "—").slice(0, 100);
const jaccard = (a: Set<string>, b: Set<string>) => {
  const union = new Set([...a, ...b]);
  return union.size ? [...a].filter(x => b.has(x)).length / union.size : 1;
};
const words = (value: string) => new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
const navLabels = (value: unknown): Set<string> | null => Array.isArray(value) ? new Set(value.filter(item => at(item, "depth") === 0).map(item => text(at(item, "label"))?.trim().toLowerCase()).filter((label): label is string => !!label)) : null;
const bucket = (value: unknown) => {
  const radius = number(value);
  return radius == null ? null : radius === 0 ? "0" : radius <= 8 ? "1–8" : radius <= 24 ? "9–24" : "pill";
};
function lab(hex: string): number[] | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r = 0, g = 0, b = 0] = rgb;
  const xyz = [(r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047, r * 0.2126729 + g * 0.7151522 + b * 0.072175, (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883].map(v => v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116);
  const [x = 0, y = 0, z = 0] = xyz;
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function deltaE76(a: string, b: string): number | null {
  const first = lab(a), second = lab(b);
  return first && second ? Math.hypot(...first.map((v, i) => v - (second[i] ?? 0))) : null;
}
const palette = (signals: Signals) => {
  const colors = at(signals, "color", "palette");
  return Array.isArray(colors) ? colors.slice(0, 5).map(c => text(typeof c === "string" ? c : at(c, "hex"))).filter((c): c is string => !!c && lab(c) !== null) : [];
};
export function diffLibrarySignals(prev: Signals | null, next: Signals, context: DiffContext): LibraryEvent[] {
  if (!prev) return context.new_surface ? [{ type: "new_surface", severity: 1, summary: `${context.page_type} page added`, before: {}, after: { page_type: context.page_type } }] : [];
  const events: LibraryEvent[] = [];
  const emit = (type: LibraryEventType, severity: 1 | 2 | 3, summary: string, before: Signals, after: Signals) => events.push({ type, severity, summary, before, after });
  const fonts = ["h1", "body"].filter(role => changed(at(prev, "type", "rendered", role, "family"), at(next, "type", "rendered", role, "family")));
  if (fonts.length) emit("type_change", fonts.length === 2 ? 3 : 2, fonts.map(role => `${role} ${display(at(prev, "type", "rendered", role, "family"))} → ${display(at(next, "type", "rendered", role, "family"))}`).join("; "), Object.fromEntries(fonts.map(role => [role, at(prev, "type", "rendered", role, "family")])), Object.fromEntries(fonts.map(role => [role, at(next, "type", "rendered", role, "family")])));
  const themeBefore = text(at(prev, "color", "theme")), themeAfter = text(at(next, "color", "theme"));
  if (changed(themeBefore, themeAfter)) emit("theme_flip", 2, `theme ${themeBefore} → ${themeAfter}`, { theme: themeBefore }, { theme: themeAfter });
  const accentBefore = text(at(prev, "color", "accent")), accentAfter = text(at(next, "color", "accent"));
  const accents = accentBefore && accentAfter ? deltaE76(accentBefore, accentAfter) : null;
  const oldPalette = palette(prev), newPalette = palette(next);
  const replaced = oldPalette.length ? newPalette.filter(color => oldPalette.every(old => (deltaE76(color, old) ?? 0) > 15)).length : 0;
  if ((accents != null && accents > 20) || replaced >= 3) emit("palette_shift", 1, accents != null && accents > 20 ? `accent ${accentBefore} → ${accentAfter}` : `palette → ${replaced} colors replaced`, { accent: accentBefore, palette: oldPalette }, { accent: accentAfter, palette: newPalette });
  const oldLayout: Signals = {}, newLayout: Signals = {};
  for (const key of ["hero_media", "h1_align", "grid_max_cols", "cta_radius_px"]) {
    const before = key === "cta_radius_px" ? bucket(at(prev, "layout", key)) : at(prev, "layout", key);
    const after = key === "cta_radius_px" ? bucket(at(next, "layout", key)) : at(next, "layout", key);
    if (changed(before, after)) { oldLayout[key] = before; newLayout[key] = after; }
  }
  const heightBefore = number(at(prev, "composition", "page_height_vh") ?? at(prev, "layout", "page_height_vh"));
  const heightAfter = number(at(next, "composition", "page_height_vh") ?? at(next, "layout", "page_height_vh"));
  if (heightBefore != null && heightAfter != null && heightBefore > 0 && Math.abs(heightAfter - heightBefore) / heightBefore > 0.4) { oldLayout['page_height_vh'] = heightBefore; newLayout['page_height_vh'] = heightAfter; }
  const layoutKeys = Object.keys(oldLayout);
  if (layoutKeys.length) emit("layout_change", 1, layoutKeys.map(key => `${key.replace(/_/g, " ")} ${display(oldLayout[key])} → ${display(newLayout[key])}`).join("; "), oldLayout, newLayout);
  const oldNav = navLabels(prev['nav']), newNav = navLabels(next['nav']);
  if (oldNav && newNav && jaccard(oldNav, newNav) < 0.6) emit("nav_change", 1, `nav ${[...oldNav].join(", ").slice(0, 100)} → ${[...newNav].join(", ").slice(0, 100)}`, { labels: [...oldNav] }, { labels: [...newNav] });
  const oldH1 = text(at(prev, "lexicon", "h1")), newH1 = text(at(next, "lexicon", "h1"));
  if (oldH1 != null && newH1 != null && oldH1 !== newH1 && jaccard(words(oldH1), words(newH1)) < 0.3) emit("message_pivot", 2, `h1 ${display(oldH1)} → ${display(newH1)}`, { h1: oldH1 }, { h1: newH1 });
  if (context.page_type === "pricing" && changed(context.prev_content_hash, context.content_hash)) emit("pricing_change", 2, "pricing page content changed", { content_hash: context.prev_content_hash }, { content_hash: context.content_hash });
  const frameworks = ["next", "nuxt", "framer", "webflow", "wordpress", "shopify", "squarespace", "wix", "astro", "gatsby", "sveltekit"];
  const flipped = frameworks.filter(key => typeof at(prev, "tech", key) === "boolean" && typeof at(next, "tech", key) === "boolean" && changed(at(prev, "tech", key), at(next, "tech", key)));
  if (flipped.length) emit("stack_change", 2, flipped.map(key => `${key} ${display(at(prev, "tech", key))} → ${display(at(next, "tech", key))}`).join("; "), Object.fromEntries(flipped.map(key => [key, at(prev, "tech", key)])), Object.fromEntries(flipped.map(key => [key, at(next, "tech", key)])));
  if (context.page_type === "home" && context.viewport === "desktop" && new Set(events.map(event => event.type)).size >= 3) {
    const types = events.map(event => event.type);
    emit("redesign", 3, `home design → ${types.length} signals changed`, Object.assign({}, ...events.map(e => e.before)), Object.assign({}, ...events.map(e => e.after)));
  }
  return events;
}