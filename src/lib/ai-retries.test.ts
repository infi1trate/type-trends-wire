import { describe, expect, it } from "vitest";
import { RETRIES, structuredAttempts } from "./ai-retries";

describe("T2 · one retry table", () => {
  it("allows at most one retry for a structured-output failure and none for a refusal, for every kind", () => {
    for (const r of Object.values(RETRIES)) { expect(r.structured).toBeLessThanOrEqual(1); expect(r.refusal).toBe(0); }
  });
  it("the library text reads and the brief get one retry; the desks, picture reads and headline calls none", () => {
    expect(["pricing", "changelog", "product", "brief", "writer"].map(k => structuredAttempts(k as never))).toEqual([2, 2, 2, 2, 2]);
    expect(["vision", "desk", "desk_vision", "headline"].map(k => structuredAttempts(k as never))).toEqual([1, 1, 1, 1]);
  });
});
