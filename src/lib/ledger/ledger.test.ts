// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCall, callSentence, direction, firstStands, callKey, ledgerItem, ledgerSummary, nonFatal, resolveCall, resolvesOn, selectCalls, asOf, backtestOf, LEDGER_RULE, LEDGER_RULE_TEXT, MIN_RATE_N, type CallRecord, type LedgerRow, type StoredCall } from "./ledger";
import { gate, sha256Hex } from "../gate";
import { createRateLimiter } from "../mcp/rate-limit";

const q = (qq: string, s: number, n = 40, c = 0.9) => ({ q: qq, s, n, c });
const row = (trait: string, over: Partial<LedgerRow> = {}): LedgerRow => {
  const [dimension, ...v] = trait.split(":");
  return { dimension: dimension!, value: v.join(":"), scope: "all", status: "ok", stage: "accelerating", current_share: 0.12, momentum: 1.5, next_wave_score: 0.5,
    quarters: [q("2026Q1", 0.08), q("2026Q2", 0.09), q("2026Q3", 0.1), q("2026Q4", 0.12)], proj_q1: 0.14, proj_q1_lo: 0.125, proj_q1_hi: 0.17, ...over };
};
const ctx = { run_id: 13, made_at: "2026-11-15T15:33:42Z", data_through: "2026Q4", backfilled: false };
const open = (over: Partial<CallRecord> = {}): CallRecord => ({ ...buildCall({ trait: "css:subgrid", scope: "all", origin: "weekly", selected_by: ["top20"] }, row("css:subgrid"), ctx), ...over });
const at = (iso: string) => new Date(iso);

describe("ledger selection rule (LEDGER_RULE)", () => {
  it("records every brief-named trait, every emitted alert in its own scope and the top 20 next-wave scores in 'all', merged per trait×scope", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ dimension: "css", value: `t${String(i).padStart(2, "0")}`, scope: "all", next_wave_score: 30 - i }))
      .concat([{ dimension: "theme", value: "dark", scope: "all", next_wave_score: null as unknown as number }]);
    const brief = { watch: { id: "theme:dark:all" }, sections: [{ citations: [{ kind: "forecast", id: "css:t00:all" }, { kind: "event", id: "7" }, { kind: "forecast", id: "css:t29:all" }] }] };
    const alerts = [{ ref: "css:t05", url: "https://x/?panel=brief&trait=css%3At05&sector=fintech&alert=13-breakout" }, { ref: "css:t01", url: "https://x/?trait=css%3At01&sector=all&alert=13-saturation" }];
    const sel = selectCalls({ brief, alerts, rows });
    expect(LEDGER_RULE.topNextWave).toBe(20);
    const key = (t: string, s = "all") => sel.find(x => x.trait === t && x.scope === s);
    expect(key("theme:dark")).toMatchObject({ origin: "weekly", selected_by: ["brief"] });
    expect(key("css:t29")).toMatchObject({ selected_by: ["brief"] }); // rank 30, named by the brief → recorded anyway
    expect(key("css:t05", "fintech")).toMatchObject({ origin: "alert", selected_by: ["alert"] });
    expect(key("css:t01")).toMatchObject({ origin: "alert", selected_by: ["alert", "top20"] });
    expect(key("css:t00")).toMatchObject({ origin: "weekly", selected_by: ["brief", "top20"] });
    expect(sel.filter(x => x.selected_by.includes("top20")).map(x => x.trait)).toEqual(Array.from({ length: 20 }, (_, i) => `css:t${String(i).padStart(2, "0")}`));
    expect(key("css:t20")).toBeUndefined();
    expect(sel.length).toBe(20 + 3); // top 20 + theme:dark + css:t29 + fintech alert
  });
  it("records a call with no band as void at call time (no cherry-picking), and marks backfilled calls", () => {
    const c = buildCall({ trait: "css:subgrid", scope: "all", origin: "weekly", selected_by: ["brief"] }, row("css:subgrid", { status: "insufficient_data", proj_q1: null }), { ...ctx, backfilled: true });
    expect(c).toMatchObject({ outcome: "void", backfilled: true, direction: null, target_quarter: null });
    expect(c.outcome_reason).toMatch(/fewer than four usable quarters/);
    expect(open()).toMatchObject({ week: "2026-W46", direction: "up", band_lo: 0.125, band_mid: 0.14, band_hi: 0.17, horizon_q: 1, target_quarter: "2027Q1", backfilled: false, outcome: null });
  });
  it("uses the model's own dead-band for direction (backtest rule: sign of round(Δ·10⁴))", () => {
    expect(direction(0.00004)).toBe("flat"); expect(direction(-0.00004)).toBe("flat");
    expect(direction(0.00006)).toBe("up"); expect(direction(-0.00006)).toBe("down");
  });
});

