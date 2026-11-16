import { describe, expect, it } from "vitest";
import { auditModel } from "./audit";
import { auditFixture } from "./test-fixtures";
import { auditFindings, reportFigure, OPEN_MAX, FINDINGS_PER_SITE } from "./report";

describe("audit report", () => {
  const a = auditModel(auditFixture());
  it("the cover figure counts open signals none of the sites use", () => {
    const f = reportFigure(a);
    expect(f.value).toBe(String(a.whitespace?.traits.length ?? 0));
    expect(f.caption).toContain(`these ${a.domains.length} sites`);
  });
  it("every finding carries a basis mark and a receipt, within the caps", () => {
    const xs = auditFindings(a);
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) { expect(["measured", "ai"]).toContain(x.basis); expect(x.href).toBeTruthy(); }
    expect(xs.filter(x => x.kind === "open").length).toBeLessThanOrEqual(OPEN_MAX);
    for (const d of a.domains) expect(xs.filter(x => x.kind === "ahead" && x.key.startsWith(`a:${d}:`)).length).toBeLessThanOrEqual(FINDINGS_PER_SITE);
    expect(new Set(xs.map(x => x.key)).size).toBe(xs.length);
  });
});
