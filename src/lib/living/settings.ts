// L1 · THE LIVING DESIGN: the settings register. The short list of design settings that may move, one small step per monthly edition,
// each bound to the design tokens it controls. A setting's value is defined here once; the theme (slug.ts), the design system
// (system.ts), the chart kit, the cover rule and the illustration rule read it. Baselines are today's values, read from the brand
// kit where the kit gives them. Ranges are PROPOSED until the owner confirms them. Pure; imports only the brand kit and pure modules.
import { slugBrand as K } from "../../../brand/tokens/slug.theme";
import { STYLES } from "../illustration";

export const SETTING_IDS = ["radius", "tracking", "density", "motion", "accent", "chart", "covers", "motifs"] as const;
export type SettingId = (typeof SETTING_IDS)[number];
/** The brand palette the accent may take (brand/tokens: the kit's named colours). Never a colour outside it. */
export const PALETTE = { pink: K.color.pink, green: K.color.green, yellow: K.color.yellow, red: K.color.red } as const;
export type PaletteName = keyof typeof PALETTE;
export const isPaletteName = (s: unknown): s is PaletteName => typeof s === "string" && Object.prototype.hasOwnProperty.call(PALETTE, s);
/** Cover layouts a Digest or study cover may take (lead-picture kinds); `COVER_DRAWABLE` are the ones the code can draw for them today. */
export const COVER_LAYOUTS = ["card", "chart", "mosaic", "swatches"] as const;
export const COVER_DRAWABLE: readonly string[] = ["card", "chart"];

export type LivingValues = { radius: number; tracking: number; density: number; motion: number; accent: PaletteName; chart: number; covers: readonly string[]; motifs: readonly string[] };
export type Value = LivingValues[SettingId];

type Base = { id: SettingId; name: string; what: string; tokens: readonly string[]; driver: "signal" | "hand"; range: "proposed" | "confirmed"; why: string };
export type NumberSetting = Base & { kind: "number"; unit: string; floor: number; ceiling: number; step: number };
export type ChoiceSetting = Base & { kind: "choice"; unit: string; allowed: readonly string[]; step: 1 };
export type SetSetting = Base & { kind: "set"; unit: string; floor: readonly string[]; ceiling: readonly string[]; step: number };
export type Setting = NumberSetting | ChoiceSetting | SetSetting;

const msOf = (s: string) => Number.parseFloat(s);
/** Today's values: Edition 0, the baseline. Read from the kit where it gives them; the rest are today's code values, moved here. */
export const BASELINE: LivingValues = {
  radius: K.shape.radius,
  tracking: Number(K.type.display.tracking) || 0,
  // The gap between a page's sections from 1024 px, in rem on the 13 px root (phones use three quarters of it): today 4rem and 3rem.
  density: 4,
  motion: msOf(K.motion.move),
  // The accent role is the pink in both views (Read accent 1, Data accent 3).
  accent: "pink",
  // Chart kit line weight, point size and grid weight, as a multiple of today's.
  chart: 1,
  covers: ["card", "chart"],
  motifs: [...STYLES],
};

