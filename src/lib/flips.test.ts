import { describe, expect, it } from "vitest";
import { flipRuns, flipSentence, FLIP_DAYS } from "./flips";
import { pairStamps } from "./data-stories/text";
import { brandModel } from "./brand-page";
import { auditFixture } from "./agency/test-fixtures";
import type { EventRow } from "./agency/changes";

// neon.com as stored: hero media image → video (11 Nov), video → image (13 Nov), image → video (14 Nov).
const ev = (id: number, before: string, after: string, at: string): EventRow => ({ id, domain: "vercel.com", type: "layout_change", before: { hero_media: before }, after: { hero_media: after }, detected_at: at, effective_at: at });
const neon = [ev(190, "image", "video", "2026-11-11T13:02:18Z"), ev(3317, "video", "image", "2026-11-13T13:34:48Z"), ev(3651, "image", "video", "2026-11-14T17:54:23Z")];
const ins = neon.map(e => ({ id: String(e.id), field: "hero_media", before: (e.before as { hero_media: string }).hero_media, after: (e.after as { hero_media: string }).hero_media, at: e.detected_at }));

describe("back-and-forth runs", () => {
  it("A → B → A → B within 14 days is one run of three", () => {
    const [r] = flipRuns(ins);
    expect([r!.count, r!.a, r!.b, r!.ids]).toEqual([3, "image", "video", ["190", "3317", "3651"]]);
    expect(flipSentence(r!, "hero media")).toBe("Hero media has switched between image and video 3 times since 11 Nov; the homepage likely rotates it.");
  });
  it("a single change, two unrelated changes, or a swap back after more than 14 days is not a run", () => {
    expect(flipRuns(ins.slice(0, 1))).toEqual([]);
    expect(flipRuns([ins[0]!, { ...ins[1]!, after: "none" }])).toEqual([]);
    expect(flipRuns([ins[0]!, { ...ins[1]!, at: new Date(Date.parse(ins[0]!.at) + (FLIP_DAYS + 1) * 864e5).toISOString() }])).toEqual([]);
  });
  it("the brand page folds the run into one row with the single moves behind it; stored events are untouched", () => {
    const events = [...neon, ...auditFixture().events.filter(e => e.domain === "vercel.com")];
    const copy = JSON.stringify(events);
    const t = brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events, peers: [], tiers: [] }).timeline;
    const flips = t.filter(m => m.folded);
    expect(flips).toHaveLength(1);
    expect(flips[0]!.text).toMatch(/^Hero media has switched between image and video 3 times since 11 Nov/);
    expect(flips[0]!.folded!.map(m => m.id)).toEqual(["event:3651", "event:3317", "event:190"]);
    expect(t.some(m => m.id === "event:3317")).toBe(false);
    expect(JSON.stringify(events)).toBe(copy);
  });
});
describe("before / after stamps", () => {
  it("a pair never shows two identical stamps", () => {
    expect(pairStamps("2026-11-14T11:41:51Z", "2026-11-14T17:54:23Z")).toEqual(["14 Nov 2026, 11:41 UTC", "14 Nov 2026, 17:54 UTC"]);
    expect(pairStamps("2026-11-11T13:02:18Z", "2026-11-14T17:54:23Z")).toEqual(["11 Nov 2026", "14 Nov 2026"]);
    const [a, b] = pairStamps("2026-11-14T11:41:05Z", "2026-11-14T11:41:51Z");
    expect(a).not.toBe(b);
  });
});
