import { describe, expect, it } from "vitest";
import { MEASURES, PAGE_MEASURE_IDS, designText, measuresSchema, runDiff, type ReviewRow } from "./design-review";

describe("C1b · the review's optional instance age", () => {
  it("accepts whole seconds from 0 to 86,400, and its absence", () => {
    for (const v of [0, 1, 86_400]) expect(measuresSchema.safeParse({ instance_age_s: v }).success).toBe(true);
    for (const v of [-1, 86_401, 1.5]) expect(measuresSchema.safeParse({ instance_age_s: v }).success).toBe(false);
    expect(measuresSchema.safeParse({ first_byte_ms: 400 }).success).toBe(true);
    expect(MEASURES.instance_age_s.unit).toBe("s");
  });
  it("is not a page difference and is never sent to the design call", () => {
    const row = (run: string, age: number): ReviewRow => ({ id: 1, at: "2026-11-23T18:00:00Z", run, kind: "weekly", page: "front", path: "/", width: 1440, against: null, measures: { first_byte_ms: 400, instance_age_s: age }, picture: null });
    expect(runDiff([row("b", 0)], [row("a", 300)])).toEqual([]);
    expect(PAGE_MEASURE_IDS).not.toContain("instance_age_s");
    const text = designText({ page: "front", path: "/", widths: [{ width: 1440, now: { first_byte_ms: 400, instance_age_s: 0 }, last: { instance_age_s: 12 } }], register: [] });
    expect(text).not.toContain("instance_age_s");
    expect(text).toContain("first_byte_ms");
  });
});
