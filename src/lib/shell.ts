// The Read shell's rows, pure: what sits in the one top bar at each width, what moves into the Menu sheet, and which lines run
// under the bar. The component (components/read/ReadShell.tsx) renders from these, and shell.test.ts pins the row counts per width,
// so the chrome above the content cannot grow back.

/** Tailwind's breakpoints, in CSS px (md, lg, xl). */
export const BREAK = { md: 768, lg: 1024, xl: 1280 } as const;
export type Break = keyof typeof BREAK;
export const BAR_ITEMS = ["sections", "switch", "glossary", "lock"] as const;
export type BarItem = (typeof BAR_ITEMS)[number];
/** Each item sits in the bar from this breakpoint up, and in the Menu sheet below it. */
export const INLINE_FROM: Record<BarItem, Break> = { switch: "md", sections: "lg", glossary: "xl", lock: "xl" };
/** The Menu button shows while anything is in the sheet. */
export const MENU_UNTIL: Break = "xl";

export function barAt(width: number): { inline: BarItem[]; menu: BarItem[]; menuButton: boolean } {
  const inline = BAR_ITEMS.filter(i => width >= BREAK[INLINE_FROM[i]]), menu = BAR_ITEMS.filter(i => width < BREAK[INLINE_FROM[i]]);
  return { inline, menu, menuButton: menu.length > 0 };
}
/** The lens line: nothing when the lens is All sectors and there is no note (the select already says it). */
export function lensLine(o: { sector: string; sectorName: string; filtered: boolean; note: string | null }): string | null {
  const parts = [
    ...(o.sector !== "all" ? [`Showing: ${o.sectorName}${o.filtered ? "" : " · this page is not filtered by sector"}`] : []),
    ...(o.note ? [o.note] : []),
  ];
  return parts.length ? parts.join(" · ") : null;
}
export type ShellRow = "bar" | "sub";
/** Rows of chrome above every Read page's content: the slab bar, then one line (lens, freshness, sector select). Never more. */
export function shellRows(_width: number): ShellRow[] { return ["bar", "sub"]; }
export type FrontRow = "ticker" | "dateline" | "formats" | "dateline+formats";
/** The front page's rows above the lead: the ticker, then the date and state line and the format filter (one row from 768 up). */
export function frontRows(width: number): FrontRow[] { return width >= BREAK.md ? ["ticker", "dateline+formats"] : ["ticker", "dateline", "formats"]; }
/** Where the top of the lead plate must sit (CSS px from the top of the page) at the narrowest and widest checked widths. */
export const LEAD_TOP_MAX = { 360: 300, 1440: 260 } as const;
