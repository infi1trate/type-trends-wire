// W3a Part E · a reading that is not steady is not a change. Fixture: the media homepages' AI-read hero layout between forecast runs 13
// and 16 (the eight that changed are the stored readings; the others keep their value).
import { describe, expect, it } from "vitest";
import type { SignalRow } from "../signals";
import { context, crossoverCandidates, steadyNeeds, type BuildInput, type SiteNow } from "./candidates";
import { isAiField, notSteadyReason, steadiness, STEADY_MAX_CHANGED, STEADY_MIN_BOTH, type FieldReading, type NotSteady, type Readings } from "./steady";

const R13 = "2026-11-14T18:00:00Z", R16 = "2026-11-21T13:00:00Z";
const CHANGED: [string, string, string][] = [["bloomberg.com", "grid_collage", "full_bleed_media"], ["businessinsider.com", "centered_stack", "grid_collage"], ["eater.com", "grid_collage", "centered_stack"], ["itsnicethat.com", "centered_stack", "full_bleed_media"],
  ["polygon.com", "grid_collage", "split_left_text"], ["theguardian.com", "centered_stack", "split_left_text"], ["theringer.com", "full_bleed_media", "split_left_text"], ["theverge.com", "split_left_text", "grid_collage"]];
const reading = (value: string, at: string): Partial<Record<"hero_layout" | "tone", FieldReading>> => ({ hero_layout: { value, at } });
function media(changed: number) {
  const early = new Map<string, Partial<Record<"hero_layout", FieldReading>>>(), late = new Map<string, Partial<Record<"hero_layout", FieldReading>>>(), domains: string[] = [];
  CHANGED.slice(0, changed).forEach(([d, a, b]) => { domains.push(d); early.set(d, reading(a, R13)); late.set(d, reading(b, R16)); });
  for (let i = 0; domains.length < 24; i++) { const d = `media${i}.com`; domains.push(d); early.set(d, reading("centered_stack", R13)); late.set(d, reading("centered_stack", R16)); }
  return { domains, early: early as Readings, late: late as Readings };
}

describe("W3a · reading steadiness", () => {
  it("the rule's numbers: more than a quarter changed, with at least 15 read in both", () => {
    expect(STEADY_MAX_CHANGED).toBe(0.25); expect(STEADY_MIN_BOTH).toBe(15);
    expect(notSteadyReason(8, 24)).toBe("reading not steady: 8 of 24 homepages changed between the two forecasts");
  });
  it("media hero layout, runs 13 to 16: 8 of 24 changed, not steady, with both values and capture dates", () => {
    const { domains, early, late } = media(8), s = steadiness("hero_layout", "media", domains, early, late);
    expect(s).toMatchObject({ both: 24, changed: 8, judged: true, steady: false });
    expect(s.homes[0]).toEqual({ domain: "bloomberg.com", before: "grid_collage", after: "full_bleed_media", beforeAt: R13, afterAt: R16 });
  });
  it("a steady made-up field: 2 of 24 changed is allowed", () => {
    const { domains, early, late } = media(2);
    expect(steadiness("hero_layout", "media", domains, early, late)).toMatchObject({ both: 24, changed: 2, steady: true });
  });
  it("6 of 24 (exactly a quarter) is still steady; fewer than 15 read in both is not judged", () => {
    const a = media(6); expect(steadiness("hero_layout", "media", a.domains, a.early, a.late).steady).toBe(true);
    const b = media(8), few = b.domains.slice(0, 14);
    expect(steadiness("hero_layout", "media", few, b.early, b.late)).toMatchObject({ both: 14, changed: 8, judged: false, steady: true });
  });
  it("measured fields are never subject to it", () => {
    for (const f of ["hero_media", "theme", "cta_shape", "tracking", "css", "whitespace"]) expect(isAiField(f)).toBe(false);
    for (const f of ["hero_layout", "tone", "imagery", "components"]) expect(isAiField(f)).toBe(true);
  });
});

