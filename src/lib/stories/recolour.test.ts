import { describe, expect, it } from "vitest";
import { recolour } from "./recolour";

describe("a palette line names its colours with today's naming", () => {
  const ev = [{ type: "palette_shift", before: { palette: ["#12181F", "#F7F1F1"] }, after: { palette: ["#F7F1F1", "#D0E0E7", "#B1CBDA"] } }];
  it("No. 85: off-white and pale blue, not light grey; dates kept", () =>
    expect(recolour([{ text: "Palette, Near-black and Off-white and light grey to Off-white and light grey · between 14 and 20 Nov", href: "/brands/netlify.com", basis: "measured", kind: "member" }], ev)[0]!.text)
      .toBe("Palette, Near-black and Off-white to Off-white and Pale blue · between 14 and 20 Nov"));
  it("other lines stay", () => { const f = [{ text: "Hero, none to still · 20 Nov", href: null, basis: "measured" as const, kind: "member" as const }]; expect(recolour(f, ev)).toEqual(f); });
  it("two palette changes: nothing is reworded", () => { const f = [{ text: "Palette, A to B", href: null, basis: null, kind: "member" as const }]; expect(recolour(f, [...ev, ...ev])).toEqual(f); });
});
