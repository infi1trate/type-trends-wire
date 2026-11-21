import { describe, expect, it } from "vitest";
import { brandModel } from "./brand-page";
import { auditFixture } from "./agency/test-fixtures";
import type { CaptureRaw } from "./data-stories/templates/frames";

const cap = (id: number, at: string): CaptureRaw => ({ id, captured_at: `${at}T00:00:00Z`, source: "live", page: { w: 1280, h: 900 }, color: null, skeleton: [{ kind: "heading", x: 0, y: 0, w: 200, h: 40 }], h1: null, body: null, h1_size: null, whitespace: null, hero: null, radius: null, archive_url: null });
const rows = (o: Partial<Parameters<typeof brandModel>[0]> = {}) => ({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [] as [string, "headline"][], ...o });

describe("brand page model", () => {
  it("identity values come from stored data, each with a receipt", () => {
    const b = brandModel(rows());
    expect(b.identity.h1).toMatchObject({ family: "Geist", size: 64 });
    expect(b.identity.palette.map(p => [p.hex, p.share])).toEqual([["#FFFFFF", 0.5], ["#000000", 0.25]]); // largest first
    expect(b.identity.accent).toEqual({ hex: "#0070F3", name: "Vivid indigo" });
    expect(b.identity.tags.filter(t => t.basis === "ai").map(t => t.key)).toEqual(["aesthetic:minimal", "tone:technical"]);
    expect(b.identity.layout.map(l => l.id)).toEqual(["theme", "hero", "h1"]);
    expect(b.identity.receipt).toBe("/brands/vercel.com?view=data");
  });
  it("moves are in date order, newest first, each with the captures either side", () => {
    const b = brandModel(rows({ captures: [cap(1, "2025-12-01"), cap(2, "2026-02-01"), cap(3, "2026-09-01"), cap(4, "2026-10-05")] }));
    expect(b.timeline.map(m => m.at)).toEqual(["2026-10-01T00:00:00Z", "2026-01-01T00:00:00Z"]);
    expect(b.timeline.every(m => m.basis === "measured" && m.pair !== null)).toBe(true);
    expect(b.timeline[0]!.text).toBe("vercel · accent, Near-black to Vivid indigo · 1 Oct"); // E2a: a tape line
  });
  it("without stored captures a move has no pair; without events the timeline is empty", () => {
    expect(brandModel(rows()).timeline.every(m => m.pair === null)).toBe(true);
    expect(brandModel(rows({ events: [] })).timeline).toEqual([]);
  });
});