// A made-up crossover that passes every other check (as in P2b): imagery:data_viz in media, below the floor in every well-read quarter.
const NOW = "2026-11-22T12:00:00.000Z", KEY = "imagery:data_viz";
const lead = (share: number, o: Partial<SignalRow> = {}): SignalRow => ({ dimension: "imagery", value: "data_viz", scope: "dev-tools", status: "ok", stage: "accelerating", momentum: 0.3, current_share: share, next_wave_score: 1, sites: 30, usable: 30, present: [], ...o } as unknown as SignalRow);
const quarters = [{ q: "2025Q1", n: 25, s: 0.04 }, { q: "2026Q1", n: 25, s: 0.04 }, { q: "2026Q4", n: 30, s: 0.17 }];
const sites: SiteNow[] = ["media", "dev-tools"].flatMap(s => Array.from({ length: 30 }, (_, i) => ({ domain: `${s}${i}.com`, name: null, sector: s, captured: "2026-11-21T00:00:00Z", traits: i < 7 ? [KEY] : [] })));
const input = (o: Partial<BuildInput> = {}): BuildInput => ({ now: NOW, events: [], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], sites, ...o, runs: [
  { id: 13, at: "2026-11-15T15:33:42Z", rows: [lead(0.2, { scope: "all" }), lead(0.04, { scope: "media", sample: { q: "2026Q4", n: 26, s: 0.04 } } as never), lead(0.4)] },
  { id: 16, at: "2026-11-22T09:30:41Z", rows: [lead(0.22, { scope: "all" }), lead(0.17, { scope: "media", sample: { q: "2026Q4", n: 30, s: 0.17 }, quarters } as never), lead(0.43)] },
] });

describe("W3a · crossovers on an unsteady reading", () => {
  it("the build reads steadiness only for the AI-read crossovers that pass every other check", () => {
    expect(steadyNeeds(context(input()))).toEqual([{ field: "imagery", scope: "media" }]);
  });
  it("is built when the reading is steady", () => {
    expect(crossoverCandidates(context(input())).map(c => c.id)).toEqual([`crossover:${KEY}:media:16`]);
  });
  it("is refused, and recorded, when more than a quarter of the sector's homepages read in both runs changed", () => {
    const notSteady: NotSteady[] = [];
    expect(crossoverCandidates(context(input({ unsteady: [{ field: "imagery", scope: "media", changed: 8, both: 24 }] })), [], [], notSteady)).toEqual([]);
    expect(notSteady).toEqual([{ id: `crossover:${KEY}:media:16`, field: "imagery", scope: "media", changed: 8, both: 24, reason: "reading not steady: 8 of 24 homepages changed between the two forecasts" }]);
  });
  it("an unsteady reading in another sector or another field changes nothing", () => {
    expect(crossoverCandidates(context(input({ unsteady: [{ field: "imagery", scope: "fintech", changed: 9, both: 24 }, { field: "tone", scope: "media", changed: 9, both: 24 }] }))).length).toBe(1);
  });
});

describe("W3a · the data desk's finding for an unsteady reading", () => {
  it("one detector finding per unsteady field and sector, a stable key, at most ten homepages with both values and dates", async () => {
    const { steadyFindings, STEADY_FINDING_HOMES } = await import("../newsroom/steady-findings");
    const a = media(8), b = media(2);
    const many = { ...steadiness("hero_layout", "media", a.domains, a.early, a.late), homes: Array.from({ length: 12 }, (_, i) => ({ domain: `m${i}.com`, before: "a", after: "b", beforeAt: R13, afterAt: R16 })) };
    const f = steadyFindings([steadiness("hero_layout", "media", a.domains, a.early, a.late), steadiness("hero_layout", "fintech", b.domains, b.early, b.late), many], { early: 13, late: 16 });
    expect(f.map(x => [x.kind, x.key])).toEqual([["detector", "detector:steady:hero_layout:media:13-16"], ["detector", "detector:steady:hero_layout:media:13-16"]]);
    expect(f[0]!.found).toContain("8 of 24 homepages changed their hero_layout reading between forecast runs 13 and 16: bloomberg.com grid_collage (2026-11-14) to full_bleed_media (2026-11-21)");
    expect(STEADY_FINDING_HOMES).toBe(10);
    expect((f[1]!.receipt["homes"] as unknown[]).length).toBe(10);
  });
});
