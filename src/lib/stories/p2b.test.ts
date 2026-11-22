// P2b · a crossover must be new to the sector: the later run's own stored quarters, not the earlier run's one reading, say whether the
// signal was already there, and the "up from" figure names its own earlier quarter.
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/crossovers-media-13-16.json";
import type { SignalRow } from "../signals";
import { context, crossoverCandidates, crossoverQuarterNeeds, quarterName, sectorHistory, type BuildInput, type NotNew, type SiteNow } from "./candidates";
import { allCandidates } from "./editor";
import { ALREADY_THERE_REASON, CROSSOVER_FLOOR, CROSSOVER_HISTORY_QUARTERS, MORE_READ_EXAMPLES, NO_EARLIER_READING_REASON, READ_GROWTH_MIN_BASE } from "./types";

const NOW = "2026-11-22T12:00:00.000Z";
const KEYS = ["hero_layout:split_left_text", "tone:calm"];
const stored = (run: number, key: string, scope: string) => {
  const r = fixture.rows.find(x => x.run_id === run && `${x.dimension}:${x.value}` === key && x.scope === scope)!;
  const { run_id: _run, ...row } = r; return row as unknown as SignalRow;
};
const lead = (key: string, share: number): SignalRow => ({ dimension: key.slice(0, key.indexOf(":")), value: key.slice(key.indexOf(":") + 1), scope: "dev-tools", status: "ok", stage: "accelerating", momentum: 0.3, current_share: share, next_wave_score: 1, sites: 20, sample: { q: "2026Q4", n: 30, s: share } });
const sites = (keys: string[]): SiteNow[] => ["media", "dev-tools"].flatMap(s => Array.from({ length: 30 }, (_, i) => ({ domain: `${s}${i}.com`, name: null, sector: s, captured: "2026-11-21T00:00:00Z", traits: i < 7 ? keys : [] })));
const input = (runs: BuildInput["runs"], keys = KEYS): BuildInput => ({ now: NOW, events: [], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], sites: sites(keys), runs });
const realRuns = () => [
  { id: 13, at: "2026-11-15T15:33:42Z", rows: KEYS.flatMap(k => [stored(13, k, "all"), stored(13, k, "media"), lead(k, 0.4)]) },
  { id: 16, at: "2026-11-22T09:30:41Z", rows: KEYS.flatMap(k => [stored(16, k, "all"), stored(16, k, "media"), lead(k, 0.43)]) },
];

