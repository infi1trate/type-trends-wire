import { describe, it, expect } from "vitest";
import { forecastSeries, fitLogistic, logistic, classifyStage, backtestSeries, qLabel, qIndex, type SeriesPoint } from "./forecast";
import { trendsetterScores, crossingQuarter, nextWaveScores } from "./forecast-signals";
import { LEGACY_NEXT_WAVE_WEIGHTS, NEXT_WAVE_WEIGHTS } from "./forecast-constants";
import { validateBrief } from "./forecast-brief";
const series = (fn: (t: number) => number, n = 12, denom = 100, start = "2021Q1"): SeriesPoint[] => Array.from({ length: n }, (_, t) => ({ quarter: qLabel(qIndex(start) + t), share: fn(t), denom, coverage: 0.8 }));
describe("forecast model", () => {
  it("logistic fit recovers known params", () => {
    const truth = [0.6, 0.9, 6]; const x = Array.from({ length: 12 }, (_, i) => i);
    const p = fitLogistic(x, x.map(t => logistic(truth, t)), x.map(() => 1));
    expect(p[0]).toBeCloseTo(0.6, 1); expect(p[1]).toBeCloseTo(0.9, 1); expect(p[2]).toBeCloseTo(6, 0);
  });
  it("chooses logistic for an S-curve and linear for a line", () => {
    const s = forecastSeries(series(t => logistic([0.6, 0.9, 6], t) + (t % 2 ? 0.004 : -0.004)), "all");
    const l = forecastSeries(series(t => 0.1 + 0.02 * t + (t % 2 ? 0.004 : -0.004)), "all");
    expect(s.status === "ok" && s.model).toBe("logistic"); expect(l.status === "ok" && l.model).toBe("linear");
  });
  it("bootstrap is deterministic and intervals bracket the projection", () => {
    const pts = series(t => 0.1 + 0.02 * t + Math.sin(t) * 0.01);
    const a = forecastSeries(pts, "all"), b = forecastSeries(pts, "all");
    expect(a).toEqual(b);
    if (a.status !== "ok") throw new Error("expected ok");
    for (const p of a.projections) { expect(p.lo).toBeLessThanOrEqual(p.mid + 1e-9); expect(p.hi).toBeGreaterThanOrEqual(p.mid - 1e-9); }
    expect(a.projections.map(p => p.h)).toEqual([1, 2, 4]);
  });
  it("insufficient data when fewer than 4 usable quarters (denom 15 all, 8 sector, coverage .25)", () => {
    const pts = series(t => 0.2, 6).map((p, i) => ({ ...p, denom: i < 3 ? 100 : 14 }));
    expect(forecastSeries(pts, "all").status).toBe("insufficient_data");
    expect(forecastSeries(pts, "saas").status).toBe("ok");
    expect(forecastSeries(pts.map(p => ({ ...p, coverage: 0.2 })), "saas").status).toBe("insufficient_data");
  });
  it("stage rules", () => {
    const x = [0, 1, 2, 3, 4, 5];
    expect(classifyStage("logistic", [0.8, 1, 9], x, 0.03)).toBe("emerging");
    expect(classifyStage("logistic", [0.8, 1, 8], x, 0.2)).toBe("accelerating");
    expect(classifyStage("logistic", [0.6, 1, 2], x, 0.58)).toBe("peaking");
    expect(classifyStage("linear", [0.5, -0.03], x, 0.35)).toBe("declining");
    expect(classifyStage("linear", [0.3, 0], x, 0.3)).toBe("flat");
  });
  it("backtest fits ≤ cutoff and scores later quarters", () => {
    const b = backtestSeries(series(t => 0.1 + 0.02 * t, 20), "all", "2025Q2");
    expect(b.status).toBe("ok"); if (b.status !== "ok") return;
    expect(b.train).toBe(18); expect(b.test).toBe(2); expect(b.predictions[0]!.quarter).toBe("2025Q3");
    expect(b.mae_pts).toBeLessThan(0.5); expect(b.hit_rate).toBe(1);
  });
});
describe("leading indicators", () => {
  it("trendsetter scoring on a toy dataset", () => {
    const row = (domain: string, quarter: string, dark: boolean) => ({ domain, quarter, sector: "saas", theme: dark ? "dark" : "light" });
    const rows = [row("lead.com", "2021Q1", true), row("lead.com", "2021Q2", true), row("lead.com", "2022Q1", true),
      row("late.com", "2021Q1", false), row("late.com", "2022Q1", true), row("late.com", "2022Q2", true),
      row("flash.com", "2021Q1", true), row("flash.com", "2021Q2", false)];
    const s = trendsetterScores(rows, { "theme:dark": "2022Q1" });
    expect(s[0]).toMatchObject({ domain: "lead.com", score: 4 });
    expect(s.find(x => x.domain === "late.com")?.score).toBe(0);
    expect(s.find(x => x.domain === "flash.com")?.score).toBe(0);
  });
  it("lead capped at 8 and crossing requires an earlier point below level", () => {
    const rows = [{ domain: "a.com", quarter: "2018Q1", sector: "x", theme: "dark" }, { domain: "a.com", quarter: "2018Q2", sector: "x", theme: "dark" }];
    expect(trendsetterScores(rows, { "theme:dark": "2024Q1" })[0]!.score).toBe(8);
    expect(crossingQuarter(series(t => 0.3, 6), "all", 0.2)).toBeNull();
    expect(crossingQuarter(series(t => 0.05 * t, 6), "all", 0.2)).toBe("2022Q1");
  });
  it("next-wave score exposes weighted z components", () => {
    const r = nextWaveScores([{ gap: 10, vanguard: null, momentum: 2, corroboration: 0 }, { gap: -10, vanguard: null, momentum: -2, corroboration: 0 }]);
    expect(r[0]!.score).toBeCloseTo(0.5); expect(r[1]!.score).toBeCloseTo(-0.5); expect(r[0]!.z.vanguard).toBeNull(); expect(r[0]!.z.curation).toBeNull();
    const legacy = nextWaveScores([{ gap: 10, momentum: 2 }, { gap: -10, momentum: -2 }], LEGACY_NEXT_WAVE_WEIGHTS);
    expect(legacy[0]!.score).toBeCloseTo(0.65);
  });
  it("uses seven weights summing to 1 and scores curation/discourse/supply", () => {
    expect(Object.values(NEXT_WAVE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Object.keys(NEXT_WAVE_WEIGHTS)).toEqual(["gap", "vanguard", "curation", "momentum", "corroboration", "discourse", "supply"]);
    const r = nextWaveScores([{ curation: 20, discourse: 2, supply: 3 }, { curation: -20, discourse: -2, supply: -3 }]);
    expect(r[0]!.score).toBeCloseTo(0.15 + 0.08 + 0.04);
  });
});
describe("brief citations", () => {
  const base = { week: "2026-W46", headline: "Dark mode refuses to die", caveats: "Archive coverage is thin." };
  const sec = (title: string, body: string, citations: { kind: "forecast" | "event" | "wire" | "spread"; id: string }[]) => ({ title, body, citations });
  const allowed = new Set(["forecast:theme:dark:all", "event:12"]);
  it("drops sections with uncited numbers or unknown citations", () => {
    const r = validateBrief({ ...base, sections: [sec("Rising", "Dark at 41%.", [{ kind: "forecast", id: "theme:dark:all" }]), sec("Peaking", "Serif at 30%.", []), sec("Fading", "Nothing fading.", []), sec("Next wave", "Bento.", []), sec("Notable redesigns", "One at 12.", [{ kind: "event", id: "99" }]), sec("Pricing/product", "Seats up 12.", [{ kind: "event", id: "12" }])] }, allowed);
    expect(r.ok).toBe(true); if (r.ok) expect(r.dropped).toEqual(["Peaking", "Notable redesigns"]);
  });
  it("rejects when fewer than four sections survive", () => {
    expect(validateBrief({ ...base, sections: [sec("Rising", "5 sites", []), sec("Peaking", "6", []), sec("Fading", "x", []), sec("Next wave", "y", [])] }, allowed).ok).toBe(false);
  });
});

import { nextWaveIneligibleReason } from "./forecast-signals";
describe("next-wave eligibility", () => {
  it("excludes mainstream shares at or above 35%", () => { expect(nextWaveIneligibleReason("minimal", 0.614, 50)).toBe("mainstream_share"); expect(nextWaveIneligibleReason("brutalist", 0.35, 10)).toBe("mainstream_share"); });
  it("excludes none, image and *_none values", () => { expect(nextWaveIneligibleReason("image", 0.2, 10)).toBe("non_trait_value"); expect(nextWaveIneligibleReason("none", 0.1, 10)).toBe("non_trait_value"); expect(nextWaveIneligibleReason("ai_positioning_none", 0.1, 10)).toBe("non_trait_value"); });
  it("requires at least 3 sites", () => { expect(nextWaveIneligibleReason("collage", 0.044, 2)).toBe("too_few_sites"); expect(nextWaveIneligibleReason("collage", 0.044, 3)).toBeNull(); });
});
