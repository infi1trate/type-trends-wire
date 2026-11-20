import { describe, expect, it } from "vitest";
import { BAR_ITEMS, LEAD_TOP_MAX, barAt, frontRows, lensLine, shellRows } from "./shell";

describe("read shell", () => {
  it("one top bar and one sub row at every width", () => {
    for (const w of [360, 768, 1024, 1440]) expect(shellRows(w)).toEqual(["bar", "sub"]);
  });
  it("phones get one Menu button holding the bar's items (with More), Read / Terminal and Lock; from 1024 everything is in the bar", () => {
    expect(barAt(360)).toEqual({ inline: [], menu: [...BAR_ITEMS], menuButton: true });
    expect(barAt(768).inline).toEqual(["switch"]);
    expect(barAt(1024)).toEqual({ inline: [...BAR_ITEMS], menu: [], menuButton: false });
    expect(barAt(1440)).toEqual({ inline: [...BAR_ITEMS], menu: [], menuButton: false });
  });
  it("the front page puts the dateline and the format filter on one row from 768 up", () => {
    expect(frontRows(360)).toEqual(["ticker", "dateline", "formats"]);
    for (const w of [768, 1024, 1440]) expect(frontRows(w)).toEqual(["ticker", "dateline+formats"]);
  });
  it("no 'Showing: All sectors' line when the lens is All sectors", () => {
    expect(lensLine({ sector: "all", sectorName: "All sectors", filtered: true, note: null })).toBeNull();
    expect(lensLine({ sector: "fintech", sectorName: "Fintech", filtered: true, note: null })).toBe("Showing: Fintech");
    expect(lensLine({ sector: "all", sectorName: "All sectors", filtered: true, note: "Numbers are all-sector" })).toBe("Numbers are all-sector");
  });
  it("lead targets: the top of the lead plate within 300px at 360 and 260px at 1440", () => {
    expect(LEAD_TOP_MAX).toEqual({ 360: 300, 1440: 260 });
  });
});
