import { describe, expect, it } from "vitest";
import { templateBody } from "./view";
import { textLeadAllowed } from "../front/front";

describe("I3 · 0.4 a story without checked text", () => {
  it("reads its facts as the body instead of an empty section", () => {
    expect(templateBody([{ text: "Together AI · accent, violet to sky blue · between 20 and 21 Nov" }, { text: "Corporate polish is Rising in AI." }]))
      .toEqual(["Together AI · accent, violet to sky blue · between 20 and 21 Nov. Corporate polish is Rising in AI."]);
    expect(templateBody(Array.from({ length: 6 }, (_, i) => ({ text: `Line ${i + 1}` })))).toEqual(["Line 1. Line 2. Line 3. Line 4.", "Line 5. Line 6."]);
    expect(templateBody([])).toEqual([]);
  });
  const w = { headline: "h", deck: "d", body: ["b"], howWeKnow: "x", model: "m", version: 1, at: "2026-11-21T07:00:00Z" };
  it("cannot lead while a published story of the same day has checked text", () => {
    const a = { id: "a", happened_at: "2026-11-21T06:00:00Z", written: null }, b = { id: "b", happened_at: "2026-11-21T09:00:00Z", written: w };
    expect(textLeadAllowed(a, [a, b])).toBe(false);
    expect(textLeadAllowed(b, [a, b])).toBe(true);
  });
  it("can lead when no story that day has text, or the one with text is another day", () => {
    const a = { id: "a", happened_at: "2026-11-21T06:00:00Z", written: null }, c = { id: "c", happened_at: "2026-11-20T09:00:00Z", written: w };
    expect(textLeadAllowed(a, [a, c])).toBe(true);
  });
});
