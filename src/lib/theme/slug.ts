// The "slug" theme (brand P · Extra Fine, approved 16 Nov 2026), built from the owner's kit: brand/tokens/slug.theme.ts
// (the same values as slug.tokens.json). brand/README.md is the source of truth; this file only maps the kit onto the
// token contract. Values the kit does not give are marked CHOSEN, with the reason, and listed on /brand.
import { slugBrand as K } from "../../../brand/tokens/slug.theme";
import { BRAND_NAME } from "../brand";
import type { Gumball, GumballName, Mode, ModeTokens, Shared, Theme, TypeRole, TypeRoleName } from "./contract";
// L1 · the living settings (radius, heading tracking, motion timing) are read from the register, never written twice.
import { LIVE_VALUES } from "../living/editions";
import { durationCss, radiusCss, trackingCss, type LivingValues } from "../living/settings";

const C = K.color, T = K.type, px = (n: number) => `${n}px`;
type KMode = (typeof K.mode)[Mode];
const FAM = { display: "display", text: "text", mono: "mono" } as const;

/** A type role from the kit, with smaller steps for phones and tablets (CHOSEN: the kit gives one size, the desktop size). */
function kit(name: keyof typeof T, steps: { base?: number; md?: number; leading?: string } = {}): TypeRole {
  const t = T[name] as { family: keyof typeof FAM; weight: number; size: number; leading: number; case?: string; tracking?: number | string; style?: string; numeric?: string };
  const display = t.family === "display";
  return {
    family: FAM[t.family], weight: String(t.weight), size: px(steps.base ?? t.size),
    ...(steps.base !== undefined ? { sizeMd: px(steps.md ?? t.size) } : {}),
    ...(steps.md !== undefined && steps.md !== t.size ? { sizeXl: px(t.size) } : {}),
    leading: steps.leading ?? String(t.leading), ...(steps.leading ? { leadingMd: String(t.leading) } : {}),
    tracking: t.tracking ? String(t.tracking) : "0", case: t.case === "upper" ? "uppercase" : "none", style: t.style === "italic" ? "italic" : "normal", opsz: "normal",
    numeric: t.numeric === "tabular-nums" || name === "figure" || name === "data" ? "tabular-nums" : "normal",
    wrap: display ? "balance" : t.family === "mono" ? "auto" : "pretty",
  };
}
const role = (family: TypeRole["family"], weight: string, size: string, leading: string, o: Partial<TypeRole> = {}): TypeRole =>
  ({ family, weight, size, leading, tracking: "0", case: "none", style: "normal", opsz: "normal", numeric: "normal", wrap: family === "display" ? "balance" : family === "mono" ? "auto" : "pretty", ...o });
const caps = { case: "uppercase", tracking: "0.12em" } as const;

