import { describe, expect, it } from "vitest";
import { readWording, templateBody } from "./view";
import { bannedFailures, writePriority } from "./writer";

// No. 45's fact lines as stored (white space, dev tools), before W1b.
const NO45 = [
  "52% of homepages in other sectors show it.",
  "Lifestyle photography is Rising across all sectors (forecast run 13).",
  "Using it elsewhere: Lucid, Allbirds and BASIC/DEPT.",
  "Lifestyle photography: 132 of 281 tracked homepages with an AI read (47.0%), Rising, momentum 0.6 points a quarter.",
  "Lifestyle photography: 1 of 30 tracked Dev tools homepages with an AI read (3.3%), Fading, momentum -0.1 points a quarter.",
];

describe("W1b · the facts-built body follows the Read-side wording rules", () => {
  it("drops forecast run numbers and passes the writer's method-word check", () => {
    const body = templateBody(NO45.map(text => ({ text })));
    expect(body.join(" ")).not.toMatch(/run \d|forecast run/i);
    expect(bannedFailures(body.join(" "))).toEqual([]);
  });
  it("writes stage names in lower case inside a sentence, never at its start or inside quotes", () => {
    expect(readWording("Lifestyle photography is Rising across all sectors (forecast run 13).")).toBe("Lifestyle photography is rising across all sectors.");
    expect(readWording("Lifestyle photography: 1 of 30 (3.3%), Fading, momentum -0.1 points a quarter.")).toBe("Lifestyle photography: 1 of 30 (3.3%), fading, momentum -0.1 points a quarter.");
    expect(readWording("Rising signals lead.")).toBe("Rising signals lead.");
    expect(readWording("Its headline reads “Rising Tide”, Steady.")).toBe("Its headline reads “Rising Tide”, steady.");
  });
  it("a shift's stage line reads as a move, without run ids", () => {
    expect(readWording("Stage Emerging in forecast run 12, Rising in run 15")).toBe("It moved from emerging to rising");
    expect(readWording("Alert fired by forecast run 15")).toBe("Alert fired");
  });
});

describe("W1b · a corrected story is rewritten first", () => {
  it("a published story whose written text a correction hid goes ahead of the lead and the rest", () => {
    const s = (id: string, score: number) => ({ id, score, happened_at: "2026-11-21T06:00:00Z" });
    const owed = [s("lead", 50), s("census:agents:2026-W47", 40), s("white:dev-tools:2026-W47", 10), s("other", 30)];
    expect(writePriority(owed, { leadId: "lead", corrected: new Set(["white:dev-tools:2026-W47"]) }).map(x => x.id)).toEqual(["white:dev-tools:2026-W47", "lead", "census:agents:2026-W47", "other"]);
    expect(writePriority(owed, { leadId: "lead" }).map(x => x.id)[0]).toBe("lead");
  });
});