/** The register. Every range is "proposed" until the owner confirms it. */
export const SETTINGS: Record<SettingId, Setting> = {
  radius: { id: "radius", kind: "number", name: "Corner radius", what: "The corners of buttons, cards and inputs.", unit: "px", floor: 0, ceiling: 4, step: 2,
    tokens: ["--tk-radius-sm", "--tk-radius-md", "--tk-radius-pill", "--sys-radius"], driver: "signal", range: "proposed",
    why: "The brand is square print corners; 4 px at most is still a sharp corner, reached in two editions." },
  tracking: { id: "tracking", kind: "number", name: "Heading tracking", what: "The letter-spacing of the display and heading type steps, in both views.", unit: "em", floor: -0.02, ceiling: 0.01, step: 0.005,
    tokens: ["--tk-type-display-tracking", "--tk-type-h1-tracking", "--tk-type-h2-tracking", "--tk-type-h3-tracking", "--sys-text-display-tracking", "--sys-text-h1-tracking", "--sys-text-h2-tracking", "--sys-text-h3-tracking"],
    driver: "signal", range: "proposed", why: "Half a pixel per letter on a 96 px headline per step; the whole range is under 3 px per letter at the largest size." },
  density: { id: "density", kind: "number", name: "Spacing density", what: "The gap between a page's sections (from 1024 px; phones use three quarters of it).", unit: "rem", floor: 3.5, ceiling: 4.5, step: 0.25,
    tokens: ["--sys-gap-section"], driver: "signal", range: "proposed", why: "About 3 px per step at 1024 px and up; the range is today's gap plus or minus one eighth." },
  motion: { id: "motion", kind: "number", name: "Motion timing", what: "The Move duration; Tap, Wipe, Arrive, Draw and Stagger keep their proportion to it.", unit: "ms", floor: 200, ceiling: 280, step: 20,
    tokens: ["--tk-motion-tap", "--tk-motion-move", "--tk-motion-wipe", "--tk-motion-arrive", "--tk-motion-draw", "--tk-motion-stagger", "--tk-motion-fast", "--tk-motion-base", "--tk-motion-slow", "--sys-motion-*"],
    driver: "hand", range: "proposed", why: "A 20 ms step is below what most readers notice; reduced motion still sets every duration to 0 ms." },
  accent: { id: "accent", kind: "choice", name: "Accent rotation", what: "Which colour of the brand palette is the accent role (the headline block and the lead plate).", unit: "palette colour", allowed: ["pink"], step: 1,
    tokens: ["--sys-color-accent"], driver: "hand", range: "proposed",
    why: "Green, yellow and red each already do a job (rising, the highlighter, live); giving the accent one of them would make two jobs share a colour, so only pink is proposed." },
  chart: { id: "chart", kind: "number", name: "Chart styling", what: "Line weight, point size and grid weight in the chart kit, as a multiple of today's.", unit: "× today", floor: 0.75, ceiling: 1.25, step: 0.125,
    tokens: ["chartkit CHART.line", "chartkit CHART.point", "--sys-chart-grid"], driver: "hand", range: "proposed", why: "A 1.5 px line moves by under 0.2 px per step." },
  covers: { id: "covers", kind: "set", name: "Cover treatments", what: "The cover layouts the Digest and studies may use.", unit: "layouts", floor: ["chart"], ceiling: [...COVER_LAYOUTS], step: 1,
    tokens: ["leadPicture digest and study covers"], driver: "hand", range: "proposed", why: "One layout added or removed per edition; the chart stays, because it is every cover's fallback." },
  motifs: { id: "motifs", kind: "set", name: "Illustration motifs", what: "The illustration styles the graphics may use.", unit: "styles", floor: [...STYLES], ceiling: [...STYLES], step: 1,
    tokens: ["illustration STYLES", "compositions"], driver: "hand", range: "proposed",
    why: "Each of the three styles is used by a page today (the front page, stories, the Digest), so none can be removed without changing a page; a new style would be brand direction." },
};

/** What never moves without the owner. An edition that names any of these is refused. */
export const NEVER_MOVES = [
  { id: "name", what: "The name, slug, always lowercase" },
  { id: "wordmark", what: "The wordmark, always black" },
  { id: "direction", what: "The brand direction, P · Extra Fine" },
  { id: "families", what: "The type families: Big Shoulders, Newsreader and IBM Plex Mono" },
  { id: "navigation", what: "The navigation and its seven sections" },
  { id: "structures", what: "The page structures" },
] as const;
export type NeverMoveId = (typeof NEVER_MOVES)[number]["id"];
export const isSettingId = (s: unknown): s is SettingId => typeof s === "string" && (SETTING_IDS as readonly string[]).includes(s);