/** Read pages (light and vibes): the kit's role ladder. `trk` is the heading tracking setting (display, h1, h2, h3). */
const readTypeOf = (trk: string): Record<TypeRoleName, TypeRole> => ({
  // CHOSEN: the mark is a drawing now; this role only sets the word where a drawing cannot go (plain-text fallbacks).
  wordmark: role("display", "900", "20px", "1", { case: "lowercase" }),
  // CHOSEN: the Digest masthead is the Display role.
  mast: kit("display", { base: 64, md: 104, leading: "0.9" }),
  display: { ...kit("display", { base: 56, md: 96, leading: "0.9" }), tracking: trk },
  h1: { ...kit("h1", { base: 40, md: 56, leading: "0.95" }), tracking: trk },
  h2: { ...kit("h2", { base: 30 }), tracking: trk },
  h3: { ...kit("h3", { base: 22 }), tracking: trk },
  // CHOSEN: the kit stops at H3; H4 continues the ladder.
  h4: role("display", "900", "19px", "1.05", { sizeMd: "22px", case: "uppercase" }),
  kicker: kit("kicker"),
  deck: kit("deck", { base: 20, md: 23 }),
  // CHOSEN: a lead paragraph between Deck and Body.
  "body-lg": role("text", "400", "20px", "1.4", { sizeMd: "22px" }),
  body: kit("body", { base: 17 }),
  // CHOSEN: card decks and notes, between Body and Caption.
  small: role("text", "400", "16px", "1.45"),
  caption: kit("caption"),
  quote: kit("quote", { base: 24, md: 30 }),
  figure: kit("figure", { base: 56, md: 72 }),
  // CHOSEN: a second figure size (H2 scale) for stat rows.
  stat: role("display", "900", "32px", "0.95", { sizeMd: "44px", case: "uppercase", numeric: "tabular-nums" }),
  data: kit("data"),
  chip: kit("chip"),
  // CHOSEN: specimens render a measured font in its own face; the fallback is the text face.
  specimen: role("text", "400", "clamp(36px, 7vw, 72px)", "1.05"),
});
/** The terminal (dark): the same brand at its densest (brand/README.md, "The terminal"). CHOSEN sizes keep the terminal's 11/13 grid. */
const terminalTypeOf = (trk: string): Record<TypeRoleName, TypeRole> => ({
  ...readTypeOf(trk),
  mast: role("display", "900", "48px", "0.9", { case: "uppercase" }),
  display: role("display", "900", "48px", "0.9", { case: "uppercase", numeric: "tabular-nums", tracking: trk }),
  h1: role("display", "900", "24px", "1", { case: "uppercase", tracking: trk }),
  h2: role("display", "900", "20px", "1", { case: "uppercase", tracking: trk }),
  h3: role("display", "900", "16px", "1.1", { case: "uppercase", tracking: trk }),
  h4: role("display", "700", "13px", "16px", caps),
  kicker: role("display", "700", "13px", "16px", caps),
  chip: role("display", "700", "11px", "14px", caps),
  deck: role("text", "400", "15px", "1.4"),
  "body-lg": role("mono", "400", "16px", "20px"),
  body: role("mono", "400", "13px", "1.5", { numeric: "tabular-nums" }),
  small: role("text", "400", "14px", "1.45"),
  caption: role("mono", "400", "11px", "16px", { numeric: "tabular-nums" }),
  quote: role("text", "400", "15px", "1.4", { style: "italic" }),
  figure: role("display", "900", "48px", "0.9", { numeric: "tabular-nums" }),
  stat: role("display", "900", "32px", "0.95", { numeric: "tabular-nums" }),
  data: role("mono", "400", "13px", "1.5", { numeric: "tabular-nums" }),
});

const G = K.gumball;
// CHOSEN: the kit has no newsprint gumball; Steady points need one. Light and dark are the newsprint lifted and pressed.
const gumball: Record<GumballName, Gumball> = { pink: G.pink, green: G.green, yellow: G.yellow, red: G.red, ink: G.ink, newsprint: { light: "#EDE8DC", base: C.newsprint, dark: "#8F8774" } };
const S = K.stage;
const stage = { emerging: S.emerging.bg, rising: S.rising.bg, peaking: S.peaking.bg, fading: S.fading.bg, steady: S.steady.bg };
const onStage = { emerging: S.emerging.fg, rising: S.rising.fg, peaking: S.peaking.fg, fading: S.fading.fg, steady: S.steady.fg };

