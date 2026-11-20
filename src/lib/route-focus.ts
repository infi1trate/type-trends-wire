// Where keyboard focus goes after a client-side route change. Pure; route-focus.test.ts covers the decision.
// A new page moves focus to its h1 so screen readers announce the page; a change of search or hash alone
// (filters, the stepper, in-page anchors) keeps focus where the reader is.
export type Loc = { pathname: string; hash?: string };
export const shouldMoveFocus = (from: Loc | undefined, to: Loc): boolean =>
  !!from && from.pathname !== to.pathname && !to.hash;
/** The page's heading first; the terminal's panel when the page has none. */
export const FOCUS_TARGETS = ["#ed-main h1", "main h1", "#tk-main"] as const;
/** P1: set when route focus landed on a heading inside a placeholder slot; the slot's content takes focus back when it lands. */
export const laterFocus = { pending: false };
