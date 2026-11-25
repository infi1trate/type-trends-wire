// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ReadoutGroup } from "./ReadoutStrip";
import { ChartInteraction } from "./Interaction";

describe("B1c · shared strip for small charts", () => {
  it("hovering a tile fills the strip and draws no readout inside the tile", () => {
    const pts = [{ x: 10, y: 50, period: "Q2 2026", lines: [], value: "12.0%", count: "4 of 30" }, { x: 90, y: 40, period: "Q3 2026", lines: [], value: "16.7%", count: "5 of 30" }];
    const { container } = render(<ReadoutGroup><ChartInteraction name="Entry animations" label="Entry animations in Fintech" width={100} height={100} points={pts}><svg viewBox="0 0 100 100" /></ChartInteraction></ReadoutGroup>);
    const g = container.querySelector("[data-chart-interaction]")!;
    fireEvent.keyDown(g, { key: "End" });
    expect(container.querySelector("[data-readout-strip]")!.textContent).toBe("Entry animations · Q3 2026 · 16.7% · 5 of 30");
    expect(container.querySelector("[data-chart-readout]")).toBeNull();
  });
});
