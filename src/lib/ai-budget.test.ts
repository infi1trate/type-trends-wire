import { describe, it, expect } from "vitest";
import { canSpend, estimateCost, type Budget } from "./ai-budget";
import { AI_MODELS } from "./ai-models";
const budgets: Budget[] = [{ scope: "monthly", cap_usd: 50, active: true, ends_at: null }, { scope: "backfill", cap_usd: 100, active: true, ends_at: "2026-12-02T00:00:00Z" }];
const now = new Date("2026-11-11T00:00:00Z");
describe("AI spending", () => {
  it("estimates vision at $0.50 input and $3 output per million", () => expect(estimateCost({ model: AI_MODELS.vision, input_tokens: 1000000, output_tokens: 1000000 })).toBe(3.5));
  it("estimates text at $0.25 input and $1.50 output per million", () => expect(estimateCost({ model: AI_MODELS.text, input_tokens: 1000000, output_tokens: 1000000 })).toBe(1.75));
  it("spends against backfill first", () => expect(canSpend(0, 99, budgets, 1, now)).toEqual({ ok: true, scope: "backfill" }));
  it("falls through to monthly when backfill cannot fit", () => expect(canSpend(49, 100, budgets, 1, now)).toEqual({ ok: true, scope: "monthly" }));
  it("blocks above both exact $50/$100 caps", () => expect(canSpend(50, 100, budgets, 0.01, now).ok).toBe(false));
  it("expires the backfill after 21 days", () => expect(canSpend(50, 0, budgets, 1, new Date("2026-12-02T00:00:00Z")).ok).toBe(false));
  it("blocks inactive budgets", () => expect(canSpend(0, 0, budgets.map(b => ({ ...b, active: false })), 1, now).ok).toBe(false));
  it("rejects negative estimates", () => expect(canSpend(0, 0, budgets, -1, now).ok).toBe(false));
});