describe("first call stands", () => {
  it("drops reruns of the same week, trait and scope, keeping the first stored call", () => {
    const first = open(), rerun = { ...open(), run_id: 14, band_hi: 0.5 }, otherScope = { ...open(), scope: "fintech" };
    expect(firstStands([callKey(first)], [rerun, otherScope])).toEqual([otherScope]);
    expect(firstStands([], [first, rerun])).toEqual([first]);
    expect(firstStands([], [first, { ...first, week: "2026-W47" }]).length).toBe(2);
  });
  it("is backed by an immutable table: unique (week, trait, scope), no updates of call fields, no deletes", () => {
    const sql = readFileSync("drizzle/migrations/0039_forecast_ledger_and_mcp_keys.sql", "utf8");
    expect(sql).toContain("UNIQUE (week, trait, scope)");
    expect(sql).toContain("'call fields are immutable'");
    expect(sql).toContain("BEFORE DELETE ON public.forecast_calls");
    expect(readFileSync("src/lib/ledger/store.server.ts", "utf8")).toContain('onConflict: "week,trait,scope", ignoreDuplicates: true');
  });
});

describe("resolution", () => {
  const done = { now: at("2027-04-04T12:00:00Z"), cutoff: "2027Q2", tracked: true };
  it("stays open until the target quarter has ended AND the data runs past it", () => {
    expect(resolveCall(open(), { ...done, now: at("2027-03-31T23:59:00Z"), point: q("2027Q1", 0.15) })).toBeNull();
    expect(resolveCall(open(), { ...done, cutoff: "2027Q1", point: q("2027Q1", 0.15) })).toBeNull();
    expect(resolveCall(open({ outcome: "hit" }), { ...done, point: q("2027Q1", 0.15) })).toBeNull();
  });
  it("HIT inside the band with the right direction, including both band edges", () => {
    for (const s of [0.15, 0.125, 0.17]) expect(resolveCall(open(), { ...done, point: q("2027Q1", s) })).toMatchObject({ outcome: "hit", actual_share: s, actual_n: 40 });
  });
  it("MISS outside the band, or inside the band with the wrong direction", () => {
    expect(resolveCall(open(), { ...done, point: q("2027Q1", 0.1701) })!.outcome).toBe("miss");
    expect(resolveCall(open(), { ...done, point: q("2027Q1", 0.1249) })!.outcome).toBe("miss");
    const wrongWay = resolveCall(open({ band_lo: 0.1, band_hi: 0.15 }), { ...done, point: q("2027Q1", 0.11) })!;
    expect(wrongWay.outcome).toBe("miss"); expect(wrongWay.outcome_reason).toMatch(/fell when we called up/);
  });
  it("VOID when the trait lost coverage, with the reason stored", () => {
    expect(resolveCall(open(), { ...done, point: q("2027Q1", 0.15, 9) })).toMatchObject({ outcome: "void", outcome_reason: "Lost coverage: only 9 sites measured in Q1 2027 (needs 15)." });
    expect(resolveCall(open({ scope: "fintech" }), { ...done, point: q("2027Q1", 0.15, 9) })!.outcome).toBe("hit"); // sector threshold is 8
    expect(resolveCall(open(), { ...done, point: q("2027Q1", 0.15, 40, 0.2) })!.outcome_reason).toMatch(/archive coverage was 20% .* \(needs 25%\)/);
    expect(resolveCall(open(), { ...done, point: undefined })!.outcome).toBe("void");
    expect(resolveCall(open(), { ...done, tracked: false, point: undefined })!.outcome_reason).toMatch(/dropped out of the forecast/);
  });
});

