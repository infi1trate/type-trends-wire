// P2 · the gate judges first byte, largest paint and layout shift against each page's last five stored runs, with tolerances.
// P2b · first byte and largest paint compare only with after runs measured since the review's browser name was fixed (else the pair rule
// against the gate's own before run); replayed on gate results 2 to 5's stored inputs (the page reviews of 22 Nov, test runs left out).
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/reviews-2026-11-22b.json";
import { AFTER_HISTORY_MIN, AFTER_ONLY, gateVerdict, historyOf, HISTORY_RUNS, middleOf, NOT_CAUSED, REVIEW_NAME_SINCE, SPEED_TOLERANCE, type GateRun } from "./build-gate";
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
  it("P2b · first byte and largest paint read after runs since 19:45 UTC on 22 Nov; layout shift keeps every counted kind", () => {
    expect(REVIEW_NAME_SINCE).toBe("2026-11-22T19:45:00Z");
    expect(AFTER_HISTORY_MIN).toBe(3);
    expect([...AFTER_ONLY]).toEqual(["first_byte_ms", "lcp_ms"]);
  });
  it("gate result 2 (N5): with no after runs since the browser name was fixed, first byte is judged against its own before run", () => {
    const v = replay(2);
    expect(failing(v)).toEqual(["first_byte", "layout_shift"]);
    expect(problems(v, "first_byte")).toEqual(["The terminal at 768 px: first byte 902 ms, over 800 ms and 283 ms worse than the before run (619 ms; tolerance 150 ms)."]);
    expect(problems(v, "layout_shift").map(p => p.split(":")[0])).toEqual(["Brands at 1440 px", "Signals at 768 px", "Signals at 390 px"]);
  });
  it("gate result 3 (L2): fails on the story page's first byte (955 ms against its before run's 382), the terminal's layout shift and visible change", () => {
    const v = replay(3);
    expect(failing(v)).toEqual(["first_byte", "layout_shift", "visible"]);
    expect(problems(v, "first_byte")).toEqual(["A story page at 390 px: first byte 955 ms, over 800 ms and 573 ms worse than the before run (382 ms; tolerance 150 ms)."]);
    expect(problems(v, "layout_shift").map(p => p.split(":")[0])).toEqual(["A brand page at 768 px", "The terminal at 1440 px", "The terminal at 768 px", "The terminal at 390 px"]);
  });
  it("gate result 4 (L2b): the pair rule clears the front page and brand page at 1440 px; two first bytes, the front page's paint and shift at 390 px still fail", () => {
    const v = replay(4);
    expect(failing(v)).toEqual(["tests", "first_byte", "layout_shift", "largest_paint", "visible"]);
    expect(problems(v, "tests")).toEqual(["2 tests failed."]);
    expect(problems(v, "first_byte").map(p => p.split(":")[0])).toEqual(["A story page at 1440 px", "A brand page at 390 px"]);
    expect(caused(v, "first_byte_ms")).toEqual(["brand@1440", "front@1440"]);
    expect(problems(v, "largest_paint")).toEqual(["The front page at 1440 px: largest paint 2896 ms, over 2500 ms and 1268 ms worse than the before run (1628 ms; tolerance 300 ms)."]);
    expect(problems(v, "layout_shift")).toEqual(["The front page at 390 px: layout shift 0.113, over 0.05 and 0.112 worse than the middle of its last 5 runs (0.001; tolerance 0.02)."]);
    const vis = problems(v, "visible");
    expect(vis).toContain("The terminal at 390 px: height 2399 → 1779 px, more than 8%.");
    expect(vis.filter(p => p.startsWith("The terminal")).length).toBe(4);
    expect(caused(v, "cls")).toEqual(["brand@1440", "brand@390", "brand@768", "studies@768"]);
    expect(v.notCaused.every(n => n.line.endsWith(`${NOT_CAUSED}.`))).toBe(true);
  });
  it("gate result 5 (P2) still fails only on visible change, and only for the terminal", () => {
    const v = replay(5);
    expect(failing(v)).toEqual(["visible"]);
    expect(problems(v, "visible").every(p => p.startsWith("The terminal"))).toBe(true);
    expect(problems(v, "visible")).toContain("The terminal at 390 px: height 1779 → 2319 px, more than 8%.");
  });
  it("with three or more after runs since the fix, their middle is the history and the gate's own before run is not in it", () => {
    const run = (name: string, kind: GateRun["kind"], at: string, fb: number): GateRun => ({ run: name, kind, rows: [{ ...rows[0]!, run: name, kind: kind!, at, page: "front", width: 1440, measures: { first_byte_ms: fb } } as never] });
    const after = run("x-after", "after", "2026-11-25T12:00:00Z", 900), before = run("x-before", "before", "2026-11-25T11:50:00Z", 200);
    const hist = [run("old-after", "after", "2026-11-22T16:13:00Z", 2000), run("a1", "after", "2026-11-23T12:00:00Z", 800), run("a2", "after", "2026-11-24T12:00:00Z", 820), run("w", "weekly", "2026-11-24T13:00:00Z", 100), before, after];
    expect(historyOf("front", 1440, "first_byte_ms", after, hist, before)).toEqual({ values: [200], runs: ["x-before"], pair: true });
    const more = [...hist, run("a3", "after", "2026-11-25T08:00:00Z", 810)];
    expect(historyOf("front", 1440, "first_byte_ms", after, more, before)).toEqual({ values: [810, 820, 800], runs: ["a3", "a2", "a1"], pair: false });
    expect(historyOf("front", 1440, "cls", after, more.map(h => ({ ...h, rows: h.rows.map(r => ({ ...r, measures: { cls: 0.01 } })) })), before).runs).toEqual(["x-before", "a3", "w", "a2", "a1"]);
  });
  it("only older counted runs make a history; the after run and test runs never do", () => {
    for (const id of [4, 5]) {
      const v = replay(id), g = fixture.gates.find(x => x.id === id)!;
      for (const c of v.checks) for (const n of (c.numbers["not_caused"] as { runs: string[] }[] | undefined) ?? []) for (const r of n.runs) { expect(r).not.toBe(g.after_run); expect(r).not.toMatch(/proof/i); }
    }
  });
});
