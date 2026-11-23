// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
// W3b · these tests read the study as it would be with MUSEUM_SHOWN on; museum-withheld.test.tsx reads it as shipped (off).
vi.mock("../site", async orig => ({ ...(await orig<object>()), MUSEUM_SHOWN: true }));
import { fxInput } from "./fixtures";
import { buildStory, indexRows, liveNow, statusOf } from "./build";
import { entryOf, liveEntries, relatedFor, MUSEUM_STUDY_SLUG } from "./registry";
import { EXAMPLES_PER_SECTOR, museumFigures, type ArtInput } from "./museum";
import { waitOf } from "./checks";
import { SECTORS } from "../library";
import { capText, isRef } from "./text";
import fixture from "../art/__fixtures__/dry-run-works.json";

const works = fixture.works.map(w => ({ ...w, link: w.source === "met" ? `https://www.metmuseum.org/art/collection/search/${w.source_id}` : `https://www.artic.edu/artworks/${w.source_id}` })) as unknown as ArtInput["works"];
/** Made-up brand palettes: each brand wears one work's colours over a white page, so every sector has colourful homepages. */
function withArt(n = works.length) {
  const i = fxInput();
  const brands = i.sites.map((s, k) => ({ domain: s.domain, sector: s.sector, palette: [{ hex: "#FFFFFF", share: 0.5 }, ...works[(k * 7) % works.length]!.palette.map(p => ({ hex: p.hex, share: p.share * 0.5 }))] }));
  return { ...i, art: { works: works.slice(0, n), brands, through: "2026-11-22T12:00:00Z" } };
}
const e = entryOf(MUSEUM_STUDY_SLUG)!;

describe("museum study (W3a)", () => {
  it("does not exist for readers until 200 works fall into 8 groups of 15: not listed, not live, not related", () => {
    const none = fxInput();
    expect(statusOf(e, null).status).toBe("draft");
    expect(statusOf(e, none).status).toBe("draft");
    expect(indexRows(none, null).some(r => r.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(liveNow(none).some(x => x.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(liveEntries().some(x => x.slug === MUSEUM_STUDY_SLUG)).toBe(false);
    expect(relatedFor("which-sector-changes-its-mind").some(l => l.href === `/data/${MUSEUM_STUDY_SLUG}`)).toBe(false);
    expect(buildStory(MUSEUM_STUDY_SLUG, withArt(150), new Map())).toBeNull();
  });
  // W3b · built only when 5 of the sectors name a group (a third of their comparable homepages, and 8 at least); otherwise "not enough
  // for a finding" with its counts. Six made-up varied groups of fifteen join the dry-run works; sector k's nine homepages wear group k's
  // colours for the first `named` sectors, and the rest are white pages (mostly neutral).
  const PALS = [
    [["#1F5FFF", 0.4], ["#FF5A1F", 0.35], ["#2E7D32", 0.25]], [["#8E24AA", 0.4], ["#FFD400", 0.35], ["#00A3A3", 0.25]], [["#C2185B", 0.4], ["#5D4037", 0.35], ["#9CCC65", 0.25]],
    [["#4A148C", 0.4], ["#F06292", 0.35], ["#004D40", 0.25]], [["#E65100", 0.4], ["#1A237E", 0.35], ["#AED581", 0.25]], [["#B71C1C", 0.4], ["#81D4FA", 0.35], ["#FBC02D", 0.25]],
  ].map(p => p.map(([hex, share]) => ({ hex: hex as string, share: share as number })));
  function sectorsNaming(named: number) {
    const i = fxInput(), extra = PALS.flatMap((p, k) => Array.from({ length: 15 }, (_, j) => ({ source: "aic", source_id: `x${k}-${j}`, title: `Study ${k}-${j}`, artist: "A. Painter", date_display: "1880", year_start: 1880, tradition: "Painting and Sculpture of Europe", movement: `Group ${k}`, palette: p, link: `https://www.artic.edu/artworks/9${k}${j}` })));
    const sites = SECTORS.flatMap((sec, k) => Array.from({ length: 9 }, (_, j) => ({ domain: `s${k}-${j}.example`, name: `S${k}${j}`, sector: sec as string, active: true })));
    const brands = sites.map(s => { const k = SECTORS.indexOf(s.sector as never); return { domain: s.domain, sector: s.sector, palette: k < named ? PALS[k % PALS.length]! : [{ hex: "#FFFFFF", share: 1 }] }; });
    return { ...i, sites: [...i.sites, ...sites], art: { works: [...works, ...extra] as unknown as ArtInput["works"], brands, through: "2026-11-22T12:00:00Z" } };
  }
  it("is built when 5 sectors name a group, every sector row with its counts, from swatch strips only, with at most three credited, linked examples", () => {
    const i = sectorsNaming(5);
    expect(museumFigures(i)).toMatchObject({ ready: true, sectors: 5, sectorRows: 10 });
    expect(statusOf(e, i).status).toBe("live");
    expect(indexRows(i, null).find(r => r.slug === MUSEUM_STUDY_SLUG)?.href).toBe(`/data/${MUSEUM_STUDY_SLUG}`);
    const s = buildStory(MUSEUM_STUDY_SLUG, i, new Map())!;
    expect(Object.values(s.figures).map(f => f.kind)).toEqual(["drift"]);
    const sectors = s.steps.filter(x => x.id.startsWith("sector-"));
    expect(sectors).toHaveLength(10);
    expect(sectors.filter(st => /^\d+ of \d+ comparable .+ homepages are nearest to .+, as the Art Institute of Chicago labels it;/.test(capText(st.caption)))).toHaveLength(5);
    expect(sectors.filter(st => /^.+: no group stands out\. 0 of 0 comparable homepages .+; 9 of 9 have no comparable palette\.$/.test(capText(st.caption)))).toHaveLength(5);
    for (const st of sectors) {
      const ex = st.caption.filter(isRef).filter(r => /^https:\/\//.test(r.href));
      expect(ex.length).toBeLessThanOrEqual(EXAMPLES_PER_SECTOR);
      for (const r of ex) expect(r.href).toMatch(/^https:\/\/www\.(metmuseum\.org|artic\.edu)\//);
      // Literal caption text carries no digits (numbers are receipts).
      for (const seg of st.caption) if (typeof seg === "string") expect(seg).not.toMatch(/\d/);
    }
    const all = [s.question, s.deck, s.basis.rule, ...s.basis.lines, ...s.limits, ...s.steps.map(x => capText(x.caption))].join(" ");
    expect(all).toMatch(/says nothing about influence/);
    expect(all).not.toMatch(/inspired|influenced by|borrows from/i);
    expect(s.basis.lines[0]).toMatch(/^387 public-domain works \(CC0\) from The Metropolitan Museum of Art and The Art Institute of Chicago, as stored on 22 Nov 2026; \d+ have a varied palette\./);
  });
  it("with 4 sectors naming a group it is not built: In the works says not enough for a finding, with its counts", () => {
    const i = sectorsNaming(4);
    expect(statusOf(e, i).status).toBe("draft");
    expect(buildStory(MUSEUM_STUDY_SLUG, i, new Map())).toBeNull();
    const w = waitOf("museum", i);
    expect(w).toMatchObject({ have: 4, need: 5 });
    expect(w.text).toMatch(/^Not enough for a finding: 4 of 10 sectors name a museum group \(needs 5\)\. \d+ of 387 works, \d+ groups and 36 of 90 homepages have a varied enough palette to compare\.$/);
  });
});
