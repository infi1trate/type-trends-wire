// W3d Part 3 · the icon study as it would read with ICONS_SHOWN on (app-icons-withheld.test.ts reads it as shipped, off), on the
// owner's-probe FIXTURE (not stored data).
import { describe, expect, it, vi } from "vitest";
vi.mock("../site", async orig => ({ ...(await orig<object>()), ICONS_SHOWN: true }));
import { fxInput } from "./fixtures";
import { buildStory, statusOf } from "./build";
import { entryOf, ICONS_SLUG } from "./registry";
import { CHECKS } from "./checks";
import { iconDeck, iconHeadline, iconHeadlineHolds, iconStudyFigures, leadClauses } from "./app-icons";
import { LEAN_MIN_POINTS, NO_LEAN, hasLean, readWeek, type IconIn } from "../icons/measure";
import { probeRows } from "../icons/__fixtures__/probe";
import type { DriftFig } from "./types";

const withIcons = (icons: IconIn[]) => ({ ...fxInput(), icons });
const e = entryOf(ICONS_SLUG)!;

describe("the icon study (W3d, switch on, fixture)", () => {
  it("is live with 12+ full categories and builds the wall and the lean", () => {
    const i = withIcons(probeRows());
    expect(statusOf(e, i)).toEqual({ status: "live", reason: null });
    const s = buildStory(ICONS_SLUG, i, new Map())!;
    expect(s.number).toBe(8);
    expect(s.series).toBe("beyond-homepage");
    const wall = s.figures["wall"] as DriftFig, lean = s.figures["lean"] as DriftFig;
    expect(wall.bands).toHaveLength(18);
    expect(wall.bands.every(b => b.cells?.length === 100)).toBe(true);
    // Most concentrated first: Productivity's white 42.
    expect(wall.bands[0]).toMatchObject({ q: "Productivity", note: "White 42 · Blue 25 · Black 11" });
    expect(wall.bands.find(b => b.q === "Finance")!.note).toBe("Blue 23 · White 21 · Green 15");
    const fin = lean.bands.find(b => b.q === "Finance")!;
    expect(fin.note).toMatch(/^Finance leans green: 15 of 100, against \d+ of 100 across all categories$/);
    expect(fin.links).toHaveLength(3);
    expect(fin.links!.every(l => l.href.startsWith("https://apps.apple.com/"))).toBe(true);
    expect(fin.lit![1] - fin.lit![0]).toBe(15);
    expect(s.basis.lines.join(" ")).toMatch(/keeps no icon pictures/);
  });
  it("headline and deck by rule: no category is mostly one colour", () => {
    const r = readWeek(probeRows());
    expect(iconHeadline(r)).toBe("No App Store category is mostly one colour");
    expect(iconDeck(r)).toBe("The colour under the top 100 free apps in 18 US App Store categories, week of 23 November 2026: blue leads 11; black leads Photo & Video, Entertainment and Music; white leads Productivity, Medical and Developer Tools; red and white tie in Food & Drink.");
    expect(iconHeadlineHolds(iconHeadline(r), iconDeck(r), r)).toBe(true);
  });
  it("a category over half one ground is named; two of different colours are listed", () => {
    const rows = probeRows().map(a => (a.genre_name === "Productivity" && a.rank <= 60 ? { ...a, palette: [{ hex: "#FFFFFF", share: 0.9 }] } : a));
    expect(iconHeadline(readWeek(rows))).toBe("Productivity is the one App Store category that is mostly white");
    const two = rows.map(a => (a.genre_name === "Music" && a.rank <= 55 ? { ...a, palette: [{ hex: "#000000", share: 0.9 }] } : a));
    expect(iconHeadline(readWeek(two))).toBe("Productivity (white) and Music (black) are the App Store categories that are mostly one colour");
  });
  it("the check fails when the headline's or deck's claims are not the stored counts", () => {
    const r = readWeek(probeRows());
    expect(iconHeadlineHolds("Productivity is the one App Store category that is mostly white", iconDeck(r), r)).toBe(false);
    expect(iconHeadlineHolds(iconHeadline(r), iconDeck(r).replace("in 18 US", "in 17 US"), r)).toBe(false);
    expect(iconHeadlineHolds(iconHeadline(r), iconDeck(r).replace("blue leads 11", "blue leads 12"), r)).toBe(false);
    expect(iconStudyFigures(withIcons(probeRows()))).toMatchObject({ categories: 18, apps: 1800, headline: 1, ready: true });
  });
  it("fewer than 12 full categories: not live, waiting with its counts", () => {
    const few = probeRows().filter(a => a.genre_id < 6012);
    const i = withIcons(few);
    expect(CHECKS["app-icons"](i).pass).toBe(false);
    expect(statusOf(e, i).status).toBe("draft");
    expect(buildStory(ICONS_SLUG, i, new Map())).toBeNull();
  });
  it("a removed app leaves the figures at once", () => {
    const rows = probeRows(), gone = rows.find(a => a.genre_name === "Finance" && a.rank === 45)!;
    const s = buildStory(ICONS_SLUG, withIcons(rows.map(a => (a.app_id === gone.app_id ? { ...a, removed_at: "2026-11-23T00:00:00Z" } : a))), new Map())!;
    expect(JSON.stringify(s)).not.toContain(gone.name);
    expect((s.figures["wall"] as DriftFig).bands.find(b => b.q === "Finance")!.cells).toHaveLength(99);
  });
});

