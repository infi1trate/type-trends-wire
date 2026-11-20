import { describe, expect, it } from "vitest";
import type { SignalRow } from "../signals";
import type { TierResult } from "../tiers";
import type { StoryRecord } from "../stories/view";
import { SECTOR_BLOCKS, quarterOf, sectorIndex, sectorReport } from "./sector";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const r = (key: string, scope: string, stage: string | null, share: number, score: number): SignalRow => { const [dimension, value] = key.split(":"); return { dimension: dimension!, value: value!, scope, status: "ok", stage, momentum: 0.5, current_share: share, next_wave_score: score, sites: 40 }; };
const tier = (key: string): [string, TierResult] => [key, { key, tier: "headline", reasons: [] } as unknown as TierResult];
const rows = [
  r("css:subgrid", "all", "steady", 0.2, 0.9), r("css:subgrid", "fintech", "accelerating", 0.3, 0.9),
  r("headline:serif", "all", "accelerating", 0.25, 0.8), r("headline:serif", "fintech", "flat", 0.1, 0.8),
];
const tiers = new Map([tier("css:subgrid"), tier("headline:serif")]);
const st = (id: string, o: Partial<StoryRecord>): StoryRecord => ({ id, type: "move", status: "published", state: "published", reason: "", score: 60, components: {}, why_ran: "", kicker: "Move", headline: id, deck: null, facts: [], why_line: null, why_model: null, why_at: null, sector: "fintech", signal_keys: [], domains: [], evidence: [], source_ids: [], basis: "measured", happened_at: "2026-11-10T00:00:00Z", created_at: "2026-11-10T00:00:00Z", stored: { status: "published", type: "move", kicker: "Move", headline: id, deck: null, why_line: null, facts: [] }, pinnedUntil: null, correctedAt: null, killReason: null, edits: [], ...o });
const sites = [{ domain: "stripe.com", sector: "fintech", name: "Stripe" }, { domain: "ramp.com", sector: "fintech", name: "Ramp" }, { domain: "linear.app", sector: "dev-tools", name: "Linear" }];
const base = { now: NOW, run: { id: 15, at: "2026-11-16T00:39:00Z" }, rows, tiers, sites, patterns: [],
  trendsetters: [{ domain: "ramp.com", rank: 4, sector: "fintech" }, { domain: "stripe.com", rank: 2, sector: "fintech" }, { domain: "linear.app", rank: 1, sector: "dev-tools" }],
  stories: [st("ws", { type: "white_space", kicker: "White space" }), st("cm", { type: "counter_move" }), st("mv", { domains: ["stripe.com"], score: 80 }), st("old", { happened_at: "2026-09-01T00:00:00Z" }), st("other", { sector: "ai" })] };

describe("sector report", () => {
  it("a covered sector: signals here vs all, contrast both ways, white space, counter-moves, leaders with latest move, quarter stories, basis", () => {
    const m = sectorReport({ ...base, sector: "fintech" });
    expect(m.blocks).toEqual(SECTOR_BLOCKS);
    expect(m.title).toBe("State of Fintech · Q4 2026");
    expect(m.coverage).toEqual({ covered: 2, total: 2, enough: true });
    expect(m.signals.map(s => [s.key, s.here.stage, s.all.stage])).toEqual(expect.arrayContaining([["css:subgrid", "Rising", "Steady"], ["headline:serif", "Steady", "Rising"]]));
    expect(m.contrast.risingHere.map(s => s.key)).toEqual(["css:subgrid"]);
    expect(m.contrast.risingElsewhere.map(s => s.key)).toEqual(["headline:serif"]);
    expect(m.whiteSpace.map(s => s.id)).toEqual(["ws"]);
    expect(m.counterMoves.map(s => s.id)).toEqual(["cm"]);
    expect(m.leaders.map(l => [l.domain, l.rank, l.latest?.id ?? null])).toEqual([["stripe.com", 2, "mv"], ["ramp.com", 4, null]]);
    expect(m.stories.map(s => s.id)).toEqual(["mv", "cm", "ws"]);
    expect(m.basis).toBe("Based on 2 brands tracked in Fintech and the forecast run of 16 November 2026 (run 15). Stage, share and Momentum are measured; stories link to their receipts.");
    expect(m.note).toBeNull();
  });
  it("Momentum appears once, as all-sector: the sides compare stage and share only", () => {
    const m = sectorReport({ ...base, sector: "fintech" });
    for (const s of [...m.signals, ...m.contrast.risingHere, ...m.contrast.risingElsewhere]) {
      expect(Object.keys(s.here).sort()).toEqual(["share", "stage"]);
      expect(Object.keys(s.all).sort()).toEqual(["share", "stage"]);
      expect(s).toHaveProperty("momentum_all");
    }
  });
  it("an uncovered sector shows no sector numbers and says why", () => {
    const m = sectorReport({ ...base, sector: "dev-tools" });
    expect(m.coverage.enough).toBe(false);
    expect(m.signals).toEqual([]);
    expect(m.contrast).toEqual({ risingHere: [], risingElsewhere: [] });
    expect(m.note).toMatch(/doesn't have enough forecast coverage yet \(0 of 2 headline signals/);
    expect(m.leaders.map(l => l.domain)).toEqual(["linear.app"]);
  });
  it("the index lists covered sectors first", () => {
    const idx = sectorIndex({ now: NOW, run: base.run, rows, tiers, sites, stories: base.stories });
    expect(idx.map(s => [s.sector, s.enough])).toEqual([["fintech", true], ["dev-tools", false]]);
    expect(quarterOf(NOW)).toMatchObject({ key: "2026Q4", label: "Q4 2026", start: "2026-10-01T00:00:00.000Z" });
  });
});
