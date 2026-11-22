// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assemble, noEditionNote, readingLine, readingSignals, type DeskMove, type ReadingSignal } from "./reading";
import { dryRun, type LeadingRow } from "./rules";
import { BASELINE } from "./settings";
import { LIVE_VALUES } from "./editions";
import { runReading } from "./reading.server";

const NOW = "2026-11-22T21:00:00Z";
const desk = (item: number, setting: string, to: unknown, o: Partial<DeskMove> = {}): DeskMove => ({ item, log: item + 300, at: "2026-11-20T09:00:00Z", setting, from: (LIVE_VALUES as Record<string, unknown>)[setting] as never, to: to as never, status: "queued", test: false, title: `${setting} move`, ...o });
const sig = (setting: "radius" | "tracking" | "density", outcome: ReadingSignal["outcome"], to: number | null): ReadingSignal => ({ signal: setting === "radius" ? "pill_buttons" : setting === "tracking" ? "tight_headlines" : "generous_whitespace", setting, count: 20, base: 25, share: 0.8, rule: "rule", outcome, from: BASELINE[setting], to });
// Six setting moves that are each in range and one step from the live values.
const SIX = [desk(1, "radius", 2), desk(2, "tracking", -0.005), desk(3, "density", 4.25), desk(4, "motion", 260), desk(5, "chart", 1.125), desk(6, "density", 3.75, { at: "2026-11-19T09:00:00Z" }), desk(7, "covers", ["card", "chart", "mosaic"])];

describe("L3 · assembling a proposed edition", () => {
  it("0 ready: no edition, and the reading says why", () => {
    const a = assemble({ live: LIVE_VALUES, signals: [], desk: [], now: NOW });
    expect(a).toMatchObject({ moves: [], ready: 0, edition: false });
    expect(noEditionNote(a.ready)).toBe("No edition this month: 0 moves ready, an edition needs three.");
  });
  it("2 ready: no edition", () => {
    const a = assemble({ live: LIVE_VALUES, signals: [], desk: SIX.slice(0, 2), now: NOW });
    expect(a.edition).toBe(false); expect(a.ready).toBe(2);
    expect(noEditionNote(2)).toBe("No edition this month: 2 moves ready, an edition needs three.");
  });
  it("3 ready: an edition, rule moves first, then the desk's moves newest first", () => {
    const a = assemble({ live: LIVE_VALUES, signals: [sig("radius", "one step up", 2)], desk: [desk(2, "tracking", -0.005, { at: "2026-11-18T00:00:00Z" }), desk(3, "density", 4.25)], now: NOW });
    expect(a.edition).toBe(true);
    expect(a.moves.map(m => m.setting)).toEqual(["radius", "density", "tracking"]);
    expect(a.moves[0]).toMatchObject({ signal: "pill_buttons", count: 20, base: 25 });
    expect(a.moves[1]!.rule).toMatch(/^Design review proposal \(queue item 3, desk log 303\)/);
  });
  it("6 ready: five at most, the rest left out", () => {
    const a = assemble({ live: LIVE_VALUES, signals: [], desk: SIX, now: NOW });
    expect(a.ready).toBe(6);
    expect(a.moves).toHaveLength(5);
    expect(a.left.some(l => /over the 5 moves/.test(l.why))).toBe(true);
  });
  it("two moves on one setting: only the first (rule before desk; newer desk before older)", () => {
    const a = assemble({ live: LIVE_VALUES, signals: [sig("density", "one step up", 4.25)], desk: [desk(3, "density", 3.75)], now: NOW });
    expect(a.moves.map(m => [m.setting, m.to])).toEqual([["density", 4.25]]);
    expect(a.left).toEqual([{ setting: "density", why: "another move on the same setting comes first", item: 3 }]);
    const b = assemble({ live: LIVE_VALUES, signals: [], desk: [desk(3, "density", 4.25, { at: "2026-11-21T00:00:00Z" }), desk(6, "density", 3.75, { at: "2026-11-19T00:00:00Z" })], now: NOW });
    expect(b.moves.map(m => m.to)).toEqual([4.25]);
  });
  it("a move out of range or two steps away is left out; so are closed, old and test moves", () => {
    const a = assemble({ live: LIVE_VALUES, now: NOW, signals: [], desk: [desk(1, "radius", 6), desk(2, "density", 4.5), desk(3, "tracking", -0.005, { status: "declined" }), desk(4, "motion", 260, { at: "2026-10-01T00:00:00Z" }), desk(5, "chart", 1.125, { test: true }), desk(9, "nonsense", 1)] });
    expect(a.moves).toEqual([]);
    expect(a.left.map(l => l.why)).toEqual(expect.arrayContaining(["6 px is outside its range", "2 steps from the live value", "no longer open (declined)", "older than 5 weeks", "a test item, not a real proposal", "not a register setting"]));
  });
});

describe("L3 · the reading", () => {
  // Today's leading group, as the brief states it: pill buttons 10 of 19, tight headlines 8 of 23, generous whitespace 11 of 30.
  const rows: LeadingRow[] = Array.from({ length: 30 }, (_, k) => ({ domain: `b${k}.com`, rank: k + 1, captured_at: NOW,
    cta_radius_bucket: k < 19 ? (k < 10 ? "pill" : "square") : null, h1_tracking: k < 23 ? (k < 8 ? -0.03 : 0) : null, whitespace_ratio: k < 11 ? 0.7 : 0.4 }));
  it("prints November's line from the stored numbers", () => {
    const s = readingSignals(dryRun(LIVE_VALUES, rows).rows);
    expect(s.map(x => [x.signal, x.count, x.base, x.outcome])).toEqual([["pill_buttons", 10, 19, "no move"], ["tight_headlines", 8, 23, "no move"], ["generous_whitespace", 11, 30, "no move"]]);
    expect(readingLine({ month: "2026-11", signals: s })).toBe("November 2026: no move. Pill buttons on 10 of 19 leading brands measured (53%); the line is 60%. Tight headline spacing on 8 of 23 (35%). Generous whitespace on 11 of 30 (37%).");
  });
  it("names the outcomes: too few measured, and a step", () => {
    const s = readingSignals(dryRun(LIVE_VALUES, rows.map((r, k) => ({ ...r, cta_radius_bucket: k < 10 ? "pill" : null, h1_tracking: k < 20 ? -0.03 : 0 }))).rows);
    expect(s.map(x => x.outcome)).toEqual(["too few measured", "one step down", "no move"]);
  });
  it("a second reading in the same month is refused (fake store; nothing written)", async () => {
    const inserts: unknown[] = [];
    const db = { from: (t: string) => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: t === "living_readings" ? [{ id: 1 }] : [], error: null }) }) }), insert: async (x: unknown) => { inserts.push(x); return { error: null }; } }) };
    expect(await runReading(db as never, { now: NOW })).toEqual({ ok: false, refused: "A reading for November 2026 is already stored; one reading a month." });
    expect(inserts).toEqual([]);
  });
});
