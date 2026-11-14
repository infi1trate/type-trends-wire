import { AI_PRICES, type AiModel, type AiProvider } from "./ai-models";
export type Budget = { scope: "monthly" | "backfill"; cap_usd: number; active: boolean; ends_at: string | null };
// Cost uses the price table of the provider that runs (or ran) the call; caps are provider-independent.
export function estimateCost(usage: { provider?: AiProvider; model: AiModel; input_tokens: number; output_tokens: number }) {
  if (![usage.input_tokens, usage.output_tokens].every(n => Number.isFinite(n) && n >= 0)) throw new Error("Invalid token usage");
  const price = AI_PRICES[usage.provider ?? "lovable"][usage.model];
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1000000;
}
export function canSpend(spentMonth: number, spentBackfill: number, budgets: Budget[], estimate: number, now = new Date()): { ok: boolean; scope: Budget["scope"] | null } {
  if (![spentMonth, spentBackfill, estimate].every(n => Number.isFinite(n) && n >= 0)) return { ok: false, scope: null };
  for (const scope of ["backfill", "monthly"] as const) {
    const budget = budgets.find(b => b.scope === scope);
    if (budget?.active && (budget.ends_at === null || Date.parse(budget.ends_at) > now.getTime()) && (scope === "monthly" ? spentMonth : spentBackfill) + estimate <= budget.cap_usd) return { ok: true, scope };
  }
  return { ok: false, scope: null };
}
