import { describe, expect, it } from "vitest";
import { BRAND_NAME, LEGACY_NAMES, deLegacy } from "./brand";
import { issueModel } from "./digest/issue";
import { fixture } from "./digest/__fixtures__/issue-w46";

describe("legacy names are replaced at render time", () => {
  it("every legacy name reads as the product name; other text is untouched", () => {
    expect(deLegacy("WIRE · DSGN/TERMINAL")).toBe(`WIRE · ${BRAND_NAME}`);
    for (const n of LEGACY_NAMES) expect(deLegacy(`via ${n}`)).toBe(`via ${BRAND_NAME}`);
    expect(deLegacy("Nothing to change")).toBe("Nothing to change");
    expect(deLegacy(null)).toBeNull(); expect(deLegacy(undefined)).toBeUndefined();
  });
  it("a stored Digest brief that still says DSGN/TERMINAL renders as slug", () => {
    const f = fixture();
    const brief = f.brief as unknown as { headline: string; sections: { title: string; body: string; citations: { text: string }[] }[] };
    brief.headline = "DSGN/TERMINAL: the week in type";
    if (brief.sections[0]) brief.sections[0].citations = [{ ...brief.sections[0].citations[0]!, text: "WIRE · DSGN/TERMINAL" }];
    const issue = issueModel(f)!;
    const text = JSON.stringify(issue);
    expect(text).not.toContain("DSGN/TERMINAL");
    expect(issue.cover.headline).toBe(`${BRAND_NAME}: the week in type`);
  });
});
