// W3b Part 1 · with MUSEUM_SHOWN false and the stored works over the line, neither museum surface exists for readers: the study is not
// live, not listed, not on the shelf and builds nothing; a stored Studies home written while it was live loses it; and a brand page
// whose card carries a near work draws exactly what it drew before W3a (same markup, so the same heights at every width).
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
vi.mock("@/lib/read.functions", async orig => { const w = () => new Promise<never>(() => {}); return { ...(await orig<object>()), getBrandMoves: w, getBrandSections: w, getBrandSector: w, getBrandSimilar: w, getBrandStories: w, getBrandSurfaces: w }; });
import { MUSEUM_SHOWN } from "../site";
import { fxInput } from "./fixtures";
import { buildStory, dataShelf, indexRows, liveNow, statusOf } from "./build";
import { entryOf, liveEntries, relatedFor, withheld, MUSEUM_STUDY_SLUG } from "./registry";
import { homeWithout, studiesHome, frontStudies, type HomeStudy } from "./shelf";
import { readyToShow } from "../art/palette";
import type { ArtInput } from "./museum";
import fixture from "../art/__fixtures__/dry-run-works.json";
import { BrandPageView } from "@/components/read/BrandView";
import { renderInRouter } from "@/test/router-harness";
import { brandModel, cardOf } from "@/lib/brand-page";
import { auditFixture } from "@/lib/agency/test-fixtures";
import type { ArtNear } from "@/lib/art/read.server";

const works = fixture.works.map(w => ({ ...w, link: `https://www.artic.edu/artworks/${w.source_id}` })) as unknown as ArtInput["works"];
function withArt() {
  const i = fxInput();
  const brands = i.sites.map((s, k) => ({ domain: s.domain, sector: s.sector, palette: [{ hex: "#FFFFFF", share: 0.5 }, ...works[(k * 7) % works.length]!.palette.map(p => ({ hex: p.hex, share: p.share * 0.5 }))] }));
  return { ...i, art: { works, brands, through: "2026-11-22T12:00:00Z" } };
}
const e = entryOf(MUSEUM_STUDY_SLUG)!;
const study = (slug: string, number: number): HomeStudy => ({ slug, number, label: `Study No. ${number}`, series: "sector-v-sector", seriesTitle: "", headline: `H${number}`, deck: "", question: "", dataThrough: null, href: `/data/${slug}`, key: slug, cover: null, changedAt: `2026-11-0${number}` } as unknown as HomeStudy);

describe("museum surfaces withheld (W3b Part 1)", () => {
  it("ships off", () => { expect(MUSEUM_SHOWN).toBe(false); expect(withheld(e)).toBe(true); });
  it("the study does not exist for readers even with the works over the line", () => {
    const i = withArt();
    expect(readyToShow(i.art.works).ready).toBe(true);
    expect(statusOf(e, i)).toEqual({ status: "draft", reason: "Withheld by the editor." });
    expect(indexRows(i, null).some(r => r.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(liveNow(i).some(x => x.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(liveEntries().some(x => x.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(dataShelf().some(x => x.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(relatedFor("which-sector-changes-its-mind").some(l => l.href === `/data/${MUSEUM_STUDY_SLUG}`)).toBe(false);
    expect(buildStory(MUSEUM_STUDY_SLUG, i, new Map())).toBeNull();
  });
  it("a Studies home stored while the study was live (and its lead) loses it on read", () => {
    const h = studiesHome([study(MUSEUM_STUDY_SLUG, 6), study("which-sector-changes-its-mind", 4)], [{ key: MUSEUM_STUDY_SLUG, question: "", series: "", wait: "", earliest: null, ready: false }]);
    const out = homeWithout({ ...h, lead: h.series.flatMap(s => s.studies).find(x => x.slug === MUSEUM_STUDY_SLUG)! }, s => withheld({ slug: s }));
    const slugs = [out.lead?.slug, ...out.series.flatMap(s => s.studies.map(x => x.slug)), ...out.shelf.map(r => r.key), ...frontStudies(out).map(x => x.slug)];
    expect(slugs).not.toContain(MUSEUM_STUDY_SLUG);
    expect(out.lead?.slug).toBe("which-sector-changes-its-mind");
  });
  it("a brand page with a near work draws what it drew before W3a (no line, same markup)", async () => {
    const b = brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [], captures: [] });
    const art: ArtNear = { line: "Tintoretto, Venus and Mars, about 1550, The Art Institute of Chicago", museum: "The Art Institute of Chicago", href: "https://www.artic.edu/artworks/1", thumb: "/crops/art/aic/1.webp", width: 120, height: 90, distance: 0.05, work: "aic:1", group: "European paintings, 1550 to 1599", groupDistance: 0.06 };
    // The page's clock ticks between renders, so the comparison is the identity card (where the line sat) and the page minus its clock.
    const page = (c: HTMLElement) => ({ card: c.querySelector("[data-identity-card]")!.outerHTML, rest: c.innerHTML.replace(/<time[^>]*>[^<]*<\/time>/g, "") });
    const without = page((await renderInRouter(() => createElement(BrandPageView, { card: cardOf(b) }), "/brands/vercel.com")).container);
    const withArtCard = await renderInRouter(() => createElement(BrandPageView, { card: { ...cardOf(b), art } }), "/brands/vercel.com");
    expect(withArtCard.container.querySelector("[data-nearest-art]")).toBeNull();
    expect(withArtCard.container.textContent).not.toMatch(/Tintoretto|museum/i);
    expect(page(withArtCard.container)).toEqual(without);
  });
});