describe("P2b · a crossover must be new to the sector", () => {
  it("the rule's numbers: well read at 15 homepages, the floor at 10%, the last 12 stored quarters", () => {
    expect(READ_GROWTH_MIN_BASE).toBe(15); expect(CROSSOVER_FLOOR).toBe(0.1); expect(CROSSOVER_HISTORY_QUARTERS).toBe(12);
    expect(ALREADY_THERE_REASON).toBe("already there, not a crossover"); expect(NO_EARLIER_READING_REASON).toBe("no earlier reading to compare");
  });
  it("the stored counts are 24 media homepages read in run 13 and 28 in run 16, so the 80% rule passes both", () => {
    for (const k of KEYS) { expect((stored(13, k, "media").sample as { n: number }).n).toBe(24); expect((stored(16, k, "media").sample as { n: number }).n).toBe(28); }
    expect(MORE_READ_EXAMPLES.map(e => [e.earlier, e.later, e.reason])).toEqual([[24, 28, ALREADY_THERE_REASON], [24, 28, ALREADY_THERE_REASON]]);
  });
  it("split, text left in media is refused from run 16's own quarters: 18.5% of 27 in 2026 Q1", () => {
    const h = sectorHistory(stored(16, KEYS[0]!, "media").quarters);
    expect(h).toMatchObject({ ok: false, reason: ALREADY_THERE_REASON, quarter: { q: "2026Q1", n: 27 } });
    expect(!h.ok && h.quarter!.s).toBeCloseTo(5 / 27, 6);
  });
  it("calm voice in media is refused from run 16's own quarters: 11.1% of 27 in 2026 Q1", () => {
    const h = sectorHistory(stored(16, KEYS[1]!, "media").quarters);
    expect(h).toMatchObject({ ok: false, reason: ALREADY_THERE_REASON, quarter: { q: "2026Q1", n: 27 } });
    expect(!h.ok && h.quarter!.s).toBeCloseTo(3 / 27, 6);
  });
  it("from their stored rows the engine builds neither story and records both as already there", () => {
    const ctx = context(input(realRuns())), notNew: NotNew[] = [];
    expect(crossoverQuarterNeeds(ctx).map(n => `${n.key}|${n.scope}|${n.run}`).sort()).toEqual(KEYS.map(k => `${k}|media|16`).sort());
    expect(crossoverCandidates(ctx, [], notNew).map(c => c.id)).toEqual([]);
    expect(notNew.map(n => n.id).sort()).toEqual(MORE_READ_EXAMPLES.map(e => e.id).slice().sort());
    expect(notNew.every(n => n.reason === ALREADY_THERE_REASON && n.quarter?.q === "2026Q1" && n.quarter.read === 27)).toBe(true);
    const all = allCandidates(input(realRuns()));
    expect(all.candidates.some(c => c.type === "crossover")).toBe(false);
    expect(all.notNew?.map(n => n.id).sort()).toEqual(MORE_READ_EXAMPLES.map(e => e.id).slice().sort());
  });

  // Made-up rows: a signal below the floor in every well-read earlier quarter, at 17% now.
  const KEY = "imagery:data_viz";
  const madeUp = (quarters: unknown) => input([
    { id: 13, at: "2026-11-15T15:33:42Z", rows: [{ ...lead(KEY, 0.2), scope: "all" }, { ...lead(KEY, 0.04), scope: "media", sample: { q: "2026Q4", n: 26, s: 0.04 } }, lead(KEY, 0.4)] },
    { id: 16, at: "2026-11-22T09:30:41Z", rows: [{ ...lead(KEY, 0.22), scope: "all" }, { ...lead(KEY, 0.17), scope: "media", sample: { q: "2026Q4", n: 30, s: 0.17 }, quarters }, lead(KEY, 0.43)] },
  ], [KEY]);
  const below = [{ q: "2024Q1", n: 25, s: 0.08 }, { q: "2024Q2", n: 3, s: 0.67 }, { q: "2025Q1", n: 25, s: 0.04 }, { q: "2025Q4", n: 3, s: 0.33 }, { q: "2026Q1", n: 25, s: 0.04 }, { q: "2026Q2", n: 1, s: 0 }, { q: "2026Q3", n: 0, s: null }, { q: "2026Q4", n: 30, s: 0.17 }];
  it("a signal below the floor in every well-read earlier quarter and at 17% now is built and quotes its own earlier quarter", () => {
    const [c] = crossoverCandidates(context(madeUp(below)));
    expect(c?.id).toBe(`crossover:${KEY}:media:16`);
    expect(c!.deck).toContain("it now sits on 17.0% of media homepages, up from 4.0% in 2026 Q1.");
    expect(c!.deck).not.toContain("run 13");
    const line = c!.facts.find(f => f.text.startsWith("Media:"))!.text;
    expect(line).toBe("Media: 4.0% of 25 homepages read in 2026 Q1 → 17.0% of 30 in 2026 Q4 (forecast run 16)");
    expect(c!.facts.some(f => /run 13/.test(f.text))).toBe(false);
  });
  it("a quarter read on fewer than 15 homepages never counts, either way", () => {
    // the 2024 Q2 (67% of 3) and 2025 Q4 (33% of 3) readings are thin and do not refuse it
    expect(sectorHistory(below)).toMatchObject({ ok: true, earlier: { q: "2026Q1", n: 25, s: 0.04 } });
  });
  it("only the last 12 stored quarters count", () => {
    const old = [{ q: "2021Q1", n: 25, s: 0.3 }, ...Array.from({ length: 11 }, (_, i) => ({ q: `20${22 + Math.floor(i / 4)}Q${(i % 4) + 1}`, n: 25, s: 0.02 })), { q: "2026Q4", n: 30, s: 0.17 }];
    expect(sectorHistory(old).ok).toBe(true);
    expect(sectorHistory(old.slice(0, 1).concat(old.slice(2))).ok).toBe(false);
  });
  it("a signal with no well-read earlier quarter is not built", () => {
    const thin = [{ q: "2025Q4", n: 3, s: 0 }, { q: "2026Q1", n: 14, s: 0.07 }, { q: "2026Q4", n: 30, s: 0.17 }];
    const notNew: NotNew[] = [];
    expect(crossoverCandidates(context(madeUp(thin)), [], notNew)).toEqual([]);
    expect(notNew).toEqual([{ id: `crossover:${KEY}:media:16`, reason: NO_EARLIER_READING_REASON, quarter: null }]);
    // and a row whose quarters were never read fails closed the same way
    expect(sectorHistory(undefined)).toEqual({ ok: false, reason: NO_EARLIER_READING_REASON, quarter: null });
  });
  it("quarters are named for readers", () => { expect(quarterName("2026Q1")).toBe("2026 Q1"); });
});
