import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BarChart, DonutChart, LineChart, ScatterChart } from "./Charts";

const fmt = (v: number) => `${Math.round(v * 100)}%`;
const frame = { title: "Test chart", note: "One line about it.", source: "forecast run 15" };
const cases = [
  ["scatter", (empty: boolean) => <ScatterChart {...frame} points={empty ? [] : [{ id: "a", label: "Alpha", x: 0.2, y: 1.1, stage: "Rising" }, { id: "b", label: "Beta", x: 0.5, y: -0.4, stage: null }]} x={{ label: "Share", format: fmt }} y={{ label: "Momentum", format: v => v.toFixed(1) }} />],
  ["line", (empty: boolean) => <LineChart {...frame} series={empty ? [] : [{ id: "a", label: "Alpha", points: [{ x: "2025Q1", y: 0.1 }, { x: "2025Q2", y: 0.2 }] }]} y={{ label: "Share", format: fmt }} />],
  ["bar", (empty: boolean) => <BarChart {...frame} bars={empty ? [] : [{ id: "a", label: "Alpha", value: 0.4, stage: "Peaking" }, { id: "b", label: "Beta", value: 0.2 }]} format={fmt} valueLabel="Share" />],
  ["donut", (empty: boolean) => <DonutChart {...frame} slices={empty ? [] : [{ id: "move", label: "Move", value: 6 }, { id: "news", label: "News", value: 4 }]} unit="stories" />],
] as const;

describe("chart primitives", () => {
  for (const [name, el] of cases) {
    it(`${name}: named figure, focusable marks, table fallback and source line`, () => {
      const { container } = render(el(false));
      const fig = screen.getByRole("figure", { name: "Test chart" });
      expect(within(fig).getByRole("group", { name: "Test chart" })).toHaveAccessibleDescription("One line about it.");
      const marks = container.querySelectorAll('[tabindex="0"][aria-label]');
      expect(marks.length).toBeGreaterThanOrEqual(2);
      const table = container.querySelector("table[data-chart-table]")!;
      expect(table).not.toBeNull();
      expect(table.closest(".sr-only")).not.toBeNull();
      expect(within(table as HTMLElement).getAllByRole("row").length).toBeGreaterThanOrEqual(3);
      expect(fig).toHaveTextContent("Source: forecast run 15");
    });
    it(`${name}: empty data shows the empty state, no chart and no table`, () => {
      const { container } = render(el(true));
      expect(screen.getByRole("status")).toHaveTextContent("No data to chart yet.");
      expect(container.querySelector("svg")).toBeNull();
      expect(container.querySelector("table")).toBeNull();
    });
  }
  it("stage colours come from tokens", () => {
    const { container } = render(cases[2][1](false));
    const rects = [...container.querySelectorAll("rect")].map(r => r.getAttribute("style"));
    expect(rects).toContain("fill: var(--tk-stage-peaking);");
    expect(rects).toContain("fill: var(--tk-stage-unstaged);");
  });
});
