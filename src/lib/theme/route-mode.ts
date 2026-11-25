// The page's mode is set by its route: `staticData: { mode: "dark" }` on terminal-density routes; every other route is light.
// U1: an object route that declares `views: true` is dark while it shows its Data view (`?view=data` on the same address).
// The root shell writes it to <html data-mode>. Pure; route-mode.test.ts checks which route files declare dark.
import type { Mode } from "./contract";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption { mode?: Mode; views?: boolean }
}
export const DEFAULT_MODE: Mode = "light";
type MatchLike = { staticData?: { mode?: Mode; views?: boolean } | undefined; search?: unknown };
/** True when a match is an object route showing its Data view. */
export const isDataMatch = (x: MatchLike) => !!x.staticData?.views && !!x.search && typeof x.search === "object" && (x.search as Record<string, unknown>)["view"] === "data";
/** The deepest matched route that names a mode (or shows its Data view) wins; otherwise light. */
export const modeOf = (matches: readonly MatchLike[]): Mode =>
  matches.reduce<Mode>((m, x) => x.staticData?.mode ?? (isDataMatch(x) ? "dark" : m), DEFAULT_MODE);
/** Terminal-density route files (dark mode): the terminal, the chart of the week and the studio board. */
export const DARK_ROUTE_FILES = ["terminal.tsx", "chart.index.tsx", "chart.$week.tsx", "ambient.index.tsx"] as const;
/** Object routes with a Data view at the same address (U1). */
export const VIEW_ROUTE_FILES = ["stories.$id.tsx", "brands.$domain.tsx", "signals.$key.tsx", "patterns.$key.tsx", "patterns.navigation.tsx", "data.$slug.tsx", "digest.$week.tsx"] as const;
