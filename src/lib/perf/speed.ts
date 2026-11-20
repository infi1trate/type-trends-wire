// P1 · page speed targets and the last recorded first-byte times, shown on /status. Numbers come only from measurements:
// "before" is the owner's outside measurement of 20 Nov 2026; "after" is scripts/perf/ttfb.py against the preview server on
// 20 Nov 2026 (a development server, so it is a direction, not the live site). Re-run the script against the live site after
// publishing and replace AFTER.
export const SPEED_TARGETS = { firstMs: 800, repeatMs: 300, lcpMs: 2500, cls: 0.05 } as const;
export type SpeedRow = { page: string; path: string; before: { first: number; repeat: number } | null; after: { first: number; repeat: number } | null };
export const SPEED_AFTER_SOURCE = "preview server, 20 Nov 2026 (scripts/perf/ttfb.py)";
export const SPEED_ROWS: readonly SpeedRow[] = [
  { page: "Brand (gopro.com)", path: "/brands/gopro.com", before: { first: 8800, repeat: 700 }, after: { first: 928, repeat: 679 } },
  { page: "Brand (dropbox.com)", path: "/brands/dropbox.com", before: { first: 4600, repeat: 3600 }, after: { first: 789, repeat: 645 } },
  { page: "Study", path: "/data/who-went-big-first", before: { first: 3800, repeat: 2300 }, after: { first: 247, repeat: 132 } },
  { page: "Brands", path: "/brands", before: { first: 2200, repeat: 2000 }, after: { first: 371, repeat: 93 } },
  { page: "Patterns", path: "/patterns", before: { first: 2200, repeat: 300 }, after: { first: 240, repeat: 77 } },
  { page: "Digest issue", path: "/digest/2026-W46", before: { first: 1500, repeat: 1800 }, after: { first: 195, repeat: 81 } },
  { page: "Signal", path: "/signals/aesthetic:brutalist", before: { first: 1500, repeat: 1700 }, after: { first: 560, repeat: 491 } },
  { page: "Front", path: "/", before: { first: 1500, repeat: 300 }, after: { first: 1571, repeat: 102 } },
  { page: "Signals", path: "/signals", before: null, after: { first: 334, repeat: 334 } },
  { page: "Pattern", path: "/patterns/components:carousel", before: null, after: { first: 113, repeat: 123 } },
  { page: "Sector report", path: "/sectors/fintech", before: null, after: { first: 258, repeat: 286 } },
  { page: "Story", path: "/stories/move:3688", before: null, after: { first: 424, repeat: 515 } },
];
/** Whether a measured first byte meets its target. */
export const meets = (ms: number | undefined, target: number) => ms != null && ms <= target;
