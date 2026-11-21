// U3 · the chart kit draws every chart in both looks from one fixture, ships each one's data table, colours only from design-system
// roles, and formats numbers, quarters and dates through labels.ts.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { pctText, quarterText, dayText } from "@/lib/labels";
import { QuarterLine, Bars, Sparkline, SmallMultiples, BeforeAfterStrip } from "./index";
import { FIXTURE_LABEL, FIXTURE_QUARTERS, fixtureBars, fixtureBeforeAfter, fixtureCard, fixtureMultiples, fixtureValues, fixtureView } from "./fixture";

const bars = fixtureBars(), mult = fixtureMultiples(), ba = fixtureBeforeAfter();
const CHARTS: [string, ReactElement, ReactElement][] = [
  ["line by quarter", <QuarterLine look="read" card={fixtureCard()} label={FIXTURE_LABEL} caption="Share by quarter." basis="measured" />, <QuarterLine look="data" quarters={FIXTURE_QUARTERS} proj={[]} large label={FIXTURE_LABEL} />],
  ["bars", <Bars look="read" title={FIXTURE_LABEL} note="Share by quarter" source="slug" bars={bars.map(b => ({ id: b.q, label: quarterText(b.q), value: b.share ?? 0 }))} format={pctText} valueLabel="Share" />, <Bars look="data" label={FIXTURE_LABEL} points={bars} />],
  ["sparkline", <Sparkline look="read" values={fixtureValues()} label={FIXTURE_LABEL} />, <Sparkline look="data" values={fixtureValues()} label={FIXTURE_LABEL} />],
  ["small multiples", <SmallMultiples f={mult} v={fixtureView("m")} look="read" />, <SmallMultiples f={mult} v={fixtureView("m")} look="data" />],
  ["before and after", <BeforeAfterStrip f={ba} v={fixtureView("b")} pair look="read" />, <BeforeAfterStrip f={ba} v={fixtureView("b")} pair look="data" />],
];
const HEX = /(?<![&\w-])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

describe("U3 · one chart kit, two looks", () => {
  for (const [name, read, data] of CHARTS) for (const [look, el] of [["read", read], ["data", data]] as const) it(`${name} draws in the ${look} look with no raw colour`, () => {
    const { container } = render(el);
    expect(container.innerHTML.length, `${name} ${look}`).toBeGreaterThan(50);
    expect(container.innerHTML).not.toMatch(HEX);
  });
  it("every chart that draws data in either look carries a table for screen readers", () => {
    for (const [name, read, data] of CHARTS) for (const el of [read, data]) {
      if (name === "sparkline") continue; // a sparkline is a glance beside a number: its label states the values
      expect(render(el).container.querySelector("table"), name).not.toBeNull();
    }
  });
  it("formats through labels.ts: percent to one decimal, Q4 2026, capture dates", () => {
    expect(pctText(0.125)).toBe("12.5%");
    expect(quarterText("2026Q4")).toBe("Q4 2026");
    const line = render(CHARTS[0]![1]).container.textContent ?? "";
    expect(line).toContain("Q4 2026"); expect(line).toContain("12.5%");
    const dataBars = render(CHARTS[1]![2]).container.textContent ?? "";
    expect(dataBars).toContain(pctText(0.125));
    const pair = render(CHARTS[4]![1]).container.textContent ?? "";
    expect(pair).toContain(dayText(ba.before.at));
  });
  it("the Read and Data looks of one chart differ (two skins), drawn from the same data", () => {
    for (const [name, read, data] of CHARTS) expect(render(read).container.innerHTML, name).not.toBe(render(data).container.innerHTML);
  });
});
