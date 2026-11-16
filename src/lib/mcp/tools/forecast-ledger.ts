import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SITE_URL } from "@/lib/site";
import { explainerUrl } from "@/lib/labels";
import { json, READ } from "./shared";
import { BRAND_NAME } from "../../brand";
export default defineTool({
  name: "forecast_ledger", title: "Forecast ledger",
  description: `The durable, immutable record of ${BRAND_NAME}'s forecast calls and how they resolved (hit, miss, void or still open), plus the live hit rate with n. Filter by trait, scope, outcome or since. The backtest (history replay) is returned separately and is never part of the live hit rate. Each call keeps its stable trait key and adds label, dimension and explainer_url.`,
  inputSchema: {
    trait: z.string().min(3).max(120).optional().describe("Trait key such as css:subgrid."),
    scope: z.string().min(1).max(40).optional().describe("all or a sector, e.g. fintech."),
    outcome: z.enum(["open", "hit", "miss", "void"]).optional().describe("Only calls with this outcome."),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional().describe("Only calls made on or after this date (UTC)."),
    limit: z.number().int().min(1).max(200).optional().describe("Most calls to return (default 50)."),
  },
  annotations: { ...READ, idempotentHint: true },
  handler: async ({ trait, scope, outcome, since, limit }) => {
    const { loadLedger } = await import("@/lib/ledger/read.server");
    const l = await loadLedger({ trait, scope, outcome, since: since ? `${since}T00:00:00Z` : undefined, limit: limit ?? 50 });
    return json({
      rule: l.rule, summary: l.summary, matched: l.matched,
      calls: l.calls.map(c => ({ id: c.id, week: c.week, made_at: c.made_at, trait: c.trait, scope: c.scope, origin: c.origin, selected_by: c.selected_by, stage: c.stage_at_call, said: c.said, direction: c.direction, share_at_call: c.share_at_call, band: c.band, target_quarter: c.target_quarter, resolves_on: c.resolves_on, outcome: c.outcome ?? "open", outcome_reason: c.outcome_reason, actual_share: c.actual_share, actual_n: c.actual_n, resolved_at: c.resolved_at, backfilled: c.backfilled, explainer_url: explainerUrl(c.trait), receipt: `${SITE_URL}${c.receipts_path}` })),
      backtest: l.backtest ? { label: "Backtest (history replay) — not part of the live record", ...l.backtest } : null,
      receipts: { ledger: `${SITE_URL}/ledger`, method: "trend://methodology#LEDGER" },
    });
  },
});
