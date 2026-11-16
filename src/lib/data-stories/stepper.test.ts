import { describe, expect, it } from "vitest";
import { announcement, applyAction, clampStep, counter, keyAction, parseStep, stepParam } from "./stepper";

describe("stepper rules", () => {
  it("arrow keys, J / K, Home and End", () => {
    expect(["ArrowRight", "ArrowDown", "j", "J"].map(key => keyAction({ key }))).toEqual(["next", "next", "next", "next"]);
    expect(["ArrowLeft", "ArrowUp", "k", "K"].map(key => keyAction({ key }))).toEqual(["prev", "prev", "prev", "prev"]);
    expect([keyAction({ key: "Home" }), keyAction({ key: "End" }), keyAction({ key: "x" })]).toEqual(["first", "last", null]);
  });
  it("leaves modifier chords and typing alone", () => {
    expect(keyAction({ key: "j", metaKey: true })).toBeNull();
    expect(keyAction({ key: "j", target: { tagName: "input" } })).toBeNull();
    expect(keyAction({ key: "ArrowDown", target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
  });
  it("clamps at both ends", () => {
    expect(applyAction(0, "prev", 9)).toBe(0);
    expect(applyAction(8, "next", 9)).toBe(8);
    expect(applyAction(4, "first", 9)).toBe(0);
    expect(applyAction(4, "last", 9)).toBe(8);
    expect([clampStep(-3, 9), clampStep(42, 9), clampStep(NaN, 9), clampStep(3, 0)]).toEqual([0, 8, 0, 0]);
  });
  it("?step= is one-based and round-trips", () => {
    for (let k = 0; k < 9; k++) expect(parseStep(stepParam(k), 9)).toBe(k);
    expect([parseStep(undefined, 9), parseStep("3", 9), parseStep("junk", 9), parseStep(99, 9), parseStep(0, 9)]).toEqual([0, 2, 0, 8, 0]);
  });
  it("announces once per change, with the caption", () => {
    expect(announcement(2, 2, 9, "x")).toBeNull();
    expect(announcement(2, 3, 9, "Big type took off.")).toBe("Step 4 of 9. Big type took off.");
    expect(counter(2, 9)).toBe("3 of 9");
  });
});
