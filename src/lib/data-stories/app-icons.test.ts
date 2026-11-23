// W3d Part 3 · the icon study as it would read with ICONS_SHOWN on (app-icons-withheld.test.ts reads it as shipped, off), on the
// owner's-probe FIXTURE (not stored data).
import { describe, expect, it, vi } from "vitest";
vi.mock("../site", async orig => ({ ...(await orig<object>()), ICONS_SHOWN: true }));
import { fxInput } from "./fixtures";
import { buildStory, statusOf } from "./build";
import { entryOf, ICONS_SLUG } from "./registry";
import { CHECKS } from "./checks";
import { iconDeck, iconHeadline, iconHeadlineHolds, iconStudyFigures } from "./app-icons";
import { readWeek, type IconIn } from "../icons/measure";
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
