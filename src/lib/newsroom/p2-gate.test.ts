// P2 · the gate judges first byte, largest paint and layout shift against each page's last five stored runs, with tolerances,
// replayed on gate results 2, 3 and 4's stored inputs (the page reviews of 22 Nov, test runs left out).
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/reviews-2026-11-22.json";
import { gateVerdict, HISTORY_RUNS, middleOf, NOT_CAUSED, SPEED_TOLERANCE, type GateRun } from "./build-gate";
import type { ReviewRow } from "./design-review";
import type { Expects } from "./queue";
import { LIVE_VALUES } from "../living/editions";

const rows = fixture.rows.map(r => ({ ...r, picture: null })) as unknown as ReviewRow[];
const runOf = (run: string): GateRun => { const rs = rows.filter(r => r.run === run); return { run, kind: rs[0]?.kind ?? null, rows: rs }; };
const history = [...new Set(rows.map(r => r.run))].map(runOf);
const replay = (id: number) => {
  const g = fixture.gates.find(x => x.id === id)!;
  return gateVerdict({ item: { kind: g.item!.kind, expects: g.item!.expects as Expects, move: null }, tests: g.tests as { passed: number; failed: number; skipped: number }, before: runOf(g.before_run), after: runOf(g.after_run), history, proposal: null, live: LIVE_VALUES });
};
const failing = (v: ReturnType<typeof replay>) => v.checks.filter(c => !c.ok).map(c => c.id);
const problems = (v: ReturnType<typeof replay>, id: string) => v.checks.find(c => c.id === id)!.problems;
const caused = (v: ReturnType<typeof replay>, m: string) => v.notCaused.filter(n => n.measure === m).map(n => `${n.page}@${n.width}`).sort();

describe("P2 · the gate judges the deploy against history", () => {
  it("the rule's numbers", () => {
    expect(HISTORY_RUNS).toBe(5);
    expect(SPEED_TOLERANCE).toEqual({ first_byte_ms: 150, lcp_ms: 300, cls: 0.02 });
    expect(middleOf([1539, 258, 455, 270, 777])).toBe(455);
    expect(middleOf([0.064, 0.064, 0.062])).toBe(0.064);
    expect(middleOf([0.18, 0.009])).toBeCloseTo(0.0945);
    expect(middleOf([])).toBeNull();
  });
  it("gate result 2 (N5): fails on the terminal's first byte at 768 px (902 ms against 596) and on the signals and brands index shifts", () => {
    const v = replay(2);
    expect(failing(v)).toEqual(["first_byte", "layout_shift"]);
    expect(problems(v, "first_byte")).toEqual(["The terminal at 768 px: first byte 902 ms, over 800 ms and 306 ms worse than the middle of its last 5 runs (596 ms; tolerance 150 ms)."]);
    expect(problems(v, "layout_shift").map(p => p.split(":")[0])).toEqual(["Brands at 1440 px", "Signals at 768 px", "Signals at 390 px"]);
    expect(caused(v, "cls")).toContain("brand@1440");
  });
  it("gate result 3 (L2): fails on the story page's first byte and on the terminal's layout shift at all three widths", () => {
    const v = replay(3);
    expect(failing(v)).toEqual(["first_byte", "layout_shift", "visible"]);
    expect(problems(v, "first_byte")).toEqual(["A story page at 390 px: first byte 955 ms, over 800 ms and 647 ms worse than the middle of its last 5 runs (308 ms; tolerance 150 ms)."]);
    expect(problems(v, "layout_shift").map(p => p.split(":")[0])).toEqual(["A brand page at 768 px", "The terminal at 1440 px", "The terminal at 768 px", "The terminal at 390 px"]);
  });
  it("gate result 4 (L2b): the two failed tests, the terminal's pixel change and its height at 390 px fail; the brand page's layout shift is over target, not caused by this deploy", () => {
    const v = replay(4);
    expect(problems(v, "tests")).toEqual(["2 tests failed."]);
    const vis = problems(v, "visible");
    expect(vis).toContain("The terminal at 390 px: height 2399 → 1779 px, more than 8%.");
    expect(vis.filter(p => p.startsWith("The terminal")).length).toBe(4);
    expect(caused(v, "cls")).toEqual(["brand@1440", "brand@390", "brand@768", "studies@768"]);
    expect(v.notCaused.every(n => n.line.endsWith(`${NOT_CAUSED}.`))).toBe(true);
    expect(v.notCaused.map(n => n.key)).toContain("speed:cls:brand@1440");
    // What the rule as written still fails on today's stored numbers (reported to the owner, not bent to fit):
    expect(failing(v)).toEqual(["tests", "first_byte", "layout_shift", "largest_paint", "visible"]);
    expect(problems(v, "first_byte").map(p => p.split(":")[0])).toEqual(["The front page at 1440 px", "A story page at 1440 px", "A brand page at 1440 px", "A brand page at 390 px"]);
    expect(problems(v, "largest_paint")).toEqual(["The front page at 1440 px: largest paint 2896 ms, over 2500 ms and 1232 ms worse than the middle of its last 5 runs (1664 ms; tolerance 300 ms)."]);
    expect(problems(v, "layout_shift")).toEqual(["The front page at 390 px: layout shift 0.113, over 0.05 and 0.112 worse than the middle of its last 5 runs (0.001; tolerance 0.02)."]);
    expect(vis).toContain("The front page at 390 px: 16% of pixels changed, over 10%.");
  });
  it("only older weekly, before and after runs count; the after run and test runs never do", () => {
    const v = replay(4), fb = v.checks.find(c => c.id === "first_byte")!.numbers["not_caused"] as { runs: string[] }[];
    for (const n of [...v.notCaused, ...fb]) for (const r of n.runs) { expect(r).not.toBe("l2b-after"); expect(r).not.toMatch(/proof/i); }
  });
});
