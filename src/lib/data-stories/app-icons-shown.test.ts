// W3d-c Part 3 · the icon study as shipped: ICONS_SHOWN on, MUSEUM_SHOWN off. With a full week stored, No. 8 is live and listed by the
// existing rules (/data, the studies shelf, its series); No. 7 stays withheld, so "Beyond the homepage" shows one study.
import { describe, expect, it } from "vitest";
import { ICONS_SHOWN, MUSEUM_SHOWN } from "../site";
import { fxInput } from "./fixtures";
import { indexRows, liveNow, statusOf } from "./build";
import { entryOf, withheld, ICONS_SLUG, MUSEUM_ACCENT_SLUG, MUSEUM_STUDY_SLUG } from "./registry";
import { frontStudies, studiesHome, type HomeStudy } from "./shelf";
import { probeRows } from "../icons/__fixtures__/probe";

const study = (slug: string, number: number, series: string): HomeStudy => ({ slug, number, label: `Study No. ${number}`, series, seriesTitle: "", headline: "H", deck: "", question: "", dataThrough: null, href: `/data/${slug}`, key: { n: "1", label: "x" }, cover: null, changedAt: "2026-11-23" });
describe("the icon study as shipped (W3d-c)", () => {
  it("ships on; the museum stays off", () => {
    expect(ICONS_SHOWN).toBe(true);
    expect(MUSEUM_SHOWN).toBe(false);
    expect(withheld(entryOf(ICONS_SLUG)!)).toBe(false);
    expect(withheld(entryOf(MUSEUM_ACCENT_SLUG)!)).toBe(true);
    expect(withheld(entryOf(MUSEUM_STUDY_SLUG)!)).toBe(true);
  });
  it("is live and listed with a full week stored, and No. 7 is not", () => {
    const i = { ...fxInput(), icons: probeRows() };
    expect(statusOf(entryOf(ICONS_SLUG)!, i)).toEqual({ status: "live", reason: null });
    expect(liveNow(i).map(e => e.slug)).toContain(ICONS_SLUG);
    expect(liveNow(i).map(e => e.slug)).not.toContain(MUSEUM_ACCENT_SLUG);
    expect(indexRows(i, null).find(r => r.slug === ICONS_SLUG)).toMatchObject({ number: 8, status: "live", href: `/data/${ICONS_SLUG}` });
    expect(indexRows(i, null).some(r => r.slug === MUSEUM_ACCENT_SLUG)).toBe(false);
  });
  it("Beyond the homepage is listed, with No. 8 alone", () => {
    const h = studiesHome([study("who-went-big-first", 2, "first-movers"), study(ICONS_SLUG, 8, "beyond-homepage")], []);
    expect(h.series.map(s => s.id)).toContain("beyond-homepage");
    expect(h.series.find(s => s.id === "beyond-homepage")!.studies.map(s => s.number)).toEqual([8]);
    expect(frontStudies(h).map(s => s.number)).toContain(8);
  });
});
