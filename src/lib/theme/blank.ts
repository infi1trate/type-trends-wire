// A typed stub: the shape a new brand direction fills. It is registered so the token tests prove the contract is complete,
// but it is never the active theme and carries no look of its own. Leaving any token out fails type-checking.
// To add a real direction, copy legacy.ts instead (see README.md).
import type { ModeTokens, Theme, TypeRole } from "./contract";

const U = "unset";
const role: TypeRole = { family: "text", weight: U, size: U, leading: U, tracking: U, case: "none", style: "normal", opsz: U };
const mode: ModeTokens = {
  surface: { page: U, card: U, raised: U, sunken: U, inverse: U },
  text: { primary: U, secondary: U, muted: U, inverse: U, onAccent: U, emphasis: U },
  rule: { strong: U, hairline: U },
  accent: { 1: U, 2: U, 3: U, 4: U },
  onAccent: { 1: U, 2: U, 3: U, 4: U },
  stage: { emerging: U, rising: U, peaking: U, fading: U, steady: U, unstaged: U },
  mark: { measured: U, ai: U, live: U },
  focus: { ring: U, width: U, offset: U },
  selection: { bg: U, text: U },
  scrollbar: { track: U, thumb: U },
  type: { wordmark: role, mast: role, display: role, h1: role, h2: role, h3: role, h4: role, kicker: role, deck: role, "body-lg": role, body: role, small: role, caption: role, quote: role, figure: role, stat: role, data: role, chip: role, specimen: role },
};
const image = { bg: U, ink: U, muted: U, secondary: U, rule: U, accent: U };

export const blank: Theme = {
  name: "blank", label: "Blank (stub)",
  shared: {
    fonts: { mono: U, display: U, text: U, base: "", editorial: "", preconnect: [] },
    root: { size: U, leading: U },
    radius: { none: U, sm: U, md: U, pill: U },
    border: { hairline: U, strong: U },
    shadow: { flat: U, raised: U, pressed: U },
    space: { 1: U, 2: U, 3: U, 4: U, 5: U, 6: U, 7: U },
    layout: { wrap: U, gutter: U, gutterLg: U, gridGap: U, gridGapLg: U, measure: U, tap: U },
    motion: { fast: U, base: U, slow: U, ease: U, tick: U, tickEase: U },
    square: false,
    print: { paper: U, ink: U, muted: U },
    image: { dark: image, light: image },
  },
  modes: { light: mode, dark: mode, vibes: mode },
};
