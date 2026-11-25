import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Sparkline } from "./Sparkline";
import { readoutWords } from "./interaction";
import { quarterText } from "@/lib/labels";

// B1b · no readout or axis may say "Quarter 7": series carry their real quarter labels.
describe("chart readouts name real quarters", () => {
  it("formats stored quarter keys for readers", () => {
    expect(quarterText("2026Q3")).toBe("Q3 2026");
  });
  it("a sparkline readout never says Quarter N", () => {
    for (const periods of [["2026Q2", "2026Q3", "2026Q4"], undefined]) {
      const html = renderToStaticMarkup(<Sparkline look="read" w={300} values={[0.1, 0.12, 0.167]} periods={periods} counts={["3 of 30", "4 of 30", "5 of 30"]} label="Entry animations" />);
      expect(html).not.toMatch(/Quarter \d+/);
    }
  });
  it("readout words follow what · when · value · count", () => {
    const w = readoutWords({ x: 0, y: 0, period: quarterText("2026Q3"), lines: [["Entry animations", "16.7%", "5 of 30"].join(" · ")] });
    expect(w).toBe("Q3 2026. Entry animations · 16.7% · 5 of 30");
    expect(w).not.toMatch(/Quarter \d+/);
  });
});
