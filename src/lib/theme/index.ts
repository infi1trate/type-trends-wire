// Theme registry and the active theme. Pages and components never import a theme file directly: they read CSS variables,
// and the few places that render outside the page (share images, embeds, the gate page) read `activeTheme`.
import type { Mode, Theme } from "./contract";
import { legacy } from "./legacy";
import { blank } from "./blank";
import { slug } from "./slug";
import { themeCss } from "./css";

export * from "./contract";
/** Themes pages may use. "legacy" (the look before the brand) is kept out on purpose: only before/after comparisons import it. */
export const THEMES: Readonly<Record<string, Theme>> = { slug, blank };
/** Unregistered themes kept for side-by-side comparison (the kit's before/after), never for a page. */
export const COMPARISON_THEMES: Readonly<Record<string, Theme>> = { legacy };
/** The look in use. Switching brand direction = registering a theme and changing this one name. */
export const ACTIVE_THEME = "slug";
export const activeTheme: Theme = THEMES[ACTIVE_THEME]!;
export const activeCss = () => themeCss(activeTheme);
/** Mode tokens for code that cannot read CSS variables (raster images, standalone HTML). */
export const tokensFor = (mode: Mode) => activeTheme.modes[mode];

/** <style> body for standalone SVGs (cards, share images): loads the base face and sets SVG text in it. */
export const svgTextStyle = () => `@import url('${activeTheme.shared.fonts.base.replace(/&/g, "&amp;")}');text{font-family:${svgMono()};white-space:pre}`;
/** The mono face for standalone SVGs: the theme's first mono family plus generic fallbacks (images can't rely on local system stacks). */
export const svgMono = (quote: "'" | '"' = "'") => `${activeTheme.shared.fonts.mono.split(",")[0]!.trim().replace(/["']/g, quote)},ui-monospace,monospace`;
/** The theme's one font stylesheet (both kinds are the same link in the slug theme; legacy split mono and editorial faces). */
export function fontLinks(kind: "base" | "editorial" = "editorial") {
  const f = activeTheme.shared.fonts;
  return [
    { rel: "preconnect", href: f.preconnect[0]! },
    { rel: "preconnect", href: f.preconnect[1]!, crossOrigin: "anonymous" as const },
    { rel: "stylesheet", href: kind === "base" ? f.base : f.editorial },
  ];
}