function mode(m: Mode, type: Record<TypeRoleName, TypeRole>, o: { accent: [string, string, string, string]; onAccent: [string, string, string, string]; focus: ModeTokens["focus"]; grid: string; thumb: string; unstaged: string }): ModeTokens {
  const k: KMode = K.mode[m];
  return {
    surface: { page: k["surface-page"], card: k["surface-card"], raised: k["surface-raised"], sunken: k["surface-sunken"], inverse: k["surface-inverse"] },
    // CHOSEN: the kit has one muted text colour; "secondary" uses it too.
    text: { primary: k["text-primary"], secondary: k["text-muted"], muted: k["text-muted"], inverse: k["text-inverse"], onAccent: C.ink, emphasis: k["text-primary"] },
    // The kit has one rule colour per mode; the two rule tokens differ only in width (1.5 px hairline, 3 px rule).
    rule: { strong: k.rule, hairline: k.rule },
    accent: { 1: o.accent[0], 2: o.accent[1], 3: o.accent[2], 4: o.accent[3] },
    onAccent: { 1: o.onAccent[0], 2: o.onAccent[1], 3: o.onAccent[2], 4: o.onAccent[3] },
    stage: { ...stage, unstaged: o.unstaged }, onStage: { ...onStage, unstaged: k["text-primary"] },
    mark: { measured: k.positive, ai: k["text-primary"], live: k.live },
    focus: o.focus,
    selection: { bg: k.highlight, text: C.ink },
    scrollbar: { track: k["surface-page"], thumb: o.thumb },
    plate: { bg: k.plate, fg: k["on-plate"] }, highlight: { bg: k.highlight, fg: C.ink },
    // The slab is ink with paper type in every mode (README, "Containers": "Slab: ink").
    slab: { bg: C.ink, fg: C.paper },
    positive: k.positive, live: k.live, shadowInk: k.shadow, markGround: k["mark-ground"],
    chart: { axis: k.rule, grid: o.grid, outline: C.ink, inner: C.paper },
    gumball,
    type,
  };
}

const D = K.density, M = K.motion, SH = K.shape;
/** Each brand family is followed by a metric-matched local fallback (the @font-face rules in styles.css, FONT_FALLBACKS), so the page is
 * drawn at once in the fallback and the swap to the web font barely moves it.
 * L2b · one face per local font with its own size match (a narrow sans and Georgia where they exist, else Arial-metric and Times-metric
 * faces such as Liberation on Linux), because one size match cannot fit fonts of different widths. */
export const FONT_FALLBACKS = { display: ["slug Display Fallback", "slug Display Fallback Wide"], text: ["slug Text Fallback", "slug Text Fallback Times"], mono: "slug Mono Fallback" } as const;
const sharedOf = (v: LivingValues): Shared => ({
  fonts: {
    mono: K.font.mono.replace(/'/g, '"'), display: K.font.display.replace(/'/g, '"'), text: K.font.text.replace(/'/g, '"'), fallback: FONT_FALLBACKS,
    // One font link for every page: Big Shoulders 700/900, Newsreader 400/600/italic, IBM Plex Mono 400/600.
    base: K.font.google, editorial: K.font.google,
    preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
  },
  // CHOSEN: the root stays 13 px so rem-based spacing in existing layouts does not shift; every text role sets its own size.
  root: { size: "13px", leading: "20px" },
  radius: { none: "0px", sm: radiusCss(v.radius), md: radiusCss(v.radius), pill: radiusCss(v.radius), sticker: px(SH["radius-sticker"]), icon: SH["radius-app-icon"] },
  border: { hairline: px(SH["border-hairline"]), strong: px(SH["border-rule"]) },
  // The kit's shadows are ink in light/vibes and paper in dark: the offset comes from the kit, the colour from each mode's shadow ink.
  shadow: { flat: "none", raised: SH["shadow-raised"].replace(C.ink, "var(--tk-shadow-ink)"), pressed: SH["shadow-pressed"].replace(C.ink, "var(--tk-shadow-ink)"), sticker: SH["shadow-sticker"].replace(C.ink, "var(--tk-shadow-ink)") },
  space: Object.fromEntries(K.space.map((v, i) => [i + 1, px(v)])) as Shared["space"],
  // CHOSEN: page width and gutters keep today's grid; the measure is the kit's 62 characters.
  layout: { wrap: "1360px", gutter: "20px", gutterLg: "40px", gridGap: px(D.steady["gap-inner"] + 8), gridGapLg: px(D.steady["gap-block"]), measure: T.body.measure, tap: "44px" },
  motion: {
    fast: durationCss(M.tap, v.motion), base: durationCss(M.move, v.motion), slow: durationCss(M.arrive, v.motion), ease: M["ease-settle"], tick: "1.6s", tickEase: "ease-in-out",
    tap: durationCss(M.tap, v.motion), move: durationCss(M.move, v.motion), wipe: durationCss(M.wipe, v.motion), arrive: durationCss(M.arrive, v.motion), draw: durationCss("1600ms", v.motion), stagger: durationCss(M.stagger, v.motion), ooze: M["ease-ooze"], cut: M["ease-cut"], settle: M["ease-settle"],
  },
  // CHOSEN: Steady and Loud have no "air above the title" in the kit; they use 24 and 8 from the scale.
  density: {
    quiet: { block: px(D.quiet["gap-block"]), inner: px(D.quiet["gap-inner"]), air: px(D.quiet["air-above-title"]) },
    steady: { block: px(D.steady["gap-block"]), inner: px(D.steady["gap-inner"]), air: px(K.space[3]!) },
    loud: { block: px(D.loud["gap-block"]), inner: px(D.loud["gap-inner"]), air: px(K.space[1]!) },
  },
  square: false,
  print: { paper: "#FFFFFF", ink: C.ink, muted: C.muted },
  // Images rendered outside the page (PNG cards, embeds). The data line is green (measured, rising) on paper and yellow on ink.
  image: {
    dark: { bg: C.ink, ink: C.paper, muted: C.newsprint, secondary: C.newsprint, rule: C.muted, accent: C.yellow },
    light: { bg: C.paper, ink: C.ink, muted: C.muted, secondary: C.muted, rule: C.ink, accent: C.green },
    // Vibes: the pink page, a yellow card holding the chart, an ink plate for the headline; every mark and line edge is ink.
    vibes: { bg: C.pink, ink: C.ink, muted: C.ink, secondary: C.ink, rule: C.ink, accent: C.green, card: C.yellow, plate: C.ink, plateInk: C.paper, edge: C.ink, ball: G.green },
  },
});

