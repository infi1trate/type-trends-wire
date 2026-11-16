import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isOpenPath, OPEN_PATHS } from "./gate";
import { SURFACES, readSectionOf } from "./ia";
import { KIT_SECTIONS, CONTAINERS, kitCharts, wellCovered } from "./kit";
import type { Signal } from "./signals";

const sig = (key: string, name: string, share: number, momentum: number, stage: Signal["stage"] = "Rising") => ({ key, name, share, momentum, stage }) as Signal;

describe("/kit", () => {
  it("is gated, not in OPEN_PATHS, registered under Tools and linked from /tools only", () => {
    expect(isOpenPath("/kit")).toBe(false);
    expect(OPEN_PATHS.some(o => JSON.stringify(o).includes("kit"))).toBe(false);
    expect(SURFACES["kit"]).toMatchObject({ section: "tools", mode: "read", status: "quiet" });
    expect(readSectionOf("/kit")).toBe("tools");
    expect(readFileSync("src/components/read/ToolsViews.tsx", "utf8")).toContain('to="/kit"');
    const shells = ["src/components/read/ReadShell.tsx", "src/components/digest/Editorial.tsx", "src/components/terminal/Chrome.tsx"].map(f => readFileSync(f, "utf8"));
    expect(shells.some(s => s.includes('"/kit"'))).toBe(false);
  });
  it("renders its sections in the brief's order with ten container styles", () => {
    expect(KIT_SECTIONS.map(s => s.title)).toEqual(["Wordmark and type roles", "Colour and stage colours", "Buttons, chips and controls", "Stories, signals and brands", "Containers", "Image treatments", "Charts", "Spacing and whitespace", "Motion", "Data story templates"]);
    expect(CONTAINERS).toEqual(["page", "card", "inverse", "accent", "highlight", "patterned", "grain", "striped-draft", "raised", "photo-with-scrim"]);
  });
  it("chart data: scatter of every composite, top six bars by share, two well-covered lines, stories by type", () => {
    const comps = [sig("combo:a", "A", 0.5, 1), sig("combo:b", "B", 0.4, -1, "Fading"), sig("combo:c", "C", 0.3, 0.2), sig("combo:d", "D", 0.2, 0), sig("combo:e", "E", 0.1, 0.5), sig("combo:f", "F", 0.05, 0.1), sig("combo:g", "G", 0.01, 2)];
    const q = (s: number, n = 30, c = 0.5) => ({ q: `2025Q${Math.round(s * 10)}`, s, n, c });
    const c = kitCharts(comps, [{ key: "combo:a", quarters: [q(0.1), q(0.2), q(0.3)] }, { key: "combo:b", quarters: [q(0.1), q(0.2, 5), q(0.3)] }, { key: "combo:c", quarters: [q(0.1), q(0.2), q(0.3), q(0.4)] }], { move: 6, news: 4, rebrand: 0 });
    expect(c.scatter).toHaveLength(7);
    expect(c.bars.map(b => b.id)).toEqual(["combo:a", "combo:b", "combo:c", "combo:d", "combo:e", "combo:f"]);
    expect(c.lines.map(l => l.id)).toEqual(["combo:a", "combo:c"]);
    expect(c.slices).toEqual([{ id: "move", label: "Move", value: 6 }, { id: "news", label: "News", value: 4 }]);
    expect(wellCovered({ q: "x", s: 0.1, n: 14, c: 0.9 })).toBe(false);
  });
});
