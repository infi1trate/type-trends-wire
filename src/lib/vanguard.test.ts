import { describe, expect, it } from "vitest";
import { VANGUARD_MAX, VANGUARD_STORY_DAYS, VANGUARD_TOP_TRENDSETTERS, vanguardList } from "./vanguard";

const NOW = Date.parse("2026-11-16T12:00:00Z"), day = (n: number) => new Date(NOW - n * 864e5).toISOString();
const dom = (i: number) => `brand${String(i).padStart(3, "0")}.com`;
const active = Array.from({ length: 300 }, (_, i) => dom(i));

describe("vanguard rule", () => {
  it("is the top 30 by trendsetter rank plus brands with a published move, rebrand or counter-move in 14 days, sorted by domain", () => {
    expect([VANGUARD_TOP_TRENDSETTERS, VANGUARD_STORY_DAYS, VANGUARD_MAX]).toEqual([30, 14, 45]);
    const trendsetters = Array.from({ length: 50 }, (_, i) => ({ domain: dom(i), rank: i + 1 }));
    const stories = [
      { type: "move", state: "published", domains: [dom(200)], happened_at: day(2) },
      { type: "rebrand", state: "published", domains: [dom(201)], happened_at: day(13) },
      { type: "counter_move", state: "published", domains: [dom(202)], happened_at: day(1) },
      { type: "move", state: "held", domains: [dom(203)], happened_at: day(1) },
      { type: "move", state: "killed", domains: [dom(204)], happened_at: day(1) },
      { type: "move", state: "published", domains: [dom(205)], happened_at: day(15) },
      { type: "shift", state: "published", domains: [dom(206)], happened_at: day(1) },
      { type: "move", state: "published", domains: ["gone.com"], happened_at: day(1) },
    ];
    const v = vanguardList({ trendsetters, stories, active, now: NOW });
    expect(v).toHaveLength(33);
    expect(v).toEqual([...v].sort());
    expect(v).toContain(dom(0)); expect(v).toContain(dom(29)); expect(v).not.toContain(dom(30));
    expect(v.filter(d => d >= dom(200))).toEqual([dom(200), dom(201), dom(202)]);
  });
  it("caps at 45, trendsetters first, then the newest stories; inactive sites never appear", () => {
    const trendsetters = Array.from({ length: 30 }, (_, i) => ({ domain: dom(i), rank: i + 1 }));
    const stories = Array.from({ length: 40 }, (_, i) => ({ type: "move", state: "published", domains: [dom(100 + i)], happened_at: new Date(NOW - (i + 1) * 36e5).toISOString() }));
    const v = vanguardList({ trendsetters, stories, active: active.filter(d => d !== dom(5)), now: NOW });
    expect(v).toHaveLength(VANGUARD_MAX);
    expect(v).not.toContain(dom(5));
    // 29 active trendsetters leave room for 16 story brands, newest story first.
    expect(v.filter(d => d >= dom(100))).toEqual(Array.from({ length: 16 }, (_, i) => dom(100 + i)));
  });
});
