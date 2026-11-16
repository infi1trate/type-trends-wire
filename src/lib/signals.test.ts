import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/trait-keys.json";
import { BASIS_WORD, basis, AI_TAGGED } from "./labels";
import { buildSignals, headlineOnly, ofTier, tiersFrom, type SignalRow } from "./signals";
import { buildToday } from "./today";
import { DEV_RUN, runSteps } from "./forecast-run";
import { pickCard } from "./chart/model";
import { methodologyLines, signalList, JOBS, QUESTIONS } from "./what-we-show";
import { isOpenPath } from "./gate";

const KEYS = (fixture as { keys: string[] }).keys;
const TICKER = /\$[A-Z][A-Z0-9-]+/;
const row = (k: string, o: Partial<SignalRow> = {}): SignalRow => { const [dimension, value] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)]; return { dimension, value, scope: "all", status: "ok", stage: "accelerating", momentum: 2, current_share: 0.2, next_wave_score: 0.5, present: ["gap", "momentum", "corroboration"], sites: 120, usable: 6, ...o }; };
const ROWS = [row("theme:dark", { next_wave_score: 1 }), row("headline:serif", { stage: "flat", momentum: 0.1, next_wave_score: 0 }), row("css:subgrid", { next_wave_score: 2 }), row("tone:playful", { next_wave_score: -1 })];
const PREV = new Map<string, (string | null)[]>([["headline:serif", ["flat", "flat"]]]);

describe("basis", () => {
  it("every fixture key is measured or AI estimate; AI-tagged categories are AI", () => {
    for (const k of KEYS) expect(["measured", "ai"], k).toContain(basis(k));
    for (const c of AI_TAGGED) expect(basis(`${c}:x`), c).toBe("ai");
    expect(basis("theme:dark")).toBe("measured");
    expect(BASIS_WORD).toEqual({ measured: "MEASURED", ai: "AI ESTIMATE" });
  });
});

describe("signals view model", () => {
  const tiers = tiersFrom(ROWS, PREV), sig = buildSignals(ROWS, tiers, "all");
  it("default lists show headline signals only", () => {
    expect(headlineOnly(sig).map(s => s.key).sort()).toEqual(["theme:dark", "tone:playful"]);
    expect(ofTier(sig, "archive").map(s => s.key)).toEqual(["css:subgrid"]);
  });
  it("momentum index ranks among headline + supporting only; archive gets none", () => {
    const by = new Map(sig.map(s => [s.key, s]));
    expect(by.get("theme:dark")!.momentum_index).toBe(100);
    expect(by.get("tone:playful")!.momentum_index).toBe(0);
    expect(by.get("css:subgrid")!.momentum_index).toBeNull();
  });
  it("carries basis, confidence with a reason, and a so-what only on headline", () => {
    const by = new Map(sig.map(s => [s.key, s]));
    expect(by.get("tone:playful")).toMatchObject({ basis: "ai", confidence: "Medium" });
    expect(by.get("theme:dark")!.confidence_reason).toBe("High: 3 of 7 components, 120 sites, 6 quarters");
    expect(by.get("theme:dark")!.so_what).toMatch(/\.$/);
    expect(by.get("headline:serif")!.so_what).toBeNull();
    for (const s of sig) { expect(s.name).not.toMatch(TICKER); expect(s.so_what ?? "").not.toMatch(TICKER); }
  });
});

describe("TODAY obeys tiers", () => {
  it("stage and alert lines are limited to headline signals and the Google Fonts line drops out", () => {
    const t = buildToday({
      now: "2026-11-15T18:00:00Z", runs: { latest: { id: 2, computed_at: "2026-11-15T15:00:00Z" }, previous: { id: 1, computed_at: "2026-11-08T15:00:00Z" } },
      stages: { latest: [{ dimension: "theme", value: "dark", stage: "accelerating", momentum: 2, current_share: 0.3 }, { dimension: "css", value: "subgrid", stage: "peaking", momentum: 3, current_share: 0.2 }], previous: [{ dimension: "theme", value: "dark", stage: "emerging", momentum: 1, current_share: 0.2 }, { dimension: "css", value: "subgrid", stage: "accelerating", momentum: 3, current_share: 0.1 }] },
      alerts: [{ title: "BREAKOUT · Subgrid layouts", url: "u", source: "DSGN/TERMINAL", published_at: "2026-11-15T15:34:00Z", ref: "css:subgrid" }],
      type: null, wire: { count24h: 0, latest: null }, event: null, crawl: null, headline: new Set(["theme:dark"]),
    } as never);
    const text = JSON.stringify(t);
    expect(text).toMatch(/Dark mode/);
    expect(text).not.toMatch(/Subgrid/);
  });
});

describe("chart of the week obeys tiers", () => {
  const q = (n: number) => ({ q: `2026Q${n}`, s: 0.1 * n, n: 100, c: 0.9 });
  const fr = (dimension: string, value: string) => ({ dimension, value, scope: "all", stage: "accelerating", momentum: 2, current_share: 0.3, quarters: [q(1), q(2), q(3)], proj_q1: 0.35, proj_q1_lo: 0.3, proj_q1_hi: 0.4, proj_q2: null, proj_q2_lo: null, proj_q2_hi: null, proj_q4: null, proj_q4_lo: null, proj_q4_hi: null, run_id: 2 });
  const brief = { watch: { id: "css:subgrid:all", call: "Subgrid keeps climbing." } };
  it("skips a non-headline brief call and falls back to the best headline signal", () => {
    const rows = [fr("css", "subgrid"), fr("theme", "dark")] as never;
    expect(pickCard({ week: "2026-W47", run_id: 2, brief, rows, alerts: [], data_through: "2026Q3" } as never)!.trait).toBe("css:subgrid");
    const m = pickCard({ week: "2026-W47", run_id: 2, brief, rows, alerts: [], data_through: "2026Q3", headline: new Set(["theme:dark"]), fallback: ["theme:dark"] } as never)!;
    expect(m.trait).toBe("theme:dark");
    expect(m.call).not.toMatch(TICKER);
  });
});

describe("dev forecast runs", () => {
  it("DEV_RUN skips the brief, alerts, ledger, derived outputs and pruning; defaults keep them on", () => {
    expect(runSteps(DEV_RUN)).toEqual({ brief: false, alerts: "off", ledger: false, derived: false, prune: false });
    expect(runSteps({})).toEqual({ brief: true, alerts: "emit", ledger: true, derived: true, prune: true });
    expect(runSteps({ ledger: false }).ledger).toBe(false);
  });
});

describe("/what-we-show", () => {
  it("is gated like every human page", () => { expect(isOpenPath("/what-we-show")).toBe(false); });
  it("is generated from the tier file: every listed signal has a tier and a reason, no $ tickers", () => {
    const list = signalList(tiersFrom(ROWS, PREV));
    expect(list.length).toBeGreaterThan(100);
    for (const r of list) { expect(r.reasons.length, r.key).toBeGreaterThan(0); expect(r.name).not.toMatch(TICKER); }
    expect(JOBS.map(j => j.word)).toEqual(["Spot", "Prove", "Act"]);
    expect(QUESTIONS).toHaveLength(4);
    const m = methodologyLines();
    expect(m.map(l => l.split(":")[0])).toEqual(["TIERS", "COMPOSITES", "WHERE THINGS LIVE", "MOMENTUM AND CONFIDENCE"]);
    for (const l of m) expect(l).not.toMatch(TICKER);
  });
});
