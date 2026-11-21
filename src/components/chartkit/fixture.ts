// One fixture for every chart in the kit, in both looks (the system page and chartkit.test.tsx draw from it). Twelve quarters of one
// signal's share with a gap of more than four quarters (the dashed "spans several years" segment) and two thinly covered quarters.
import type { BeforeAfterFig, MultiplesFig, View } from "@/lib/data-stories/types";
import type { QuarterPoint } from "./QuarterLine";
import type { QuarterBar } from "./Bars";

export const FIXTURE_LABEL = "Serif headlines";
export const FIXTURE_QUARTERS: QuarterPoint[] = [
  { q: "2021Q1", s: 0.081, n: 40, c: 0.6 }, { q: "2022Q3", s: 0.094, n: 52, c: 0.7 }, { q: "2024Q4", s: 0.112, n: 80, c: 0.8 },
  { q: "2025Q1", s: 0.118, n: 90, c: 0.8 }, { q: "2025Q2", s: 0.121, n: 12, c: 0.2 }, { q: "2025Q3", s: 0.13, n: 120, c: 0.9 },
  { q: "2025Q4", s: 0.138, n: 140, c: 0.9 }, { q: "2026Q1", s: 0.146, n: 150, c: 0.9 }, { q: "2026Q2", s: 0.152, n: 155, c: 0.9 },
  { q: "2026Q3", s: 0.161, n: 160, c: 0.95 }, { q: "2026Q4", s: 0.125, n: 162, c: 0.95 },
];
export const fixtureCard = () => ({ series: FIXTURE_QUARTERS.map(p => ({ q: p.q, s: p.s ?? 0, n: p.n })), forecast: [] as { q: string; mid: number; lo: number; hi: number }[] });
export const fixtureBars = (): QuarterBar[] => FIXTURE_QUARTERS.slice(-6).map(p => ({ q: p.q, share: p.s, usable: p.n >= 15 && p.c >= 0.25 }));
export const fixtureValues = () => FIXTURE_QUARTERS.map(p => p.s ?? 0);
export const fixtureView = (figure: string): View => ({ figure, highlight: [] });
export const fixtureMultiples = (): MultiplesFig => ({
  kind: "multiples", title: "Serif headlines by sector", note: "Share of tracked homepages", unit: "share", chart: "line", xs: ["2026Q1", "2026Q2", "2026Q3", "2026Q4"], yMax: 0.3,
  panels: [
    { id: "fintech", label: "Fintech", href: "/signals/font:serif?sector=fintech", points: [{ x: "2026Q1", y: 0.1 }, { x: "2026Q2", y: 0.12 }, { x: "2026Q3", y: 0.15 }, { x: "2026Q4", y: 0.18 }] },
    { id: "ai", label: "AI", href: "/signals/font:serif?sector=ai", points: [{ x: "2026Q1", y: 0.2 }, { x: "2026Q2", y: 0.19 }, { x: "2026Q3", y: 0.17 }, { x: "2026Q4", y: 0.16 }] },
  ],
});
export const fixtureBeforeAfter = (): BeforeAfterFig => {
  const frame = (id: string, at: string, big: boolean) => ({ id, at, source: "live" as const, w: 1280, h: 800, bg: null, ink: null, accent: null, tones: [],
    boxes: [["h", 80, big ? 120 : 160, big ? 900 : 600, big ? 160 : 80]] as BeforeAfterFig["before"]["boxes"], crop: null, archiveUrl: null });
  return { kind: "before-after", title: "Example went big", note: "The headline grew from 48 to 96 px", domain: "example.com", name: "Example", href: "/brands/example.com",
    before: frame("a", "2026-11-11T00:00:00Z", false), after: frame("b", "2026-11-14T00:00:00Z", true), diffs: [{ field: "Headline size", before: "48px", after: "96px" }] };
};