describe("hit rate", () => {
  const mk = (outcome: CallRecord["outcome"], trait = "css:subgrid", stage = "accelerating") => ({ outcome, trait, stage_at_call: stage, target_quarter: "2027Q1" });
  it("is hits / (hits + misses); void and open are not counted; under 20 it is a sentence, not a percentage", () => {
    const s = ledgerSummary([mk("hit"), mk("hit"), mk("hit"), mk("miss"), mk("void"), mk(null)]);
    expect(s).toMatchObject({ total: 6, hits: 3, misses: 1, voids: 1, open: 1, resolved: 4, rate: null, nextResolution: "2027-04-04" });
    expect(s.headline).toBe("3 of 4 resolved calls landed. Too few to call a rate yet; the first full quarter resolves on 4 April 2027.");
    expect(ledgerSummary([]).headline).toBe("No call has resolved yet. Too few to call a rate yet.");
  });
  it("shows a percentage with n from 20 resolved calls, overall, by dimension and by stage", () => {
    const calls = [...Array(15).fill(0).map(() => mk("hit")), ...Array(5).fill(0).map(() => mk("miss", "theme:dark", "peaking")), mk("void")];
    const s = ledgerSummary(calls);
    expect(MIN_RATE_N).toBe(20);
    expect(s.rate).toBe(0.75); expect(s.headline).toBe("75% of resolved calls landed (15 of 20).");
    expect(s.byDimension.find(g => g.key === "LAYOUT")).toMatchObject({ hits: 15, misses: 0, n: 15, rate: null, text: "15 of 15 landed" });
    expect(s.byDimension.find(g => g.key === "COLOR")).toMatchObject({ hits: 0, misses: 5, n: 5 });
    expect(s.byStage.find(g => g.key === "Rising")).toMatchObject({ hits: 15, n: 15 });
    expect(s.byStage.find(g => g.key === "Peaking")).toMatchObject({ misses: 5 });
  });
  it("old Digest issues see the ledger as it stood: later resolutions count as open", () => {
    const c = [{ made_at: "2026-11-15T00:00:00Z", resolved_at: "2027-04-04T00:00:00Z", outcome: "hit" as const }];
    expect(asOf(c, "2026-11-16T00:00:00Z")[0]!.outcome).toBeNull();
    expect(asOf(c, "2027-04-05T00:00:00Z")[0]!.outcome).toBe("hit");
  });
  it("first Sunday on or after the quarter after the target", () => { expect(resolvesOn("2027Q1")).toBe("2027-04-04"); expect(resolvesOn("2026Q4")).toBe("2027-01-03"); });
});

describe("ledger copy", () => {
  it("says the call in plain words with names from labels.ts and never a $ ticker", () => {
    const c = open();
    expect(callSentence(c)).toBe("Subgrid layouts: rising from 12.0% to 12.5–17.0% of homepages by Q1 2027.");
    expect(callSentence({ ...c, scope: "fintech", direction: "down" })).toMatch(/: falling from .* of fintech homepages by Q1 2027\.$/);
    const stored: StoredCall = { ...c, id: 1 };
    const text = JSON.stringify([ledgerItem(stored), ledgerItem({ ...stored, outcome: "void", outcome_reason: "x", direction: null }), ledgerSummary([c]), LEDGER_RULE_TEXT, backtestOf({ backtest_cutoff: "2025Q2", hit_rate: 0.6, n_backtested: 12, median_mae_pts: 1.2, next_wave_backtest: { ranked: 10, grew_5pts: 3 } })]);
    expect(text).not.toMatch(/\$[A-Z]/);
    expect(ledgerItem(stored)).toMatchObject({ name: "Subgrid layouts", dimension: "LAYOUT", outcome_word: "Open", target_text: "Q1 2027", explainer_path: "/trait/css%3Asubgrid" });
  });
  it("keeps the backtest apart and labelled as a replay", () => {
    expect(backtestOf({ backtest_cutoff: "2025Q2", hit_rate: 0.6, n_backtested: 12, median_mae_pts: 1.2 })!.text).toMatch(/^Trained on data through Q2 2025 and replayed/);
  });
});

describe("the ledger can never fail the forecast run", () => {
  it("nonFatal turns a throw into a reported code", async () => {
    await expect(nonFatal("ledger", async () => { throw new Error("db down"); })).resolves.toEqual({ ok: false, code: "ledger: db down" });
    await expect(nonFatal("ledger", async () => 5)).resolves.toBe(5);
  });
  it("runForecast calls the ledger through nonFatal after the run is stored", () => {
    const src = readFileSync("src/lib/forecast.server.ts", "utf8");
    expect(src).toMatch(/nonFatal\("ledger", async \(\) => \(await import\("\.\/ledger\/store\.server"\)\)\.ledgerStep\(runId\)\)/);
    expect(src.indexOf('nonFatal("ledger"')).toBeGreaterThan(src.indexOf('status: "ok", data_cutoff_quarter'));
  });
});

describe("/ledger", () => {
  it("is behind the site password", async () => {
    const r = await gate(new Request("https://site.test/ledger"), { hash: await sha256Hex("pw"), allow: createRateLimiter(10, 60000) });
    expect(r!.status).toBe(401);
  });
});
