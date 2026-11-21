// Writes a theme as CSS variables. Default (no attribute) is dark, like the html/body base today; every route sets data-mode.
// A subtree can switch mode with its own data-mode attribute (the kit, and terminal overlays shown on Read pages).
import { MODES, TYPE_ROLES, flatten, type Mode, type Theme } from "./contract";
import { systemCss, systemOf } from "./system";

const block = (sel: string, vars: Record<string, string>) => `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
const steps = (theme: Theme, mode: Mode, bp: "md" | "xl") => {
  const out: Record<string, string> = {};
  for (const [role, t] of Object.entries(theme.modes[mode].type)) {
    if (bp === "md" && t.sizeMd) out[`--tk-type-${role}-size`] = t.sizeMd;
    if (bp === "md" && t.leadingMd) out[`--tk-type-${role}-leading`] = t.leadingMd;
    if (bp === "xl" && t.sizeXl) out[`--tk-type-${role}-size`] = t.sizeXl;
  }
  return out;
};
export const BREAKPOINTS = { md: "768px", xl: "1440px" } as const;
const sel = (m: Mode) => (m === "dark" ? `:root,[data-mode="dark"]` : `[data-mode="${m}"]`);
/** The full token stylesheet for one theme, plus one `.tk-t-<role>` class per type role (used by the kit and new components). Order matters: dark (default) first, then the other modes, then breakpoint steps. */
export function themeCss(theme: Theme): string {
  const order: Mode[] = ["dark", ...MODES.filter(m => m !== "dark")];
  const base = order.map(m => block(sel(m), flatten(theme, m)));
  const bps = (["md", "xl"] as const).map(bp => `@media (min-width:${BREAKPOINTS[bp]}){${order.map(m => { const v = steps(theme, m, bp); return Object.keys(v).length ? block(sel(m), v) : ""; }).join("")}}`);
  const roles = TYPE_ROLES.map(r => `.tk-t-${r}{font-family:var(--tk-type-${r}-family);font-weight:var(--tk-type-${r}-weight);font-size:var(--tk-type-${r}-size);line-height:var(--tk-type-${r}-leading);letter-spacing:var(--tk-type-${r}-tracking);text-transform:var(--tk-type-${r}-case);font-style:var(--tk-type-${r}-style);font-variation-settings:"opsz" var(--tk-type-${r}-opsz);font-variant-numeric:var(--tk-type-${r}-numeric);text-wrap:var(--tk-type-${r}-wrap)}`).join("");
  const square = theme.shared.square ? `*{border-radius:0!important;box-shadow:none!important}` : "";
  // U3: the design system's named values (--sys-*) are written from the same theme, after the tokens they name.
  return [...base, ...bps, roles, square, systemCss(systemOf(theme))].join("\n");
}