const lightFocus = { ring: C.ink, width: "3px", offset: "3px", halo: C.yellow };
/** The theme for a set of living values (L1): the live site uses LIVE_VALUES; the edition gate and its tests build others. */
export function slugThemeOf(v: LivingValues): Theme {
  const trk = trackingCss(v.tracking), readType = readTypeOf(trk), terminalType = terminalTypeOf(trk), shared = sharedOf(v);
  return {
  // The theme is named after the brand (a machine name: ACTIVE_THEME, kit labels).
  name: BRAND_NAME, label: `${BRAND_NAME} · P Extra Fine`, shared,
  modes: {
    // accent 1 is the lead (pink), 2 rising (green), 3 the highlighter (yellow), 4 live (red). Accents are fills on paper, never text.
    light: mode("light", readType, { accent: [C.pink, C.green, C.yellow, C.red], onAccent: [C.ink, C.ink, C.ink, C.ink], focus: lightFocus, grid: C.newsprint, thumb: C.ink, unstaged: C.white }),
    // The terminal: yellow does focus, selection and the cursor, so it is accent 1 there.
    dark: mode("dark", terminalType, { accent: [C.yellow, C.green, C.pink, C.red], onAccent: [C.ink, C.ink, C.ink, C.ink], focus: { ring: C.yellow, width: "3px", offset: "2px", halo: "transparent" }, grid: C.muted, thumb: C.muted, unstaged: "#1D1B18" }),
    vibes: mode("vibes", readType, { accent: [C.ink, C.green, C.yellow, C.red], onAccent: [C.paper, C.ink, C.ink, C.ink], focus: lightFocus, grid: K.mode.vibes["surface-sunken"], thumb: C.ink, unstaged: C.white }),
  },
  };
}
export const slug: Theme = slugThemeOf(LIVE_VALUES);
/** The kit itself, for pages that show the brand's own numbers (/brand) and for tests. */
export const SLUG_KIT = K;
