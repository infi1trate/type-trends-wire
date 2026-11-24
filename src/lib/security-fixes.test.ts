import { describe, expect, it } from "vitest";
import { robotsRuleMatches } from "./taste/lite.server";
import { tableCsv } from "./views/receipts";
describe("security fixes", () => {
  it("robots wildcards match without backtracking", () => {
    expect(robotsRuleMatches("/a*b$", "/axxb")).toBe(true);
    expect(robotsRuleMatches("/a*b$", "/axxbc")).toBe(false);
    expect(robotsRuleMatches("/private", "/private/x")).toBe(true);
    const t = Date.now(); robotsRuleMatches("*a".repeat(200) + "b", "a".repeat(5000)); expect(Date.now() - t).toBeLessThan(100);
  });
  it("copied tables neutralise formulas but keep numbers", () => {
    expect(tableCsv({ head: ["h"], rows: [["=HYPERLINK(1)"], ["-5"], ["@x"]] })).toBe("h\r\n'=HYPERLINK(1)\r\n-5\r\n'@x\r\n");
  });
});
