import { describe, expect, it } from "vitest";
import { answer, launchChecks, switches, type LaunchFacts } from "./launch";
import { BRAND_PUBLIC, DATA_STORIES_PUBLIC, LANDING_PUBLIC } from "../site";
import { GATE_ENABLED, OPEN_PATHS } from "../gate";

const NOW = Date.parse("2026-11-16T22:00:00Z");
const base: LaunchFacts = { now: NOW, crawlAt: "2026-11-10T23:10:28Z", crawlRuns7d: 1, libraryAt: "2026-11-15T09:00:00Z", cropsStored: 0,
  productHunt: { lastRunAt: "2026-11-16T15:48:05Z", lastOk: false, okAt: null }, contactEmail: "", forecast: { lastOkAt: "2026-11-16T00:39:32Z", stale: false },
  shareImages: [{ kind: "front page", ok: true, bytes: 61_000 }, { kind: "Morning Line", ok: true, bytes: 55_000 }] };
const by = (f: LaunchFacts) => (id: string) => launchChecks(f).find(c => c.id === id)!;

describe("launch readiness", () => {
  it("lists every switch as set in code today, gate now off, page switches still off", () => {
    const s = switches({ gateEnabled: GATE_ENABLED, openPaths: OPEN_PATHS, landing: LANDING_PUBLIC, brand: BRAND_PUBLIC, dataStories: DATA_STORIES_PUBLIC });
    expect(s.map(x => x.id)).toEqual(["gate", "open_paths", "landing", "brand", "data_stories"]);
    expect(s.find(x => x.id === "gate")!.on).toBe(false);
    expect(s.filter(x => ["landing", "brand", "data_stories"].includes(x.id)).every(x => !x.on)).toBe(true);
    expect(s.find(x => x.id === "open_paths")!.now).toContain(`${OPEN_PATHS.length} paths`);
    for (const x of s) expect(x.exposes.length).toBeGreaterThan(20);
  });
  it("answers each pre-flight line yes or no from the stored facts", () => {
    const c = by(base);
    expect(answer(c("crawls"))).toBe("Yes");
    expect(answer(c("crops"))).toBe("No");
    expect(answer(c("producthunt"))).toBe("No");
    expect(answer(c("contact"))).toBe("No");
    expect(answer(c("forecast"))).toBe("Yes");
    expect(answer(c("share"))).toBe("Yes");
  });
  it("a crawl older than seven days is a no; a missing count is unknown, never yes", () => {
    const c = by({ ...base, crawlAt: "2026-11-01T00:00:00Z", libraryAt: "2026-11-08T00:00:00Z", cropsStored: null, shareImages: null });
    expect(answer(c("crawls"))).toBe("No");
    expect(answer(c("crops"))).toBe("Unknown");
    expect(answer(c("share"))).toBe("Unknown");
  });
  it("a stale forecast or a failed drawer is a no", () => {
    const c = by({ ...base, forecast: { lastOkAt: "2026-10-20T00:00:00Z", stale: true }, shareImages: [{ kind: "front page", ok: false, bytes: 0 }] });
    expect(answer(c("forecast"))).toBe("No");
    expect(c("share").detail).toContain("front page did not draw");
    expect(by({ ...base, productHunt: { lastRunAt: null, lastOk: null, okAt: null } })("producthunt").detail).toContain("no successful run");
  });
});
