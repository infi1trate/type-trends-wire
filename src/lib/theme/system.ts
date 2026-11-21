// THE DESIGN SYSTEM (U3) — one object holding every named design value both views draw from. Read and Data are two mappings of
// the same names: Read is the theme's light mode, Data its dark mode (covers and share cards use the third, vibes, as "cover").
// The values come from the active theme (which maps the owner's kit, brand/tokens); this file only names them. `systemCss` writes
// the object as `--sys-*` custom properties and `SYSTEM` is the typed mirror: both come from `systemOf(theme)`, so they cannot drift
// (system.test.ts parses the CSS back and compares). Components name roles (`bg-page`, `var(--sys-color-ink)`), never a hex.
// Pure; imports only the contract.
import { flatten, type Mode, type Theme, type TypeRoleName } from "./contract";
// L1 · section gaps, the accent role and the chart weights are living settings: their values come from the register.
import { LIVE_VALUES } from "../living/editions";
import { PALETTE, chartWeights, sectionGap, type LivingValues } from "../living/settings";

export const SYSTEM_VIEWS = ["read", "data", "cover"] as const;
export type SystemView = (typeof SYSTEM_VIEWS)[number];
/** Which theme mode each view reads. */
export const VIEW_MODE: Record<SystemView, Mode> = { read: "light", data: "dark", cover: "vibes" };

