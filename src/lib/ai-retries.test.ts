import { describe, expect, it } from "vitest";
import { RETRIES, retryGuard, structuredAttempts } from "./ai-retries";
import { spentOn } from "./digest/writer.server";

describe("T2 · one retry table", () => {
  it("allows at most one retry for a structured-output failure and none for a refusal, for every kind", () => {
    for (const r of Object.values(RETRIES)) { expect(r.structured).toBeLessThanOrEqual(1); expect(r.refusal).toBe(0); }
  });
  it("the library text reads and the brief get one retry; the desks, picture reads and headline calls none", () => {
    expect(["pricing", "changelog", "product", "brief", "writer"].map(k => structuredAttempts(k as never))).toEqual([2, 2, 2, 2, 2]);
    expect(["vision", "desk", "desk_vision", "headline"].map(k => structuredAttempts(k as never))).toEqual([1, 1, 1, 1]);
  });
  it("the writer guard stops after two unusable answers or one refusal, and lets a parsed answer that broke a rule through", async () => {
    const parse = (raw: unknown) => (typeof raw === "string" && raw.startsWith("{") ? raw : null);
    const a = retryGuard("writer", parse);
    await a.call(Promise.resolve({ raw: "nope", cost: 0 })); expect(a.open()).toBe(true);
    await a.call(Promise.resolve({ raw: "nope", cost: 0 })); expect(a.open()).toBe(false);
    const b = retryGuard("writer", parse); await b.call(Promise.resolve({ raw: null, cost: 0, refused: true })); expect(b.open()).toBe(false);
    const c = retryGuard("writer", parse); await c.call(Promise.resolve({ raw: "{}", cost: 0 })); await c.call(Promise.resolve({ raw: "{}", cost: 0 })); expect(c.open()).toBe(true);
  });
  it("a Digest sheet whose two answers were unusable is spent: no third call on a later run", () => {
    const m = { week: "2026-W46", facts_hash: "h", attempts: 2, created_at: "2026-11-23T10:00:00Z", passed: false, log: [{ model: "a", failures: ["no usable answer"] }, { model: "a", failures: ["no usable answer"] }] };
    expect(spentOn([m as never], "2026-W46", "h")).toBe(3);
    expect(spentOn([{ ...m, log: [{ model: "a", failures: ["headline has a colon"] }] } as never], "2026-W46", "h")).toBe(2);
  });
});
