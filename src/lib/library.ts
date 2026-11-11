export const SECTORS = ["ai", "dev-tools", "fintech", "consumer-apps", "commerce-dtc", "media", "studios", "hardware", "health", "enterprise-saas"] as const;
export const EVENT_TYPES = ["type_change", "palette_shift", "theme_flip", "layout_change", "redesign", "message_pivot", "pricing_change", "new_surface", "stack_change", "nav_change"] as const;
export const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const valueAt = (v: unknown, ...keys: string[]): unknown => keys.reduce((a, k) => obj(a)[k], v);
export const str = (v: unknown): string | null => typeof v === "string" ? v : null;
export const num = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
export const pct = (v: unknown) => num(v) == null ? "—" : `${Math.round((num(v) ?? 0) * 100)}%`;
export const show = (v: unknown): string => v == null ? "—" : Array.isArray(v) ? v.map(show).join(", ") : typeof v === "object" ? Object.entries(obj(v)).map(([k, x]) => `${k}: ${show(x)}`).join(" · ") : String(v);
export const hex = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
export const radiusBucket = (v: unknown): string | null => num(v) == null ? null : v === 0 ? "square" : (num(v) ?? 0) <= 8 ? "1–8" : (num(v) ?? 0) <= 24 ? "9–24" : "pill";
export function fingerprint(signals: unknown) {
  const get = (...k: string[]) => valueAt(signals, ...k);
  const palette = get("color", "palette");
  const features = get("css_features");
  const ctas = get("lexicon", "ctas");
  return {
    h1_family: str(get("type", "rendered", "h1", "family")), body_family: str(get("type", "rendered", "body", "family")),
    h1_webfont: typeof get("type", "rendered", "h1", "webfont") === "boolean" ? get("type", "rendered", "h1", "webfont") as boolean : null,
    body_webfont: typeof get("type", "rendered", "body", "webfont") === "boolean" ? get("type", "rendered", "body", "webfont") as boolean : null,
    h1_system: typeof get("type", "rendered", "h1", "system") === "boolean" ? get("type", "rendered", "h1", "system") as boolean : null,
    h1_size: num(get("type", "declared", "h1", "size_px")), h1_weight: show(get("type", "declared", "h1", "weight")), h1_tracking: num(get("type", "declared", "h1", "letter_spacing_em")),
    theme: str(get("color", "theme")), page_bg: hex(get("color", "page_bg")), accent: hex(get("color", "accent")),
    palette: Array.isArray(palette) ? palette.slice(0, 5).map(p => ({ hex: hex(obj(p)["hex"]), share: num(obj(p)["share"]) })).filter(p => p.hex !== null) : [],
    whitespace: num(get("composition", "whitespace_ratio") ?? get("color", "whitespace_ratio")),
    hero: str(get("layout", "hero_media")), align: str(get("layout", "h1_align")), cta_radius: num(get("layout", "cta_radius_px")), grid_cols: num(get("layout", "grid_max_cols")),
    page_height_vh: num(get("layout", "page_height_vh") ?? get("composition", "page_height_vh")),
    css_features: Array.isArray(features) ? features.filter((v): v is string => typeof v === "string") : [],
    stack: Object.entries(obj(get("tech"))).filter(([, v]) => v === true).map(([k]) => k),
    h1: str(get("lexicon", "h1")), ctas: Array.isArray(ctas) ? ctas.map(show) : [],
  };
}
export function sectorMetrics(signals: unknown[]) {
  const rows = signals.map(fingerprint);
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const spaces = rows.map(r => r.whitespace).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const middle = Math.floor(spaces.length / 2);
  const whitespace = spaces.length ? spaces.length % 2 ? spaces[middle] ?? null : ((spaces[middle - 1] ?? 0) + (spaces[middle] ?? 0)) / 2 : null;
  const serif = (name: string) => /serif|georgia|times|garamond|baskerville|caslon|bodoni|didot|lyon|tiempos|canela|lora|merriweather|source serif|playfair|fraunces|söhne serif/i.test(name) && !/sans/i.test(name);
  return { whitespace, dark: mean(rows.filter(r => r.theme).map(r => Number(r.theme === "dark"))), serif: mean(rows.filter(r => r.h1_family).map(r => Number(serif(r.h1_family ?? "")))), webfont: mean(rows.filter(r => r.body_webfont !== null).map(r => Number(r.body_webfont))), radius: Object.fromEntries(["square", "1–8", "9–24", "pill"].map(bucket => [bucket, mean(rows.filter(r => r.cta_radius !== null).map(r => Number(radiusBucket(r.cta_radius) === bucket)))])) };
}