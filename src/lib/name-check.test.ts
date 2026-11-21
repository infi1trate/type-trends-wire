import { describe, expect, it } from "vitest";
import { nameAppears, nameCheck } from "./name-check";

describe("brand name check (I3b, health only)", () => {
  it("finds the name in the title or the headline, ignoring case, spacing and punctuation", () => {
    expect(nameAppears(["BASIC/DEPT"], "basicagency.com", ["Basic Dept — Brand and digital", null])).toBe(true);
    expect(nameAppears(["Lucid"], "lucidmotors.com", ["Home | Lucid Motors"])).toBe(true);
    expect(nameAppears(["R/GA"], "rga.com", [null, "R/GA | We design intelligent brand systems"])).toBe(true);
  });
  it("fails a brand whose title and headline never name it", () => {
    expect(nameAppears(["Acme"], "acme.com", ["Welcome to Islamorada", "Oceanfront rooms"])).toBe(false);
    expect(nameAppears(["Acme"], "acme.com", [null, ""])).toBe(false);
  });
  it("lists failures and brands without a recent capture separately", () => {
    const r = nameCheck([
      { domain: "acme.com", names: ["Acme"], title: "Welcome", h1: null, captured_at: "2026-11-21T00:00:00Z" },
      { domain: "figma.com", names: ["Figma"], title: "Figma: The Collaborative Interface Design Tool", h1: null, captured_at: "2026-11-21T00:00:00Z" },
      { domain: "gone.com", names: ["Gone"], title: null, h1: null, captured_at: null },
    ], new Date("2026-11-21T12:00:00Z"));
    expect(r.checked).toBe(2);
    expect(r.failing.map(f => f.domain)).toEqual(["acme.com"]);
    expect(r.not_captured).toEqual(["gone.com"]);
  });
});
