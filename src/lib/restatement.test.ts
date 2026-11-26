import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { alertAllowed, comparable, isRestatement, restatedIn, restatedLine, tierBasis } from "./restatement";
import { alertBaseline, comparisonPair, gapChain, readerRuns } from "./run-gap";

const wk = (i: number) => new Date(Date.UTC(2026, 10, 1 + 7 * i)).toISOString();
const old = [1, 2, 3].map(i => ({ id: i, at: wk(i), step: null }));
const after = { id: 4, at: wk(4), step: 1 };

describe("R2b · runs on different panels are never compared", () => {
  it("comparable only on the same step; legacy runs (no step) compare with each other", () => {
    expect(comparable({ id: 1 }, { id: 2, step: null })).toBe(true);
    expect(comparable({ id: 1, step: null }, { id: 2, step: 1 })).toBe(false);
    expect(isRestatement(after, old[2])).toBe(true);
  });
  it("comparisonPair, gapChain, alertBaseline and readerRuns find no partner for the first run after a step", () => {
    expect(comparisonPair([...old, after])).toBeNull();
    expect(gapChain([...old, after]).map(r => r.id)).toEqual([4]);
    expect(alertBaseline(old, after)).toBeNull();
    expect(readerRuns([...old, after], [...old, after]).prev).toEqual([]);
  });
  it("the next run on the new panel compares with the restatement run", () => {
    const next = { id: 5, at: wk(5), step: 1 };
    expect(comparisonPair([...old, after, next])?.earlier.id).toBe(4);
  });
  it("tiers hold on the restatement run: the previous run judges them", () => {
    const t = tierBasis([...old, after]);
    expect(t.held).toBe(true); expect(t.basis?.id).toBe(3); expect(t.prior.map(r => r.id)).toEqual([2, 1]);
    const t2 = tierBasis([...old, after, { id: 5, at: wk(5), step: 1 }]);
    expect(t2.held).toBe(false); expect(t2.basis?.id).toBe(5); expect(t2.prior.map(r => r.id)).toEqual([4]);
  });
  it("breakout, crossover and saturation alerts are not raised on a restatement run; sentiment still is", () => {
    expect(alertAllowed("breakout", true)).toBe(false);
    expect(alertAllowed("saturation", true)).toBe(false);
    expect(alertAllowed("sentiment_turn", true)).toBe(true);
    expect(restatedIn([...old, after], 4)).toBe(true);
    expect(restatedIn([...old, after], 3)).toBe(false);
  });
  it("the reader line shows for 14 days after the step, with both counts", () => {
    const step = { at: "2026-11-29T03:00:00Z", brands_before: 300, brands_after: 476 };
    expect(restatedLine(step, Date.parse("2026-11-30T00:00:00Z"))).toBe("Restated on 29 November 2026: slug now reads 476 homepages, up from 300. Every quarter was recomputed, so this week's movement is not compared with last week's.");
    expect(restatedLine(step, Date.parse("2026-12-14T00:00:00Z"))).toBeNull();
  });
});

// Every file that compares one forecast run with another must go through the panel rule (restatement.ts directly, or run-gap.ts,
// whose comparisonPair / gapChain / alertBaseline / readerRuns apply it). A new comparison that does neither fails here.
const CROSS_RUN = /prevStages|stageChanges\(|\.lt\("id", runId\)|prevRunId|prev_runs|runs\.at\(-2\)/;
const THROUGH = /from "\.{1,2}\/(?:\.\.\/)?(?:restatement|run-gap|real-runs)"|import\("\.{1,2}\/(?:restatement|run-gap|real-runs)"\)|loadSignalSnapshot|snapshot\(|tiersFrom\(snap/;
const PURE_OK = new Set(["src/lib/today.ts", "src/lib/tiers.ts", "src/lib/signals.ts", "src/lib/digest/issue.ts", "src/lib/signal-pack.ts", "src/lib/restatement.ts", "src/lib/run-gap.ts"]);
function walk(d: string, out: string[] = []) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$|\.gen\.ts$|types\.ts$/.test(f)) out.push(p); } return out; }
describe("R2b · every cross-run comparison goes through the panel rule", () => {
  it("no file compares runs without restatement.ts or run-gap.ts", () => {
    const bad = walk("src").filter(p => !PURE_OK.has(p) && !p.includes("__fixtures__")).filter(p => { const s = readFileSync(p, "utf8"); return CROSS_RUN.test(s) && !THROUGH.test(s); });
    expect(bad).toEqual([]);
  });
});

import { notReadyByReason, panelRecordKey, markedAt } from "./panel";
describe("R2b · the dry step tells engineering why, and a real step marks brand lists", () => {
  it("groups not-ready brands by reason with counts, examples and quarters", () => {
    const g = notReadyByReason([
      { domain: "b.com", missing: ["live home captures are not more than 24 hours apart"] },
      { domain: "a.com", missing: ["live home captures are not more than 24 hours apart", "archive quarters not settled: 2022Q1, 2023Q1"] },
      { domain: "c.com", missing: ["latest live capture does not read clearly"] },
    ]);
    expect(g[0]).toEqual({ reason: "second live reading less than a day after the first", count: 2, examples: ["a.com", "b.com"] });
    expect(g.find(x => x.reason === "yearly archive quarter not settled")?.quarters).toEqual(["2022Q1", "2023Q1"]);
    expect(g.find(x => x.reason === "latest reading unclear")?.count).toBe(1);
    expect(notReadyByReason(Array.from({ length: 30 }, (_, i) => ({ domain: `d${i}.com`, missing: ["latest live capture does not read clearly"] })))[0]!.examples).toHaveLength(20);
  });
  it("marks brand lists, not brand cards; a marked record is past its interval", () => {
    expect(panelRecordKey("brands-index")).toBe(true);
    expect(panelRecordKey("collection:x:1")).toBe(true);
    expect(panelRecordKey("brand-card:a.com")).toBe(false);
    expect(Date.parse(markedAt(900_000, 1e12))).toBe(1e12 - 901_000);
  });
});
