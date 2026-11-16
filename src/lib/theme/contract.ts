// The token contract every theme fills: semantic roles only (named by what they are for, never by their value).
// A theme supplies shared tokens (fonts, radius, borders, shadows, spacing, layout, motion, image palettes) plus one palette and
// type scale per mode. css.ts turns a theme into CSS variables (--tk-*); styles and components read only those variables.
export const MODES = ["light", "dark", "vibes"] as const;
export type Mode = (typeof MODES)[number];

/** Type roles. `size*` / `leading*` step at the md (768px) and xl (1440px) breakpoints; a theme may also use clamp() in `size`. */
export const TYPE_ROLES = ["wordmark", "mast", "display", "h1", "h2", "h3", "h4", "kicker", "deck", "body-lg", "body", "small", "caption", "quote", "figure", "stat", "data", "chip", "specimen"] as const;
export type TypeRoleName = (typeof TYPE_ROLES)[number];
export type FontRole = "mono" | "display" | "text";
export type TypeRole = {
  family: FontRole; weight: string; size: string; sizeMd?: string; sizeXl?: string;
  leading: string; leadingMd?: string; tracking: string; case: "none" | "uppercase" | "lowercase"; style: "normal" | "italic";
  /** Optical size cap for variable faces ("normal" when not set). */
  opsz: string;
  /** Figure style: tabular for numbers a reader compares. */
  numeric: "normal" | "tabular-nums";
  /** Line breaking: headlines balance, text is pretty, data stays auto. */
  wrap: "balance" | "pretty" | "auto";
};
/** One colour job with the ink that reads on it. */
export type Pair = { bg: string; fg: string };
/** A gumball (a round data point): light highlight, base colour, dark edge. */
export type Gumball = { light: string; base: string; dark: string };
export const GUMBALLS = ["pink", "green", "yellow", "red", "ink", "newsprint"] as const;
export type GumballName = (typeof GUMBALLS)[number];
export type Palette = {
  surface: { page: string; card: string; raised: string; sunken: string; inverse: string };
  text: { primary: string; secondary: string; muted: string; inverse: string; onAccent: string; emphasis: string };
  rule: { strong: string; hairline: string };
  accent: { 1: string; 2: string; 3: string; 4: string };
  onAccent: { 1: string; 2: string; 3: string; 4: string };
  /** Stage fills (chips, chart marks) and the ink that reads on each. */
  stage: { emerging: string; rising: string; peaking: string; fading: string; steady: string; unstaged: string };
  onStage: { emerging: string; rising: string; peaking: string; fading: string; steady: string; unstaged: string };
  /** The one loud thing on a screen (the lead), and the highlighter (what moved, focus halo, stickers). */
  plate: Pair;
  highlight: Pair;
  /** The ink slab (navigation, the ticker, footers) and the type on it; ink in every mode. */
  slab: Pair;
  /** Rising and measured values; live and urgent (the dot, the stamp). */
  positive: string;
  live: string;
  /** The colour of hard shadows (Raised, Sticker) and the slab the drawn mark sits on in this mode. */
  shadowInk: string;
  markGround: string;
  /** Chart strokes: axis, gridline, and the double stroke under a coloured line (outer, inner). */
  chart: { axis: string; grid: string; outline: string; inner: string };
  gumball: Record<GumballName, Gumball>;
  mark: { measured: string; ai: string; live: string };
  focus: { ring: string; width: string; offset: string; /** Fills the outline offset (a yellow ring in light mode). */ halo: string };
  selection: { bg: string; text: string };
  scrollbar: { track: string; thumb: string };
};
export type ModeTokens = Palette & { type: Record<TypeRoleName, TypeRole> };
/** Colours for images rendered outside the page (PNG cards, embeds, share images): they cannot read CSS variables. */
export type ImagePalette = { bg: string; ink: string; muted: string; secondary: string; rule: string; accent: string };
export type Shared = {
  fonts: { mono: string; display: string; text: string; /** Stylesheets that load the faces; the only place font URLs live. */ base: string; editorial: string; preconnect: readonly string[] };
  root: { size: string; leading: string };
  radius: { none: string; sm: string; md: string; pill: string; /** Round things only: stickers, gumballs. */ sticker: string; icon: string };
  border: { hairline: string; strong: string };
  /** Hard shadows exist only on Raised (things you press) and Sticker; see components/brand/Containers. */
  shadow: { flat: string; raised: string; pressed: string; sticker: string };
  /** The spacing scale, smallest first: 4, 8, 16, 24, 40, 64, 104 in the legacy theme. */
  space: { 1: string; 2: string; 3: string; 4: string; 5: string; 6: string; 7: string };
  layout: { wrap: string; gutter: string; gutterLg: string; gridGap: string; gridGapLg: string; measure: string; tap: string };
  motion: { fast: string; base: string; slow: string; ease: string; tick: string; tickEase: string;
    /** Brand timings and easings: tap, move, wipe, arrive, draw; the mark's letter stagger. */
    tap: string; move: string; wipe: string; arrive: string; draw: string; stagger: string; ooze: string; cut: string; settle: string };
  /** Page densities: gap between blocks, gap inside a block, air above the title. */
  density: Record<"quiet" | "steady" | "loud", { block: string; inner: string; air: string }>;
  /** Square chrome: when true every corner is square and no element casts a shadow, whatever a component asks for. */
  square: boolean;
  print: { paper: string; ink: string; muted: string };
  image: { dark: ImagePalette; light: ImagePalette };
};
export type Theme = { name: string; label: string; shared: Shared; modes: Record<Mode, ModeTokens> };

/** Every CSS variable a theme writes, with its value, for one mode (shared tokens included). */
export function flatten(theme: Theme, mode: Mode): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (prefix: string, o: object) => { for (const [k, v] of Object.entries(o)) { const key = `${prefix}-${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`; if (v && typeof v === "object" && !Array.isArray(v)) put(key, v); else if (typeof v === "string") out[key] = v; } };
  const { type, ...palette } = theme.modes[mode];
  put("--tk", palette);
  for (const [role, t] of Object.entries(type)) for (const [k, v] of Object.entries(t)) if (k !== "family") out[`--tk-type-${role}-${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`] = v as string;
  for (const [role, t] of Object.entries(type)) out[`--tk-type-${role}-family`] = `var(--tk-font-${t.family})`;
  const { fonts, image: _image, print, square: _square, ...rest } = theme.shared;
  put("--tk", rest); put("--tk-print", print);
  out["--tk-font-mono"] = fonts.mono; out["--tk-font-display"] = fonts.display; out["--tk-font-text"] = fonts.text;
  return out;
}
/** The token names (CSS variables) a complete theme must provide in every mode. Breakpoint steps are optional extras. */
export const requiredTokens = (theme: Theme, mode: Mode) => Object.keys(flatten(theme, mode)).filter(k => !/-(size-md|size-xl|leading-md)$/.test(k));
/** Lists the tokens `candidate` lacks against `reference` (empty when complete). Used by tests and when registering a theme. */
export function missingTokens(candidate: Theme, reference: Theme): string[] {
  return MODES.flatMap(m => { const have = new Set(Object.keys(flatten(candidate, m))); return requiredTokens(reference, m).filter(k => !have.has(k) || !flatten(candidate, m)[k]).map(k => `${m}:${k}`); });
}
