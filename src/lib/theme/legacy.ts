// The "legacy" theme: today's look, value for value. light = the Read pages (editorial paper), dark = the terminal,
// vibes = light until a brand direction is chosen. Changing a value here changes the product; keep it exact.
import type { ModeTokens, Shared, Theme, TypeRole } from "./contract";

const MONO = `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
const r = (family: TypeRole["family"], weight: string, size: string, leading: string, o: Partial<TypeRole> = {}): TypeRole =>
  ({ family, weight, size, leading, tracking: "normal", case: "none", style: "normal", opsz: "normal", numeric: "normal", wrap: "auto", ...o });
/** Additions the contract gained with the slug brand (Phase 17b); legacy fills them so its look stays exactly as it was. */
const flat = (c: string) => ({ light: c, base: c, dark: c });
const extras = (page: string, ink: string, hairline: string, stage: string) => ({
  onStage: { emerging: page, rising: page, peaking: page, fading: page, steady: page, unstaged: page },
  plate: { bg: page, fg: ink }, slab: { bg: page, fg: ink }, highlight: { bg: SIGNAL, fg: "#000000" }, positive: SIGNAL, live: SIGNAL, shadowInk: ink, markGround: page,
  chart: { axis: ink, grid: hairline, outline: "transparent", inner: "transparent" },
  gumball: { pink: flat(SIGNAL), green: flat(SIGNAL), yellow: flat(SIGNAL), red: flat(SIGNAL), ink: flat(stage), newsprint: flat(stage) },
});

const SIGNAL = "#ff4f00";
const shared: Shared = {
  fonts: {
    mono: MONO,
    display: `"Bodoni Moda", "Didot", "Bodoni 72", Georgia, serif`,
    text: `"Newsreader", Georgia, "Times New Roman", serif`,
    base: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;600&display=swap",
    editorial: "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&family=Geist+Mono:wght@400;600&display=swap",
    preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
  },
  root: { size: "13px", leading: "20px" },
  radius: { none: "0px", sm: "0px", md: "0px", pill: "0px", sticker: "0px", icon: "0px" },
  border: { hairline: "1px", strong: "2px" },
  shadow: { flat: "none", raised: "none", pressed: "none", sticker: "none" },
  space: { 1: "4px", 2: "8px", 3: "16px", 4: "24px", 5: "40px", 6: "64px", 7: "104px" },
  layout: { wrap: "1360px", gutter: "20px", gutterLg: "40px", gridGap: "24px", gridGapLg: "32px", measure: "66ch", tap: "44px" },
  motion: { fast: "150ms", base: "300ms", slow: "2s", ease: "cubic-bezier(0.2, 0.8, 0.2, 1)", tick: "1.6s", tickEase: "ease-in-out",
    tap: "150ms", move: "300ms", wipe: "300ms", arrive: "300ms", draw: "2s", stagger: "0ms", ooze: "cubic-bezier(0.2, 0.8, 0.2, 1)", cut: "cubic-bezier(0.2, 0.8, 0.2, 1)", settle: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  density: { quiet: { block: "64px", inner: "24px", air: "64px" }, steady: { block: "40px", inner: "16px", air: "24px" }, loud: { block: "8px", inner: "8px", air: "8px" } },
  square: true,
  print: { paper: "#fff", ink: "#000", muted: "#444" },
  image: {
    dark: { bg: "#000000", ink: "#ededed", muted: "#6b6b6b", secondary: "#9a9a9a", rule: "#262626", accent: "#ff4f00" },
    light: { bg: "#ffffff", ink: "#111111", muted: "#5c5c5c", secondary: "#6b6b6b", rule: "#d6d6d6", accent: "#ff4f00" },
    // Legacy had no vibes mode: its images keep the black card.
    vibes: { bg: "#000000", ink: "#ededed", muted: "#6b6b6b", secondary: "#9a9a9a", rule: "#262626", accent: "#ff4f00", card: "#000000", plate: "#000000", plateInk: "#ededed", edge: "#262626", ball: { light: "#ff4f00", base: "#ff4f00", dark: "#ff4f00" } },
  },
};

const dark: ModeTokens = {
  surface: { page: "#000000", card: "#0e0e0e", raised: "#161616", sunken: "#0e0e0e", inverse: "#f2f2f2" },
  text: { primary: "#ededed", secondary: "#9a9a9a", muted: "#6b6b6b", inverse: "#000000", onAccent: "#000000", emphasis: "#ffffff" },
  rule: { strong: "#ededed", hairline: "#262626" },
  accent: { 1: SIGNAL, 2: SIGNAL, 3: SIGNAL, 4: SIGNAL },
  onAccent: { 1: "#000000", 2: "#000000", 3: "#000000", 4: "#000000" },
  stage: { emerging: "#ededed", rising: "#ededed", peaking: "#ededed", fading: "#ededed", steady: "#ededed", unstaged: "#6b6b6b" },
  mark: { measured: "#6b6b6b", ai: "#6b6b6b", live: SIGNAL },
  focus: { ring: "#ededed", width: "1px", offset: "-1px", halo: "transparent" },
  ...extras("#000000", "#ededed", "#262626", "#ededed"),
  selection: { bg: SIGNAL, text: "#000000" },
  scrollbar: { track: "#000000", thumb: "#262626" },
  type: {
    wordmark: r("mono", "600", "13px", "16px", { case: "lowercase" }),
    mast: r("mono", "400", "20px", "24px"),
    display: r("mono", "400", "48px", "48px"),
    h1: r("mono", "400", "20px", "24px"),
    h2: r("mono", "400", "20px", "24px"),
    h3: r("mono", "400", "16px", "20px"),
    h4: r("mono", "600", "13px", "20px"),
    kicker: r("mono", "400", "11px", "16px", { tracking: "0.08em", case: "uppercase" }),
    deck: r("mono", "400", "13px", "20px"),
    "body-lg": r("mono", "400", "16px", "20px"),
    body: r("mono", "400", "13px", "20px"),
    small: r("mono", "400", "11px", "16px"),
    caption: r("mono", "400", "11px", "16px"),
    quote: r("mono", "400", "13px", "20px"),
    figure: r("mono", "400", "20px", "24px"),
    stat: r("mono", "400", "20px", "24px"),
    data: r("mono", "400", "13px", "20px"),
    chip: r("mono", "400", "11px", "14px", { tracking: "0.08em", case: "uppercase" }),
    specimen: r("display", "400", "clamp(36px, 7vw, 72px)", "1.05"),
  },
};

const light: ModeTokens = {
  surface: { page: "#ffffff", card: "#ffffff", raised: "#ffffff", sunken: "#ffffff", inverse: "#0b0b0b" },
  text: { primary: "#0b0b0b", secondary: "#595959", muted: "#595959", inverse: "#ffffff", onAccent: "#000000", emphasis: "#000000" },
  rule: { strong: "#0b0b0b", hairline: "#d4d4d4" },
  accent: { 1: SIGNAL, 2: SIGNAL, 3: SIGNAL, 4: SIGNAL },
  onAccent: { 1: "#000000", 2: "#000000", 3: "#000000", 4: "#000000" },
  // Editorial chips take the surrounding text colour (their outline stays ink): currentColor reproduces that exactly.
  stage: { emerging: "currentColor", rising: "currentColor", peaking: "currentColor", fading: "currentColor", steady: "currentColor", unstaged: "#595959" },
  mark: { measured: "currentColor", ai: "currentColor", live: SIGNAL },
  focus: { ring: "#0b0b0b", width: "2px", offset: "2px", halo: "transparent" },
  ...extras("#ffffff", "#0b0b0b", "#d4d4d4", "currentColor"),
  selection: { bg: SIGNAL, text: "#000000" },
  // Legacy quirk kept exactly: the Read pages inherited the terminal's dark scrollbar.
  scrollbar: { track: "#000000", thumb: "#262626" },
  type: {
    wordmark: r("display", "500", "20px", "1", { tracking: "-0.01em", case: "lowercase" }),
    mast: r("display", "400", "56px", ".9", { sizeMd: "88px", sizeXl: "120px", tracking: "-.02em", style: "italic" }),
    display: r("display", "500", "52px", "1.02", { sizeMd: "72px", sizeXl: "92px", tracking: "-.015em", opsz: "48" }),
    h1: r("display", "500", "44px", "1.05", { sizeMd: "60px", tracking: "-.01em", opsz: "48" }),
    h2: r("display", "500", "36px", "1.1", { sizeMd: "44px", opsz: "20" }),
    h3: r("display", "500", "28px", "1.15", { sizeMd: "30px", opsz: "20" }),
    h4: r("display", "500", "22px", "1.2", { sizeMd: "25px", opsz: "20" }),
    kicker: r("mono", "600", "11px", "16px", { tracking: ".08em", case: "uppercase" }),
    deck: r("text", "300", "22px", "1.4", { sizeMd: "25px" }),
    "body-lg": r("text", "400", "22px", "1.4", { sizeMd: "25px" }),
    body: r("text", "400", "18px", "1.6", { sizeMd: "19px" }),
    small: r("text", "400", "15px", "1.5"),
    caption: r("mono", "400", "11px", "16px"),
    quote: r("display", "400", "28px", "1.25", { sizeMd: "30px", style: "italic", opsz: "20" }),
    figure: r("mono", "400", "32px", "40px"),
    stat: r("mono", "400", "32px", "40px", { sizeMd: "44px", leadingMd: "48px" }),
    data: r("mono", "400", "13px", "20px"),
    chip: r("mono", "400", "11px", "14px", { tracking: ".06em", case: "uppercase" }),
    specimen: r("display", "400", "clamp(36px, 7vw, 72px)", "1.05"),
  },
};

export const legacy: Theme = { name: "legacy", label: "Legacy (the look before the slug brand)", shared, modes: { light, dark, vibes: light } };
