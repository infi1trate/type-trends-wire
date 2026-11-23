// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
// W3b · these tests read the study as it would be with MUSEUM_SHOWN on; museum-withheld.test.tsx reads it as shipped (off).
vi.mock("../site", async orig => ({ ...(await orig<object>()), MUSEUM_SHOWN: true }));
import { fxInput } from "./fixtures";
import { buildStory, indexRows, liveNow, statusOf } from "./build";
import { entryOf, liveEntries, relatedFor, MUSEUM_STUDY_SLUG } from "./registry";
import { EXAMPLES_PER_SECTOR, type ArtInput } from "./museum";
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
  it("is built once the works clear the line, from swatch strips only, with at most three credited, linked examples a sector", () => {
    const i = withArt();
    expect(statusOf(e, i).status).toBe("live");
    expect(indexRows(i, null).find(r => r.slug === MUSEUM_STUDY_SLUG)?.href).toBe(`/data/${MUSEUM_STUDY_SLUG}`);
    const s = buildStory(MUSEUM_STUDY_SLUG, i, new Map())!;
    expect(Object.values(s.figures).map(f => f.kind)).toEqual(["drift"]);
    const sectors = s.steps.filter(x => x.id.startsWith("sector-"));
    expect(sectors).toHaveLength(3);
    for (const st of sectors) {
      const ex = st.caption.filter(isRef).filter(r => /^https:\/\//.test(r.href));
      expect(ex.length).toBeLessThanOrEqual(EXAMPLES_PER_SECTOR);
      for (const r of ex) expect(r.href).toMatch(/^https:\/\/www\.(metmuseum\.org|artic\.edu)\//);
      expect(capText(st.caption)).toMatch(/^\d+ of \d+ .+ homepages are nearest to /);
      // Literal caption text carries no digits (numbers are receipts).
      for (const seg of st.caption) if (typeof seg === "string") expect(seg).not.toMatch(/\d/);
    }
    const all = [s.question, s.deck, s.basis.rule, ...s.basis.lines, ...s.limits, ...s.steps.map(x => capText(x.caption))].join(" ");
    expect(all).toMatch(/says nothing about influence/);
    expect(all).not.toMatch(/inspired|influenced by|borrows from/i);
    expect(s.basis.lines[0]).toMatch(/^297 public-domain works \(CC0\) from The Metropolitan Museum of Art and The Art Institute of Chicago, as stored on 22 Nov 2026\./);
  });
});