// W3d-c Part 1 · the four fixes the owner asked for on the real week (23 Nov 2026).
const HEX: Record<string, string> = { white: "#FFFFFF", black: "#000000", blue: "#0A84FF", red: "#E5332A" };
function cat(id: number, name: string, spec: Record<string, number>): IconIn[] {
  let rank = 1;
  return Object.entries(spec).flatMap(([g, n]) => Array.from({ length: n }, () => {
    const r = rank++, palette = g === "mixed" ? ["#E5332A", "#0A84FF", "#FFD100", "#1DB954"].map(hex => ({ hex, share: 0.24 })) : [{ hex: HEX[g]!, share: 0.7 }];
    return { app_id: `${id}${String(r).padStart(3, "0")}`, rank: r, name: `${name} ${r}`, maker: "m", link: `https://apps.apple.com/us/app/x/id${id}${r}`, palette, genre_id: id, genre_name: name, week: "2026-W48" };
  }));
}
describe("W3d-c fixes to study No. 8", () => {
  it("the owner's sentence: white and black tie in Photo & Video and News; blue and white tie in Shopping", () => {
    const r = readWeek([...cat(1, "Photo & Video", { white: 27, black: 27, red: 20, mixed: 26 }), ...cat(2, "News", { white: 23, black: 23, blue: 21, red: 20, mixed: 13 }), ...cat(3, "Shopping", { blue: 22, white: 22, red: 12, mixed: 44 })]);
    expect(leadClauses(r)).toEqual(["white and black tie in Photo & Video and News", "blue and white tie in Shopping"]);
  });
  it("a category less than 5 points from its share shows No lean this week, with no apps listed and nothing lit", () => {
    const i = withIcons(probeRows()), r = readWeek(i.icons), lean = buildStory(ICONS_SLUG, i, new Map())!.figures["lean"] as DriftFig;
    const flat = r.leans.filter(l => l.points < LEAN_MIN_POINTS), leaning = r.leans.filter(l => l.points >= LEAN_MIN_POINTS);
    expect(flat.length).toBeGreaterThan(0);
    expect(leaning.length).toBeGreaterThan(0);
    for (const l of flat) expect(lean.bands.find(b => b.q === l.category)).toMatchObject({ note: NO_LEAN, lit: [0, 0] });
    for (const l of flat) expect(lean.bands.find(b => b.q === l.category)!.links).toBeUndefined();
    for (const l of leaning) expect(lean.bands.find(b => b.q === l.category)!.note).toMatch(/ leans /);
  });
  it("4.9 points is no lean, 5.0 is a lean", () => {
    const l = (points: number) => ({ points });
    expect([hasLean(l(4.9)), hasLean(l(5)), hasLean(l(23.4))]).toEqual([false, true, true]);
  });
  it("sets the mixed icons off at the end of the row and keeps the mixed count under it", () => {
    const wall = buildStory(ICONS_SLUG, withIcons(probeRows()), new Map())!.figures["wall"] as DriftFig;
    const travel = wall.bands.find(b => b.q === "Travel")!;
    expect(travel.split).toBe(98);
    expect(travel.note).toMatch(/ · 2 mixed$/);
    expect(wall.bands.find(b => b.q === "Productivity")!.split).toBeUndefined(); // no mixed icon, no gap
  });
  it("the method note says what a mixed icon is and how it is drawn", () => {
    const s = buildStory(ICONS_SLUG, withIcons(probeRows()), new Map())!;
    expect(s.basis.rule).toContain("A mixed icon has no colour holding 35% of it, and is drawn in its largest colour.");
  });
});
