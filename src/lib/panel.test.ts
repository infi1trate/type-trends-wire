import { describe, expect, it } from "vitest";
import { applyPanelStep, archiveComplete, eventVisible, holdForStep, howThePanelGrows, inPanel, isReady, panelDomains, panelOnly, panelStepNote, panelTicks, planPanelStep, splitCounts, onboardingNote, type PanelSite } from "./panel";
import { categoryChips, CATEGORY_BRANDS } from "./categories";

type Row = PanelSite & { quarter: string; has: boolean };
const site = (domain: string, sector: string, panel_since: string | null): PanelSite => ({ domain, sector, active: !!panel_since, onboarding: !panel_since, panel_since });
const QUARTERS = ["2025Q3", "2025Q4", "2026Q1"];
// 20 panel brands (8 have the trait in every quarter), 10 onboarding brands that all have it.
const sites: PanelSite[] = [...Array.from({ length: 20 }, (_, i) => site(`p${i}.com`, "fintech", "2024-01-01T00:00:00Z")), ...Array.from({ length: 10 }, (_, i) => site(`n${i}.com`, "health", null))];
const history: Row[] = sites.flatMap(s => QUARTERS.map(q => ({ ...s, quarter: q, has: s.domain.startsWith("n") || Number(s.domain.slice(1, -4)) < 8 })));
const shareSeries = (rows: Row[], live: readonly PanelSite[]) => {
  const p = panelDomains(live);
  return QUARTERS.map(q => { const r = rows.filter(x => x.quarter === q && p.has(x.domain)); return r.filter(x => x.has).length / r.length; });
};

describe("R2a · the panel entry rule", () => {
  it("an onboarding brand changes no share", () => {
    const panelOnlyRows = history.filter(r => r.domain.startsWith("p"));
    expect(shareSeries(history, sites)).toEqual(shareSeries(panelOnlyRows, sites));
    expect(shareSeries(history, sites)).toEqual([0.4, 0.4, 0.4]);
  });
  it("onboarding brands are not story inputs or Latest changes lines until they join", () => {
    const p = panelDomains(sites);
    expect(eventVisible("n1.com", p)).toBe(false); expect(eventVisible("p1.com", p)).toBe(true);
    expect(panelOnly(sites)).toHaveLength(20); expect(inPanel({ domain: "x", sector: "ai", active: false, panel_since: "2024-01-01" })).toBe(false);
  });
  it("ready needs two live captures over 24 h apart, the archive settled and a clear latest reading", () => {
    const base = { domain: "n0.com", archiveComplete: true, latestWellRead: true };
    expect(isReady({ ...base, liveHomeCaptures: ["2026-11-20T00:00:00Z", "2026-11-21T00:00:01Z"] })).toBe(true);
    expect(isReady({ ...base, liveHomeCaptures: ["2026-11-20T00:00:00Z", "2026-11-20T23:00:00Z"] })).toBe(false);
    expect(isReady({ ...base, archiveComplete: false, liveHomeCaptures: ["2026-11-20T00:00:00Z", "2026-11-22T00:00:00Z"] })).toBe(false);
    expect(isReady({ ...base, latestWellRead: false, liveHomeCaptures: ["2026-11-20T00:00:00Z", "2026-11-22T00:00:00Z"] })).toBe(false);
    const all = new Set<string>(); for (let y = 2020; y <= 2026; y++) for (let q = 1; q <= 4; q++) all.add(`${y}Q${q}`);
    expect(archiveComplete(all, "2026Q4")).toBe(true); all.delete("2022Q2"); expect(archiveComplete(all, "2026Q4")).toBe(false);
  });
  it("a step moves every ready brand at once and every quarter is recomputed over the same panel", () => {
    const ready = new Set(sites.filter(s => s.domain.startsWith("n")).map(s => s.domain));
    expect(planPanelStep(sites, new Set(), "2026-12-02T00:00:00Z")).toBeNull();
    const plan = planPanelStep(sites, ready, "2026-12-02T00:00:00Z")!;
    expect(plan).toMatchObject({ brands_before: 20, brands_after: 30, by_sector: { health: 10 } });
    const after = applyPanelStep(sites, plan);
    // 8 + 10 of 30 in every quarter: no quarter is left on the smaller panel.
    expect(shareSeries(history, after)).toEqual([0.6, 0.6, 0.6]);
  });
  it("the tick and its note sit at the step's quarter", () => {
    const s = { at: "2026-12-02T10:00:00Z", brands_before: 300, brands_after: 412 };
    expect(panelStepNote(s)).toBe("Panel grew from 300 to 412 brands on 2 December 2026; earlier quarters are recomputed over the larger panel");
    expect(panelTicks([s])).toEqual([{ quarter: "2026Q4", note: panelStepNote(s) }]);
    expect(howThePanelGrows([s], 412).at(-1)).toBe("2 December 2026: 300 to 412 brands.");
  });
  it("a tier change within a week of a step is held for the data desk", () => {
    const s = { at: "2026-12-02T00:00:00Z", brands_before: 300, brands_after: 412 };
    expect(holdForStep("2026-12-05T00:00:00Z", [s])).toEqual(s);
    expect(holdForStep("2026-12-10T00:00:00Z", [s])).toBeNull();
    expect(holdForStep("2026-11-30T00:00:00Z", [s])).toBeNull();
  });
  it("counts come from stored rows, never from the map file", () => {
    expect(CATEGORY_BRANDS.length).toBeGreaterThan(1000);
    const rows = [{ domain: "stripe.com", sector: "fintech" }, { domain: "adyen.com", sector: "fintech" }];
    expect(categoryChips(rows, "fintech").reduce((n, c) => n + c.count, 0)).toBe(2);
    expect(splitCounts(sites)).toEqual({ panel: 20, onboarding: 10 }); expect(onboardingNote(10)).toBe("+10 onboarding"); expect(onboardingNote(0)).toBe("");
  });
});
import { panelHealthLine } from "./panel";
describe("R2a · health line", () => {
  it("names panel, onboarding, ready, unfiled and the last step", () => {
    expect(panelHealthLine({ panel: 328, onboarding: 0, ready: 0, unfiled: 0, last_step: null })).toBe("Panel 328 brands; 0 onboarding (0 ready); 0 unfiled; no panel step yet.");
  });
});

