// N2/N3 · daily model-call limits per desk (UTC day, like the writers). Dependency-free so health and the desk page read the same numbers.
// Each desk's limit counts its calls of the named purpose; the graphics desk has two (pictures and study charts).
export const DESK_CAPS = { standards: 12, "editor in chief": 6, news: 4, graphics: 8, data: 1 } as const;
export type CapDesk = keyof typeof DESK_CAPS;
/** Every limit with the purpose it counts and what one call is, in the order the meter and /desk list them. */
export const DESK_LIMITS = [
  { desk: "standards", purpose: "review", cap: DESK_CAPS.standards, what: "second reader" },
  { desk: "editor in chief", purpose: "placement", cap: DESK_CAPS["editor in chief"], what: "placement" },
  { desk: "news", purpose: "picks", cap: DESK_CAPS.news, what: "wire picks" },
  { desk: "graphics", purpose: "picture", cap: DESK_CAPS.graphics, what: "picture check" },
  { desk: "graphics", purpose: "chart", cap: 2, what: "study chart" },
  { desk: "data", purpose: "proposal", cap: DESK_CAPS.data, what: "weekly proposal" },
] as const;
export type DeskPurpose = (typeof DESK_LIMITS)[number]["purpose"];
export const capOf = (desk: string, purpose: string) => DESK_LIMITS.find(l => l.desk === desk && l.purpose === purpose)?.cap ?? 0;