// RANGE AND STEP ---------------------------------------------------------------------------------------------------------------
const EPS = 1e-9;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x));
/** Whether a value is inside its setting's floor and ceiling (or allowed list). */
export function inRange(id: SettingId, v: Value): boolean {
  const s = SETTINGS[id];
  if (s.kind === "number") return typeof v === "number" && Number.isFinite(v) && v >= s.floor - EPS && v <= s.ceiling + EPS && Math.abs(Math.round((v - s.floor) / s.step) * s.step + s.floor - v) < 1e-6;
  if (s.kind === "choice") return typeof v === "string" && s.allowed.includes(v);
  return Array.isArray(v) && new Set(v).size === v.length && s.floor.every(x => v.includes(x)) && v.every(x => s.ceiling.includes(x));
}
/** How many steps lie between two values of a setting. */
export function stepsBetween(id: SettingId, a: Value, b: Value): number {
  const s = SETTINGS[id];
  if (s.kind === "number") return Math.round(Math.abs((b as number) - (a as number)) / s.step * 1e6) / 1e6;
  if (s.kind === "choice") return a === b ? 0 : 1;
  const x = a as readonly string[], y = b as readonly string[];
  return (x.filter(i => !y.includes(i)).length + y.filter(i => !x.includes(i)).length) / s.step;
}
export const sameValue = (id: SettingId, a: Value, b: Value) => (SETTINGS[id].kind === "set" ? sameSet(a as readonly string[], b as readonly string[]) : stepsBetween(id, a, b) === 0);
/** One step up or down for a number setting (never past the floor or ceiling): null when it would leave the range. */
export function stepped(id: SettingId, v: number, dir: 1 | -1): number | null {
  const s = SETTINGS[id]; if (s.kind !== "number") return null;
  const n = Math.round((v + dir * s.step) * 1e6) / 1e6;
  return n < s.floor - EPS || n > s.ceiling + EPS ? null : n;
}

// VALUE TEXT ---------------------------------------------------------------------------------------------------------------------
const trim = (n: number) => String(Math.round(n * 1e6) / 1e6);
/** A value as a reader reads it: "0 px", "−0.005 em", "4 rem", "240 ms", "Pink", "× 1", "card, chart". */
export function valueText(id: SettingId, v: Value): string {
  const s = SETTINGS[id];
  if (s.kind === "number") return s.unit === "× today" ? `${trim(v as number)} × today's weights` : `${(v as number) < 0 ? "−" : ""}${trim(Math.abs(v as number))} ${s.unit}`;
  if (s.kind === "choice") return String(v).charAt(0).toUpperCase() + String(v).slice(1);
  return (v as readonly string[]).map(itemName).join(", ") || "none";
}
/** Plain names for the items of the set settings (covers and motifs), so the Read side never shows a code word. */
export const ITEM_NAMES: Readonly<Record<string, string>> = {
  card: "the social card", chart: "a chart", mosaic: "a mosaic of first screens", swatches: "colour swatches",
  cut: "cut paper", trail: "the trail", soft: "soft objects",
};
export const itemName = (x: string) => ITEM_NAMES[x] ?? x;

// TOKEN VALUES (what the theme writes for a set of values) ------------------------------------------------------------------------
/** Letter-spacing as CSS: "0" when zero (as the kit writes it), otherwise em. */
export const trackingCss = (v: number) => (Math.abs(v) < EPS ? "0" : `${trim(v)}em`);
export const radiusCss = (v: number) => `${trim(v)}px`;
/** Section gaps: from 1024 px, and three quarters of it on phones. */
export const sectionGap = (v: number) => ({ base: `${trim(v * 0.75)}rem`, lg: `${trim(v)}rem` }) as const;
/** A kit duration scaled to the Move value (the kit's Move is 240 ms). */
export const durationCss = (kit: string, move: number) => `${Math.round(msOf(kit) * move / msOf(K.motion.move))}ms`;
/** The chart kit's weights for a scale: a line of n px draws at n × scale; the grid is 1.5 px × scale. */
export const chartWeights = (scale: number) => ({ scale, line: (n: number) => n * scale, point: (n: number) => n * scale, grid: 1.5 * scale });
