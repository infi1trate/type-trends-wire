import { describe, expect, it } from "vitest";
import { afterKey, withKeys, SITE_HISTORY } from "./history.server";

describe("site history keyset walk", () => {
  it("reads the stored rows, not the live view", () => { expect(SITE_HISTORY).toBe("library_site_history_rows"); });
  it("continues strictly after the last (domain, quarter), quoting dotted domains", () => {
    expect(afterKey({ domain: "coinbase.com", quarter: "2026Q3" })).toBe('domain.gt."coinbase.com",and(domain.eq."coinbase.com",quarter.gt."2026Q3")');
  });
  it("always selects the keyset columns", () => {
    expect(withKeys("sector,theme")).toBe("domain,quarter,sector,theme");
    expect(withKeys("domain,quarter,sector")).toBe("domain,quarter,sector");
    expect(withKeys("*")).toBe("*");
  });
});