// COLOUR ROLES ---------------------------------------------------------------------------------------------------------------
export const COLOR_ROLES = ["page", "surface", "ink", "ink-muted", "rule", "highlight", "accent", "link", "focus", "positive", "negative", "measured", "ai-estimate", "warning", "chip"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
/** Where each role takes its value in the theme, per view. Accent is the pink in both views (in Data the theme's lead accent is the
 *  yellow highlighter, so the pink sits at accent 3 there); warning is the highlighter ground, chip the inverse ground. */
const COLOR_SOURCE: Record<ColorRole, { what: string } & Record<SystemView, string>> = {
  page: { what: "The page ground.", read: "--tk-surface-page", data: "--tk-surface-page", cover: "--tk-surface-page" },
  surface: { what: "Cards, panels and bars above the page.", read: "--tk-surface-card", data: "--tk-surface-card", cover: "--tk-surface-card" },
  ink: { what: "Text and marks.", read: "--tk-text-primary", data: "--tk-text-primary", cover: "--tk-text-primary" },
  "ink-muted": { what: "Secondary text: captions, labels, empty states.", read: "--tk-text-muted", data: "--tk-text-muted", cover: "--tk-text-muted" },
  rule: { what: "Rules, borders and chart axes (1.5 px hairline, 3 px rule).", read: "--tk-rule-strong", data: "--tk-rule-strong", cover: "--tk-rule-strong" },
  highlight: { what: "The highlighter: what moved, the selected tab, hover rows.", read: "--tk-highlight-bg", data: "--tk-highlight-bg", cover: "--tk-highlight-bg" },
  accent: { what: "The pink: the headline block and the lead plate.", read: "--tk-accent-1", data: "--tk-accent-3", cover: "--tk-surface-page" },
  link: { what: "Links (underlined ink).", read: "--tk-text-primary", data: "--tk-text-primary", cover: "--tk-text-primary" },
  focus: { what: "The keyboard focus ring.", read: "--tk-focus-ring", data: "--tk-focus-ring", cover: "--tk-focus-ring" },
  positive: { what: "Rising values.", read: "--tk-positive", data: "--tk-positive", cover: "--tk-positive" },
  negative: { what: "Falling or failing values, the live dot.", read: "--tk-live", data: "--tk-live", cover: "--tk-live" },
  measured: { what: "The MEASURED mark.", read: "--tk-mark-measured", data: "--tk-mark-measured", cover: "--tk-mark-measured" },
  "ai-estimate": { what: "The AI ESTIMATE mark (outlined, dashed).", read: "--tk-mark-ai", data: "--tk-mark-ai", cover: "--tk-mark-ai" },
  warning: { what: "A warning ground (held, stale, check failing).", read: "--tk-highlight-bg", data: "--tk-highlight-bg", cover: "--tk-highlight-bg" },
  chip: { what: "The ground of tag chips.", read: "--tk-surface-inverse", data: "--tk-surface-inverse", cover: "--tk-surface-inverse" },
};

// TYPE STEPS -----------------------------------------------------------------------------------------------------------------
/** The size scale in use, by name. `reading` is the body of a story, a study's opening and the Digest's argument. */
export const TYPE_STEPS = ["display", "h1", "h2", "h3", "deck", "reading", "small", "kicker", "data", "caption", "chip", "figure", "stat", "quote", "specimen"] as const;
export type TypeStep = (typeof TYPE_STEPS)[number];
const STEP_ROLE: Record<TypeStep, TypeRoleName> = { display: "display", h1: "h1", h2: "h2", h3: "h3", deck: "deck", reading: "body", small: "small", kicker: "kicker", data: "data", caption: "caption", chip: "chip", figure: "figure", stat: "stat", quote: "quote", specimen: "specimen" };
/** Values the theme has no role for, used as they are today. The terminal's type index sets each family's specimen at 28/36. */
const STEP_OVERRIDE: Partial<Record<TypeStep, Partial<Record<SystemView, Partial<TypeValue>>>>> = { specimen: { data: { size: "28px", leading: "36px", sizeMd: undefined, sizeXl: undefined, leadingMd: undefined } } };
export type TypeValue = { family: "display" | "text" | "mono"; weight: string; size: string; sizeMd?: string | undefined; sizeXl?: string | undefined; leading: string; leadingMd?: string | undefined; tracking: string; case: string };

// SPACE, SHAPE, MOTION ------------------------------------------------------------------------------------------------------
// Section gaps (E4): between a page's sections, phones then from 1024 px (today Tailwind's 12 and 16 steps on the 13 px root): the
// spacing density setting (living/settings.ts).
/** The reading measure (story body, study opening, Digest argument). */
const READING_MEASURE = "68ch";

export type SystemTokens = {
  theme: string;
  color: Record<ColorRole, { what: string } & Record<SystemView, string>>;
  type: Record<TypeStep, { role: TypeRoleName } & Record<SystemView, TypeValue>>;
  font: { display: string; text: string; mono: string };
  space: { scale: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string>; section: { base: string; lg: string }; gutter: string; gutterLg: string; tap: string };
  shape: { radius: { none: string; sm: string; sticker: string }; rule: { hairline: string; strong: string }; measure: string; /** L1 · chart kit weights (multiple of today's; grid in px). */ chart: { scale: number; grid: number } };
  motion: { duration: { tap: string; move: string; wipe: string; arrive: string; draw: string; stagger: string }; ease: { settle: string; ooze: string; cut: string }; reduced: string };
};

/** The design system of a theme: every named value, Read and Data side by side. */
/** `values`: the living settings (L1); the live site passes nothing and gets LIVE_VALUES, the edition gate passes a proposal. */
export function systemOf(theme: Theme, values: LivingValues = LIVE_VALUES): SystemTokens {
  const flat = Object.fromEntries(SYSTEM_VIEWS.map(v => [v, flatten(theme, VIEW_MODE[v])])) as Record<SystemView, Record<string, string>>;
  const color = Object.fromEntries(COLOR_ROLES.map(r => { const s = COLOR_SOURCE[r]; return [r, { what: s.what, read: flat.read[s.read]!, data: flat.data[s.data]!, cover: flat.cover[s.cover]! }]; })) as SystemTokens["color"];
  // The accent role is the accent rotation setting: one colour of the brand palette, the same in Read and Data (cover keeps its page).
  color.accent = { ...color.accent, read: PALETTE[values.accent], data: PALETTE[values.accent] };
  const cw = chartWeights(values.chart);
  const typeOf = (step: TypeStep, view: SystemView): TypeValue => {
    const t = theme.modes[VIEW_MODE[view]].type[STEP_ROLE[step]];
    const base: TypeValue = { family: t.family, weight: t.weight, size: t.size, sizeMd: t.sizeMd, sizeXl: t.sizeXl, leading: t.leading, leadingMd: t.leadingMd, tracking: t.tracking, case: t.case };
    return { ...base, ...(STEP_OVERRIDE[step]?.[view] ?? {}) };
  };
  const type = Object.fromEntries(TYPE_STEPS.map(s => [s, { role: STEP_ROLE[s], read: typeOf(s, "read"), data: typeOf(s, "data"), cover: typeOf(s, "cover") }])) as SystemTokens["type"];
  const sh = theme.shared, m = sh.motion;
  return {
    theme: theme.name, color, type,
    font: { display: flat.read["--tk-font-display"]!, text: flat.read["--tk-font-text"]!, mono: flat.read["--tk-font-mono"]! },
    space: { scale: sh.space, section: sectionGap(values.density), gutter: sh.layout.gutter, gutterLg: sh.layout.gutterLg, tap: sh.layout.tap },
    shape: { radius: { none: sh.radius.none, sm: sh.radius.sm, sticker: sh.radius.sticker }, rule: { hairline: sh.border.hairline, strong: sh.border.strong }, measure: READING_MEASURE, chart: { scale: cw.scale, grid: cw.grid } },
    motion: { duration: { tap: m.tap, move: m.move, wipe: m.wipe, arrive: m.arrive, draw: m.draw, stagger: m.stagger }, ease: { settle: m.settle, ooze: m.ooze, cut: m.cut },
      reduced: "With reduced motion every duration is 0 ms: nothing slides, fades or draws; state changes still show." },
  };
}

// CSS ------------------------------------------------------------------------------------------------------------------------
/** The custom property for a colour role, a type step's part, a space step, and so on: the names components use. */
export const sysColor = (r: ColorRole) => `--sys-color-${r}`;
export const sysText = (s: TypeStep, part: "size" | "leading" | "weight" | "tracking" | "family" | "case") => `--sys-text-${s}-${part}`;
export const sysVar = (name: string) => `var(${name})`;
const FONT_VAR = { display: "var(--sys-font-display)", text: "var(--sys-font-text)", mono: "var(--sys-font-mono)" } as const;

/** Every `--sys-*` property for one view at the base width (shared values repeat per view so a subtree with its own data-mode gets them). */
export function systemVars(sys: SystemTokens, view: SystemView): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of COLOR_ROLES) out[sysColor(r)] = sys.color[r][view];
  for (const s of TYPE_STEPS) {
    const t = sys.type[s][view];
    out[sysText(s, "family")] = FONT_VAR[t.family]; out[sysText(s, "weight")] = t.weight; out[sysText(s, "size")] = t.size;
    out[sysText(s, "leading")] = t.leading; out[sysText(s, "tracking")] = t.tracking; out[sysText(s, "case")] = t.case;
  }
  out["--sys-font-display"] = sys.font.display; out["--sys-font-text"] = sys.font.text; out["--sys-font-mono"] = sys.font.mono;
  for (const [k, v] of Object.entries(sys.space.scale)) out[`--sys-space-${k}`] = v;
  out["--sys-gap-section"] = sys.space.section.base; out["--sys-gutter"] = sys.space.gutter; out["--sys-tap"] = sys.space.tap;
  out["--sys-radius"] = sys.shape.radius.sm; out["--sys-radius-round"] = sys.shape.radius.sticker;
  out["--sys-rule-hairline"] = sys.shape.rule.hairline; out["--sys-rule-strong"] = sys.shape.rule.strong; out["--sys-measure"] = sys.shape.measure; out["--sys-chart-grid"] = String(sys.shape.chart.grid);
  for (const [k, v] of Object.entries(sys.motion.duration)) out[`--sys-motion-${k}`] = v;
  for (const [k, v] of Object.entries(sys.motion.ease)) out[`--sys-ease-${k}`] = v;
  return out;
}
/** Properties that change at a breakpoint for one view (type steps at md 768 px and xl 1440 px; section gap and gutter at 1024 px). */
export function systemSteps(sys: SystemTokens, view: SystemView, bp: "md" | "lg" | "xl"): Record<string, string> {
  const out: Record<string, string> = {};
  if (bp === "lg") { out["--sys-gap-section"] = sys.space.section.lg; out["--sys-gutter"] = sys.space.gutterLg; return out; }
  for (const s of TYPE_STEPS) {
    const t = sys.type[s][view];
    if (bp === "md" && t.sizeMd) out[sysText(s, "size")] = t.sizeMd;
    if (bp === "md" && t.leadingMd) out[sysText(s, "leading")] = t.leadingMd;
    if (bp === "xl" && t.sizeXl) out[sysText(s, "size")] = t.sizeXl;
  }
  return out;
}
export const SYSTEM_BREAKPOINTS = { md: "768px", lg: "1024px", xl: "1440px" } as const;
const selOf = (v: SystemView) => (v === "data" ? `:root,[data-mode="dark"]` : `[data-mode="${VIEW_MODE[v]}"]`);
const block = (sel: string, vars: Record<string, string>) => (Object.keys(vars).length ? `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}` : "");
/** The system as one stylesheet: Data first (the default), then Read and cover, then the breakpoint steps, then the one reduced-motion rule. */
export function systemCss(sys: SystemTokens): string {
  const order: SystemView[] = ["data", "read", "cover"];
  const base = order.map(v => block(selOf(v), systemVars(sys, v)));
  const bps = (["md", "lg", "xl"] as const).map(bp => `@media (min-width:${SYSTEM_BREAKPOINTS[bp]}){${order.map(v => block(selOf(v), systemSteps(sys, v, bp))).join("")}}`);
  const reduced = `@media (prefers-reduced-motion:reduce){:root,[data-mode]{${Object.keys(sys.motion.duration).map(k => `--sys-motion-${k}:0ms`).join(";")}}}`;
  return [...base, ...bps, reduced].join("\n");
}
/** Read the `--sys-*` properties back out of a stylesheet (tests and the system page's diff). */
export function parseSystemCss(css: string): { base: Record<string, Record<string, string>>; media: Record<string, Record<string, Record<string, string>>> } {
  const base: Record<string, Record<string, string>> = {}, media: Record<string, Record<string, Record<string, string>>> = {};
  const blocks = (s: string, into: Record<string, Record<string, string>>) => { for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) { const o: Record<string, string> = (into[m[1]!.trim()] ??= {}); for (const d of m[2]!.split(";")) { const i = d.indexOf(":"); if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim(); } } };
  for (const line of css.split("\n")) {
    const mm = /^@media \(([^)]+)\)\{(.*)\}$/.exec(line);
    if (mm) blocks(mm[2]!, (media[mm[1]!] ??= {})); else blocks(line, base);
  }
  return { base, media };
}