import { panelInvariantProblems, readiness } from "./panel";
describe("R2a-2 · onboarding is inactive until the step", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const allQ = () => { const s = new Set<string>(); for (let y = 2020; y <= 2026; y++) for (let q = 1; q <= 4; q++) s.add(`${y}Q${q}`); return s; };
  const live = ["2026-11-20T00:00:00Z", "2026-11-22T00:00:00Z"];
  it("an archive quarter is settled by a copy or a gap row; the current quarter by live captures", () => {
    const arch = allQ(); arch.delete("2021Q3"); arch.delete("2026Q4");
    expect(readiness({ liveHomeCaptures: live, archiveQuarters: arch, gapQuarters: new Set(), latestWellRead: true }, now)).toEqual({ ready: false, missing: ["archive quarters not settled: 2021Q3"] });
    expect(readiness({ liveHomeCaptures: live, archiveQuarters: arch, gapQuarters: new Set(["2021Q3"]), latestWellRead: true }, now).ready).toBe(true);
  });
  it("names every missing condition", () => {
    expect(readiness({ liveHomeCaptures: ["2026-11-20T00:00:00Z"], archiveQuarters: new Set(), gapQuarters: new Set(["2020Q4"]), latestWellRead: false }, now).missing).toEqual([
      "live home captures: 1 of 2", expect.stringMatching(/^archive quarters not settled: 2021Q1, /), "latest live capture does not read clearly"]);
  });
  it("the step makes joiners active, not onboarding, dated", () => {
    const plan = planPanelStep(sites, new Set(["n0.com"]), "2026-11-25T00:00:00Z")!;
    expect(applyPanelStep(sites, plan).find(s => s.domain === "n0.com")).toMatchObject({ active: true, onboarding: false, panel_since: "2026-11-25T00:00:00Z" });
    expect(planPanelStep(sites, new Set(), "x")).toBeNull();
  });
  it("invariants fail loudly", () => {
    expect(panelInvariantProblems(sites)).toEqual([]);
    const bad = [{ domain: "a.com", sector: "ai", active: true, panel_since: null }, { domain: "b.com", sector: "ai", active: true, onboarding: true, panel_since: "2024-01-01" }];
    expect(panelInvariantProblems(bad)).toHaveLength(2);
    expect(panelHealthLine({ panel: 1, onboarding: 0, ready: 0, unfiled: 0, last_step: null, invariant: panelInvariantProblems(bad) })).toMatch(/PANEL INVARIANT BROKEN/);
  });
});

// The archive crawler reads from 2021 Q1 (crawler/src/wayback-lib.js START_YEAR); a rule that asked for an earlier
// quarter could never be met, and no brand would ever join.
import { readFileSync } from "node:fs";
import { PANEL_FROM_QUARTER } from "./panel";
describe("the first archive quarter", () => {
  it("is the first quarter the archive crawler reads", () => {
    const year = /export const START_YEAR = (\d{4});/.exec(readFileSync("crawler/src/wayback-lib.js", "utf8"))?.[1];
    expect(PANEL_FROM_QUARTER).toBe(`${year}Q1`);
  });
});
