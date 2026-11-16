// One human label map for every trait key the app knows. Pure (only the site URL constant is imported):
// UI, brief context, chart cards, alerts and MCP all format trait names through this module only.
import { SITE_URL } from "./site";

export const DIMENSIONS = ["FONT", "COLOR", "LAYOUT", "VIBE"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type TraitLabel = { name: string; dimension: Dimension; short?: string };

/** Every trait category maps to exactly one dimension. A few keys are overridden below where the category is a build technique but the reader thinks of it as type or color. */
export const CATEGORY_DIMENSION: Record<string, Dimension> = {
  family: "FONT", font: "FONT", headline: "FONT", tracking: "FONT", h1_font: "FONT", body_font: "FONT", type: "FONT", h1_size: "FONT", h1_case: "FONT", h1_tracking: "FONT",
  theme: "COLOR", color_mood: "COLOR", accent: "COLOR", color: "COLOR",
  css: "LAYOUT", framework: "LAYOUT", tech: "LAYOUT", hero_media: "LAYOUT", hero_layout: "LAYOUT", components: "LAYOUT", whitespace: "LAYOUT", grid_cols: "LAYOUT", cta_shape: "LAYOUT", h1_align: "LAYOUT",
  aesthetic: "VIBE", tone: "VIBE", imagery: "VIBE", ai_positioning: "VIBE", vibe: "VIBE", pricing: "VIBE", h1_word: "VIBE",
  combo: "VIBE", // composites carry their own dimension in KEY_DIMENSION below
};
export const KEY_DIMENSION: Record<string, Dimension> = {
  "css:variable_fonts": "FONT", "css:oklch": "COLOR", "css:color_mix": "COLOR",
  // Composite signals (definitions and members live in composites.ts): combo → dimension.
  "combo:big_type": "FONT", "combo:editorial_serif": "FONT", "combo:dark_tech": "COLOR", "combo:soft_ui": "LAYOUT", "combo:product_led_hero": "LAYOUT", "combo:proof_wall": "LAYOUT",
  "combo:motion_rich": "LAYOUT", "combo:immersive_3d": "LAYOUT", "combo:numbers_up_front": "LAYOUT", "combo:ai_forward": "VIBE", "combo:playful_brand": "VIBE", "combo:quiet_minimal": "VIBE",
};

/** Crawl spread signals are aliases of canonical trait keys. */
export const SPREAD_ALIAS: Record<string, string> = {
  big_headline: "h1_size:big", pill_cta: "cta_shape:pill", mono_anywhere: "type:mono", dark_theme: "theme:dark", tailwind: "framework:tailwind", video_hero: "hero_media:video",
  system_font: "font:system", serif_headline: "headline:serif", high_whitespace: "whitespace:high", tight_tracking: "tracking:tight", centered_headline: "h1_align:center", webgl_hero: "hero_media:webgl",
};

export const NAMES: Record<string, string> = {
  // FONT
  "font:webfont": "Custom web fonts", "font:system": "System fonts", "headline:serif": "Serif headlines", "tracking:tight": "Tight headline spacing", "type:mono": "Monospace type",
  "h1_size:big": "Big headlines", "h1_size:<32": "Headlines under 32px", "h1_size:32–47": "Headlines 32–47px", "h1_size:48–63": "Headlines 48–63px", "h1_size:64–95": "Headlines 64–95px", "h1_size:96+": "Headlines 96px and up",
  "h1_case:uppercase": "All-caps headlines", "h1_case:other": "Mixed-case headlines",
  "h1_tracking:tight": "Tight headline spacing", "h1_tracking:normal": "Normal headline spacing", "h1_tracking:wide": "Wide headline spacing",
  // COLOR
  "theme:dark": "Dark mode", "theme:light": "Light mode",
  "color_mood:earthy": "Earthy palettes", "color_mood:high_contrast": "High-contrast palettes", "color_mood:monochrome": "Monochrome palettes", "color_mood:muted": "Muted palettes", "color_mood:pastel": "Pastel palettes", "color_mood:vivid": "Vivid palettes",
  // LAYOUT · CSS
  "css:anchor_positioning": "Anchor-positioned popovers", "css:backdrop_filter": "Frosted-glass blur", "css:cascade_layers": "CSS cascade layers", "css:clamp": "Fluid type and spacing", "css:color_mix": "Mixed CSS colors",
  "css:container_queries": "Container queries", "css:custom_properties": "CSS variables", "css:dvh_units": "Full-height mobile sections", "css:has_selector": "Parent-aware styling (:has)", "css:nesting": "Native CSS nesting",
  "css:oklch": "OKLCH colors", "css:scroll_timeline": "Scroll-driven animation", "css:starting_style": "Entry animations", "css:subgrid": "Subgrid layouts", "css:text_wrap_balance": "Balanced headline wrapping",
  "css:variable_fonts": "Variable fonts", "css:view_transitions": "Page transitions",
  "framework:next": "Built with Next.js", "framework:framer": "Built in Framer", "framework:webflow": "Built in Webflow", "framework:tailwind": "Tailwind CSS",
  "tech:webgl_canvas": "WebGL canvas", "tech:shopify": "Shopify", "tech:tailwind": "Tailwind CSS", "tech:webflow": "Webflow", "tech:nuxt": "Nuxt", "tech:three": "Three.js 3D", "tech:framer": "Framer", "tech:wix": "Wix",
  "tech:lenis": "Smooth scrolling (Lenis)", "tech:squarespace": "Squarespace", "tech:gatsby": "Gatsby", "tech:lottie": "Lottie animation", "tech:next": "Next.js", "tech:wordpress": "WordPress", "tech:sveltekit": "SvelteKit", "tech:gsap": "GSAP animation", "tech:astro": "Astro",
  "hero_media:image": "Image hero", "hero_media:video": "Video hero", "hero_media:webgl": "3D / WebGL hero", "hero_media:none": "No hero media",
  "hero_layout:centered_stack": "Centered hero", "hero_layout:full_bleed_media": "Full-bleed media", "hero_layout:grid_collage": "Collage hero", "hero_layout:product_first": "Product-first hero",
  "hero_layout:split_left_text": "Split hero, text left", "hero_layout:split_right_text": "Split hero, text right", "hero_layout:text_only": "Text-only hero",
  "components:alternating_feature_rows": "Alternating feature rows", "components:bento_grid": "Bento grids", "components:carousel": "Carousels", "components:case_study_cards": "Case-study cards", "components:chat_ui_mock": "Chat interface mockups",
  "components:code_block": "Code snippets", "components:comparison_table": "Comparison tables", "components:cookie_banner": "Cookie banners", "components:cta_band": "Call-to-action bands", "components:device_mockup": "Device mockups",
  "components:faq_accordion": "FAQ accordions", "components:feature_grid": "Feature grids", "components:feature_tabs": "Tabbed features", "components:interactive_demo": "Interactive demos", "components:logo_wall": "Logo walls",
  "components:map": "Maps", "components:marquee": "Scrolling marquees", "components:newsletter_signup": "Newsletter sign-ups", "components:pricing_table": "Pricing tables", "components:product_screenshot": "Product screenshots",
  "components:stats_row": "Stat rows", "components:sticky_scroll_story": "Sticky scroll stories", "components:team_grid": "Team grids", "components:testimonial_cards": "Testimonial cards", "components:testimonial_quote": "Pull-quote testimonials", "components:video_embed": "Embedded video",
  "whitespace:median": "Median whitespace", "whitespace:high": "Generous whitespace",
  "grid_cols:0": "No column grid", "grid_cols:1": "Single-column layouts", "grid_cols:2": "2-column grids", "grid_cols:3": "3-column grids", "grid_cols:4": "4-column grids", "grid_cols:5+": "5+ column grids",
  "cta_shape:soft": "Soft-cornered buttons", "cta_shape:round": "Rounded buttons", "cta_shape:pill": "Pill buttons", "cta_shape:sharp": "Square-cornered buttons", "cta_shape:none": "No button calls to action",
  "h1_align:left": "Left-aligned headlines", "h1_align:center": "Centered headlines", "h1_align:right": "Right-aligned headlines",
  // VIBE
  "aesthetic:brutalist": "Brutalism", "aesthetic:corporate": "Corporate polish", "aesthetic:dark_tech": "Dark tech", "aesthetic:editorial": "Editorial", "aesthetic:glassmorphism": "Glassmorphism", "aesthetic:luxury": "Luxury",
  "aesthetic:maximalist": "Maximalism", "aesthetic:minimal": "Minimalism", "aesthetic:neo_brutalist": "Neo-brutalism", "aesthetic:organic": "Organic", "aesthetic:playful": "Playful style", "aesthetic:retro_futurist": "Retro-futurism",
  "aesthetic:skeuomorphic": "Skeuomorphism", "aesthetic:swiss_grid": "Swiss grid style", "aesthetic:terminal_mono": "Terminal style", "aesthetic:y2k": "Y2K",
  "imagery:3d_render": "3D renders", "imagery:abstract_gradient": "Abstract gradients", "imagery:abstract_shapes": "Abstract shapes", "imagery:collage": "Collage imagery", "imagery:data_viz": "Charts and data visuals", "imagery:generative_art": "Generative art",
  "imagery:illustration_flat": "Flat illustration", "imagery:illustration_hand_drawn": "Hand-drawn illustration", "imagery:none": "No imagery", "imagery:photography_lifestyle": "Lifestyle photography", "imagery:photography_people": "People photography",
  "imagery:photography_product": "Product photography", "imagery:pixel_art": "Pixel art", "imagery:product_ui": "Product UI shots", "imagery:typographic_only": "Type-only visuals", "imagery:video_still": "Video stills",
  "ai_positioning:ai_core": "AI as the product", "ai_positioning:ai_feature": "AI as a feature", "ai_positioning:ai_mentioned": "AI mentioned in passing", "ai_positioning:none": "No AI positioning",
  "tone:aspirational": "Aspirational voice", "tone:authoritative": "Authoritative voice", "tone:calm": "Calm voice", "tone:friendly": "Friendly voice", "tone:irreverent": "Irreverent voice", "tone:playful": "Playful voice",
  "tone:premium": "Premium voice", "tone:technical": "Technical voice", "tone:urgent": "Urgent voice",
  // COMPOSITES (rules in composites.ts)
  "combo:big_type": "Big type", "combo:editorial_serif": "Editorial serif", "combo:dark_tech": "Dark tech look", "combo:soft_ui": "Soft UI", "combo:product_led_hero": "Product-led hero", "combo:proof_wall": "Proof wall",
  "combo:motion_rich": "Motion-rich", "combo:immersive_3d": "Immersive 3D", "combo:numbers_up_front": "Numbers up front", "combo:ai_forward": "AI-forward", "combo:playful_brand": "Playful brand", "combo:quiet_minimal": "Quiet minimalism",
  "pricing:has_free_tier": "Free tier", "pricing:has_trial": "Free trial", "pricing:has_usage_based": "Usage-based pricing", "pricing:has_ai_addon": "Paid AI add-on", "pricing:ai_credits_model": "AI credits pricing",
};

/** Short phrases used by the vibe map (cluster names and axes). Kept identical to the phrases cluster names were built from. */
export const VIBE_SHORT: Record<string, string> = {
  "aesthetic:neo_brutalist": "soft brutalism", "aesthetic:brutalist": "brutalism", "aesthetic:swiss_grid": "swiss grid", "aesthetic:dark_tech": "dark tech", "aesthetic:retro_futurist": "retro-futurist", "aesthetic:terminal_mono": "terminal", "aesthetic:y2k": "y2k",
  "imagery:product_ui": "product UI", "imagery:photography_people": "people photos", "imagery:photography_product": "product photos", "imagery:photography_lifestyle": "lifestyle photos", "imagery:3d_render": "3D", "imagery:illustration_flat": "flat illustration", "imagery:illustration_hand_drawn": "hand-drawn", "imagery:abstract_gradient": "gradients", "imagery:abstract_shapes": "abstract shapes", "imagery:generative_art": "generative", "imagery:data_viz": "data viz", "imagery:video_still": "video", "imagery:typographic_only": "type-only", "imagery:pixel_art": "pixel art",
  "hero_layout:centered_stack": "centered hero", "hero_layout:split_left_text": "split hero", "hero_layout:split_right_text": "split hero (right)", "hero_layout:full_bleed_media": "full-bleed", "hero_layout:text_only": "text-only hero", "hero_layout:grid_collage": "grid collage", "hero_layout:product_first": "product-first",
  "color_mood:high_contrast": "high contrast", "color_mood:earthy": "warm", "headline:serif": "serif", "type:mono": "mono", "theme:dark": "dark", "theme:light": "light",
};

const HUE: Record<string, string> = { "red-orange": "red-orange", "lime-green": "lime green", "yellow-lime": "yellow-lime" };
/** "amber·muted·dark" → "Muted dark amber"; neutrals get plain names. */
export function colorName(key: string): string | null {
  const [hue, chroma, light] = key.split("·");
  if (!hue || !chroma || !light || !/^(dark|mid|light)$/.test(light)) return null;
  if (hue === "neutral") return light === "light" ? "Off-white and light grey" : light === "dark" ? "Near-black" : "Mid grey";
  if (!/^(muted|vivid)$/.test(chroma) || !/^[a-z-]+$/.test(hue)) return null;
  const words = [chroma === "vivid" ? "Vivid" : "Muted", light === "mid" ? "" : light, HUE[hue] ?? hue].filter(Boolean);
  return words.join(" ");
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const familyName = (v: string) => v.split(/[\s_-]+/).filter(Boolean).map(cap).join(" ");
/** Readable title case of an unknown key. */
export const fallbackName = (key: string) => cap((key.includes(":") ? key.split(":").slice(1).join(":") : key).replace(/[_-]+/g, " ").trim().toLowerCase()) || key;

/** Accepts "css:subgrid", "spread:big_headline", bare values like "bento-grid" or "subgrid", font families ("family:Inter") and color tickers. */
export function canonical(raw: string): string {
  const key = raw.trim().replace(/^\$/, "");
  const i = key.indexOf(":");
  if (i > 0) {
    const cat = key.slice(0, i), value = key.slice(i + 1).replace(/:all$/, "");
    if (cat === "spread") return SPREAD_ALIAS[value] ?? key;
    if (cat in CATEGORY_DIMENSION) return `${cat}:${value}`;
  }
  if (SPREAD_ALIAS[key]) return SPREAD_ALIAS[key]!;
  const bare = key.toLowerCase().replace(/-/g, "_");
  if (colorName(key)) return `color:${key}`;
  for (const k of Object.keys(NAMES)) if (k.slice(k.indexOf(":") + 1) === bare) return k;
  return key;
}

export type ResolvedLabel = TraitLabel & { key: string; known: boolean };
export function resolveLabel(raw: string): ResolvedLabel {
  const key = canonical(raw), i = key.indexOf(":"), cat = i > 0 ? key.slice(0, i) : "", value = i > 0 ? key.slice(i + 1) : key;
  const dimension = KEY_DIMENSION[key] ?? CATEGORY_DIMENSION[cat] ?? "VIBE";
  const short = VIBE_SHORT[key];
  const out = (name: string, known = true): ResolvedLabel => ({ key, name, dimension, ...(short ? { short } : {}), known });
  if (NAMES[key]) return out(NAMES[key]!);
  if (cat === "family" && value) return out(value);
  if (cat === "h1_font" && value) return out(`${familyName(value)} headlines`);
  if (cat === "body_font" && value) return out(`${familyName(value)} body text`);
  if (cat === "h1_word" && value) return out(`“${value}” in headlines`);
  if (cat === "vibe" && value) return out(cap(value));
  if ((cat === "color" || cat === "accent") && colorName(value)) return out(cat === "accent" ? `${colorName(value)} accents` : colorName(value)!);
  return out(fallbackName(key), false);
}
/** label(traitKey) → { name, dimension, short? } */
export function label(traitKey: string): TraitLabel {
  const { name, dimension, short } = resolveLabel(traitKey);
  return short ? { name, dimension, short } : { name, dimension };
}
export const traitKey = (dimension: string, value: string) => `${dimension}:${value}`;
/** "Subgrid layouts [LAYOUT]" */
export const traitText = (key: string) => { const l = label(key); return `${l.name} [${l.dimension}]`; };
/** Vibe-map phrase: the short form when one exists, else the value in plain words. */
export const tagPhrase = (token: string) => VIBE_SHORT[token] ?? (token.split(":")[1] ?? token).replace(/_/g, " ");
/** Name for mid-sentence use: lowercases a leading capital unless it starts an acronym or proper noun ("3D", "OKLCH", "Next.js" stay). */
export const inSentence = (name: string) => (/^[A-Z][a-z]/.test(name) && !/^(Next|Framer|Webflow|Tailwind|Shopify|Wix|Nuxt|Gatsby|Astro|Squarespace|WordPress|SvelteKit|Lottie|Y2K|Inter)\b/.test(name) ? name[0]!.toLowerCase() + name.slice(1) : name);
export const scopeText = (scope: string | null | undefined) => (!scope || scope === "all" ? "all sectors" : scope);
/** Library sector names for the sector lens and brand pages. */
export const SECTOR_NAMES: Record<string, string> = { all: "All sectors", ai: "AI", "dev-tools": "Dev tools", fintech: "Fintech", "consumer-apps": "Consumer apps", "commerce-dtc": "Commerce & DTC", media: "Media", studios: "Studios", hardware: "Hardware", health: "Health", "enterprise-saas": "Enterprise SaaS" };
export const sectorName = (s: string | null | undefined) => (!s ? "All sectors" : SECTOR_NAMES[s] ?? s.replace(/-/g, " ").replace(/^./, c => c.toUpperCase()));

// STAGES — exactly five words, shown as outlined badges.
export const STAGES = ["Emerging", "Rising", "Peaking", "Fading", "Steady"] as const;
export type StageName = (typeof STAGES)[number];
/** Stored forecast stages (forecast.ts) and Google Fonts bands (bands.ts) → one of five words. null = too little history to stage. */
export const STAGE_MAP: Record<string, StageName | null> = {
  emerging: "Emerging", accelerating: "Rising", peaking: "Peaking", declining: "Fading", flat: "Steady",
  RISING: "Rising", RETURNING: "Rising", PEAKING: "Peaking", FADING: "Fading", STEADY: "Steady", BASELINE: null,
};
export function stageName(v: string | null | undefined): StageName | null {
  if (!v) return null;
  if (v in STAGE_MAP) return STAGE_MAP[v]!;
  const t = v.toLowerCase();
  if (t in STAGE_MAP) return STAGE_MAP[t]!;
  return STAGES.find(s => s.toLowerCase() === t) ?? null;
}

/** Display title for a wire alert. Rewrites stored ticker titles ("BREAKOUT $SUBGRID +4.8 pts/q in all") through the label map; new titles pass through. */
export function alertDisplayTitle(title: string, ref: string | null | undefined): string {
  const m = /^([A-Z][A-Z ]*?) \$[A-Z0-9][A-Z0-9-]*\b ?(.*)$/.exec(title);
  if (!m) return title.replace(/\$[A-Z][A-Z0-9-]*/g, t => traitText(t.slice(1)));
  const name = ref ? traitText(ref) : "signal";
  const rest = (m[2] ?? "").replace(/ in ([a-z][a-z0-9-]*)$/, (_, s: string) => ` · ${scopeText(s)}`);
  return `${m[1]} · ${name}${rest ? ` ${rest}` : ""}`;
}

/** Trait categories the weekly forecast stages; each of their keys has a signal page at /signals/<key>. */
export const FORECAST_CATEGORIES = new Set(["aesthetic", "ai_positioning", "color_mood", "combo", "components", "css", "font", "framework", "headline", "hero_layout", "hero_media", "imagery", "theme", "tone", "tracking"]);

// BASIS — measured from page code and rendered styles, or estimated by the AI tagger. One word chip, no color, everywhere a value shows.
/** Categories read by the AI tagger (vision tags) or the AI text extractor (pricing pages); vibe-map clusters are built from AI tags. */
export const AI_TAGGED = new Set(["aesthetic", "tone", "imagery", "components", "hero_layout", "color_mood", "ai_positioning"]);
const AI_CATEGORIES = new Set([...AI_TAGGED, "vibe", "pricing"]);
/** Composites with at least one AI-estimated member (kept in step with composites.ts by composites.test.ts). */
export const COMBO_AI = new Set(["editorial_serif", "dark_tech", "product_led_hero", "proof_wall", "numbers_up_front", "ai_forward", "playful_brand", "quiet_minimal"]);
export type Basis = "measured" | "ai";
export const BASIS_WORD: Record<Basis, string> = { measured: "MEASURED", ai: "AI ESTIMATE" };
/** basis(traitKey) → "measured" | "ai". Composites are "ai" when any member is. */
export function basis(traitKey: string): Basis {
  const k = canonical(traitKey), i = k.indexOf(":"), cat = i > 0 ? k.slice(0, i) : "";
  if (cat === "combo") return COMBO_AI.has(k.slice(i + 1)) ? "ai" : "measured";
  return AI_CATEGORIES.has(cat) ? "ai" : "measured";
}
export const basisWord = (traitKey: string) => BASIS_WORD[basis(traitKey)];
/** Signal object page (Phase 13: /signals/<key>; old /trait/<key> links redirect there). */
export const explainerPath = (key: string) => `/signals/${encodeURIComponent(canonical(key))}`;
/** Absolute explainer URL for forecast traits; null for keys the forecast does not stage (fonts, colors, crawl-only signals). */
export function explainerUrl(key: string): string | null {
  const k = canonical(key), cat = k.slice(0, Math.max(0, k.indexOf(":")));
  return FORECAST_CATEGORIES.has(cat) ? `${SITE_URL}${explainerPath(k)}` : null;
}

const BRAND_DOMAIN = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** Absolute brand page URL for a site (MCP `brand_url`). */
export const brandUrl = (domain: string) => `${SITE_URL}/brands/${encodeURIComponent(domain)}`;
/** Strings: any leftover "$TICKER" becomes "Name [DIM]". Prices ("$50") are untouched because tickers start with a letter. */
export const untick = (s: string) => s.replace(/\$([A-Z][A-Z0-9-]+)/g, (_, t: string) => traitText(t));
/** Output decoration for agents: stable keys stay; human label/dimension/basis/stage_label (and explainer_url for forecast traits) are added next to them; `extra` adds per-key fields (tier, momentum_index, confidence). Pure, recursive. */
export function withLabels<T>(data: T, extra?: (key: string) => Record<string, unknown> | undefined): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return untick(v);
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = walk(x);
    const key = typeof o["trait"] === "string" && (o["trait"] as string).includes(":") ? (o["trait"] as string)
      : typeof o["dimension"] === "string" && typeof o["value"] === "string" && (o["dimension"] as string) in CATEGORY_DIMENSION ? `${o["dimension"]}:${o["value"]}`
      : typeof o["signal"] === "string" && SPREAD_ALIAS[o["signal"] as string] ? `spread:${o["signal"]}` : null;
    if (key) {
      const l = label(key);
      if (!("label" in o)) o["label"] = l.name;
      if (!("basis" in o)) o["basis"] = basis(key);
      const more = extra?.(canonical(key));
      if (more) for (const [k, v] of Object.entries(more)) if (!(k in o)) o[k] = v;
      const url = explainerUrl(key);
      if (url && !("explainer_url" in o)) o["explainer_url"] = url;
      if ("dimension" in o && o["dimension"] !== l.dimension) o["label_dimension"] = l.dimension; else o["dimension"] = l.dimension;
    }
    // Any object that names a site gets its brand page (Phase 13).
    if (typeof o["domain"] === "string" && BRAND_DOMAIN.test(o["domain"] as string) && !("brand_url" in o)) o["brand_url"] = brandUrl(o["domain"] as string);
    if (Array.isArray(o["tickers"]) && !("color_labels" in o)) o["color_labels"] = (o["tickers"] as unknown[]).map(t => (typeof t === "string" ? colorName(t) : t));
    if (typeof o["stage"] === "string" || o["stage"] === null) { if ("stage" in o && !("stage_label" in o)) o["stage_label"] = stageName(o["stage"] as string | null); }
    return o;
  };
  return walk(data) as T;
}

/** Display copy for a stored brief: text stays as stored except leftover $TICKERs; citations name traits through the label map. */
export type BriefLike = { headline: string; caveats: string; refs?: Record<string, { label: string }> | undefined; sections: { title: string; body: string; citations: { kind: string; id: string }[] }[] };
export function citationText(c: { kind: string; id: string }, refLabel?: string) {
  const name = c.kind === "forecast" ? label(c.id.split(":").slice(0, 2).join(":")).name : c.kind === "spread" ? label(`spread:${c.id}`).name : untick(refLabel ?? c.id);
  return `${c.kind.toUpperCase()} · ${name}`;
}
export function briefDisplay<T extends BriefLike>(b: T) {
  return { headline: untick(b.headline), caveats: untick(b.caveats), sections: b.sections.map(s => ({ title: s.title, body: untick(s.body), citations: s.citations.map(c => ({ ...c, text: citationText(c, b.refs?.[`${c.kind}:${c.id}`]?.label) })) })) };
}

// HOMEPAGE SECTIONS — names for section crops (Phase 15).
export const CROP_SECTION_NAME = { hero: "Hero", nav: "Navigation", pricing: "Pricing", cta: "Call to action", footer: "Footer" } as const;
