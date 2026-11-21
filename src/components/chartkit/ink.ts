// THE CHART KIT (U3) · the inks every kit chart draws with: design-system roles only (they resolve per view, Read or Data).
// Highlighting (README "Colour"): pink belongs to the lead plate only, so a highlighted mark stays ink with the yellow highlighter
// laid behind it, and rising values are drawn green.
import { COLORS } from "@/lib/chart/card";

export const INK = "var(--sys-color-ink)", MUTED = "var(--sys-color-ink-muted)", RULE = "var(--sys-color-rule)", PAGE = "var(--sys-color-page)";
export const HL = "var(--sys-color-highlight)", POS = "var(--sys-color-positive)";
export const hlText = { background: HL, color: INK } as const;
export const hlSvgText = { fill: INK, stroke: HL, strokeWidth: 8, paintOrder: "stroke", strokeLinejoin: "round" } as const;
export const hlMark = { stroke: HL, strokeWidth: 6, paintOrder: "stroke" } as const;
/** Fades between view states; none with reduced motion. */
export const fade = "transition-opacity duration-300 motion-reduce:transition-none";
export const FIGURE_SOURCE = "Stored captures of tracked brands and archive history";
/** The chart-card drawing (lib/chart/card.ts) on a web page: each of its inks as the design-system role with the same Read value, so
 *  the figure follows the system instead of naming hexes (images and share cards keep their own palette). */
export const ROLE_PALETTE: Record<string, string> = { [COLORS.bg]: PAGE, [COLORS.rule]: RULE, [COLORS.g500]: MUTED, [COLORS.muted]: INK, [COLORS.ink]: INK, [COLORS.signal]: "var(--sys-color-measured)" };
