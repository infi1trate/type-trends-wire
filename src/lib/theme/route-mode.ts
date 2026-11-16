// The page's mode is set by its route: `staticData: { mode: "dark" }` on terminal-density routes; every other route is light.
// The root shell writes it to <html data-mode>. Pure; route-mode.test.ts checks which route files declare dark.
import type { Mode } from "./contract";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption { mode?: Mode }
}
export const DEFAULT_MODE: Mode = "light";
/** The deepest matched route that names a mode wins; otherwise light. */
export const modeOf = (matches: readonly { staticData?: { mode?: Mode } | undefined }[]): Mode =>
  matches.reduce<Mode>((m, x) => x.staticData?.mode ?? m, DEFAULT_MODE);
/** Terminal-density route files (dark mode): the terminal, the library record and the chart of the week. */
export const DARK_ROUTE_FILES = ["terminal.tsx", "library.$domain.tsx", "chart.index.tsx", "chart.$week.tsx", "ambient.index.tsx"] as const;
