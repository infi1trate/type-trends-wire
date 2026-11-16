// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildCall, ledgerItem, ledgerSummary, LEDGER_RULE } from "@/lib/ledger/ledger";
const call = { ...buildCall({ trait: "css:subgrid", scope: "all", origin: "weekly", selected_by: ["top20"] }, { dimension: "css", value: "subgrid", scope: "all", status: "ok", stage: "accelerating", current_share: 0.12, momentum: 1, next_wave_score: 0.4, quarters: [{ q: "2026Q3", s: 0.1, n: 40, c: 0.9 }, { q: "2026Q4", s: 0.12, n: 40, c: 0.9 }], proj_q1: 0.14, proj_q1_lo: 0.125, proj_q1_hi: 0.17 }, { run_id: 13, made_at: "2026-11-15T15:00:00Z", data_through: "2026Q4", backfilled: true }), id: 7 };
const load = vi.fn(async (_f: unknown) => ({ rule: [...LEDGER_RULE.text], summary: ledgerSummary([call]), matched: 1, calls: [ledgerItem(call)], backtest: { cutoff: "2025Q2", median_mae_pts: 1.2, hit_rate: 0.6, n: 12, next_wave: null, text: "Trained on data through Q2 2025 and replayed." } }));
vi.mock("@/lib/ledger/read.server", () => ({ loadLedger: (f: unknown) => load(f) }));
import { handleMcp } from "./server.server";
const req = (args: unknown) => new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": "ledger-tool" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "forecast_ledger", arguments: args } }) });

describe("MCP forecast_ledger", () => {
  it("passes filters through and returns calls with label, dimension, explainer_url plus the summary and a separate backtest", async () => {
    const res = (await (await handleMcp(req({ trait: "css:subgrid", scope: "all", outcome: "open", since: "2026-11-01", limit: 5 }))).json()).result;
    expect(res.isError).toBeFalsy();
    expect(load).toHaveBeenCalledWith({ trait: "css:subgrid", scope: "all", outcome: "open", since: "2026-11-01T00:00:00Z", limit: 5 });
    const out = JSON.parse(res.content[0].text);
    expect(out.calls[0]).toMatchObject({ trait: "css:subgrid", label: "Subgrid layouts", dimension: "LAYOUT", explainer_url: "https://type-trends-wire.lovable.app/signals/css%3Asubgrid", outcome: "open", target_quarter: "2027Q1", backfilled: true, said: expect.stringMatching(/^Subgrid layouts: rising/) });
    expect(out.summary).toMatchObject({ total: 1, open: 1, rate: null });
    expect(out.backtest.label).toMatch(/not part of the live record/);
    expect(res.content[0].text).not.toMatch(/\$[A-Z]/);
  });
  it("rejects unknown outcomes and undeclared arguments", async () => {
    expect((await (await handleMcp(req({ outcome: "win" }))).json()).result.isError).toBe(true);
    expect((await (await handleMcp(req({ cherry: true }))).json()).result.isError).toBe(true);
  });
});
