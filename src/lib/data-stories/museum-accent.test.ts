// @vitest-environment node
// W3c Part 2 · the one-colour museum study as it would read with MUSEUM_SHOWN on (museum-withheld.test.tsx reads it as shipped, off).
import { describe, expect, it, vi } from "vitest";
vi.mock("../site", async orig => ({ ...(await orig<object>()), MUSEUM_SHOWN: true }));
import { fxInput } from "./fixtures";
import { buildStory, indexRows, statusOf } from "./build";
import { entryOf, MUSEUM_ACCENT_SLUG } from "./registry";
import { CHECKS, museumAccentVerdict, waitOf } from "./checks";
import { accentStudyFigures, NONE_HELD } from "./museum-accent";
import type { ArtInput } from "./museum";
import type { DriftFig } from "./types";
import { capText } from "./text";

const e = entryOf(MUSEUM_ACCENT_SLUG)!;
const brown = [{ hex: "#5A3A20", share: 0.6 }, { hex: "#C8B080", share: 0.3 }];
/** `n` stored works (brown varnish; every tenth holds a bright orange over 10%, every twentieth a blue) and 40 brands in each of four
 *  colours, so orange and blue are held and green and pink are not. */
function input(o: { works?: number; perColour?: number; removedOrange?: boolean } = {}) {
  const i = fxInput(), n = o.works ?? 520, per = o.perColour ?? 40;
  const works: ArtInput["works"] = Array.from({ length: n }, (_, k) => ({ source: k % 2 ? "met" : "aic", source_id: String(k), title: `Work ${k}`, artist: `Artist ${k}`, date_display: "1880", year_start: 1880, tradition: "European paintings", movement: null,
    kind: k % 5 ? "painting" : "print", link: k % 2 ? `https://www.metmuseum.org/art/collection/search/${k}` : `https://www.artic.edu/artworks/${k}`, thumb: `art/${k}.webp`, width: 240, height: 320,
    removed_at: o.removedOrange && k % 10 === 0 ? "2026-11-20T00:00:00Z" : null,
    palette: k % 10 === 0 ? [...brown.slice(0, 1), { hex: "#FF7A00", share: 0.12 }] : k % 20 === 5 ? [...brown.slice(0, 1), { hex: "#1F4FC0", share: 0.05 }] : brown }));
  const colours = [["orange", "#FF7A00"], ["blue", "#1F4FC0"], ["green", "#10B070"], ["pink", "#E0309A"]] as const;
  const extra = colours.flatMap(([c, hex]) => Array.from({ length: per }, (_, k) => ({ domain: `${c}${k}.com`, accent: hex })));
  const sites = [...i.sites, ...extra.map(b => ({ ...i.sites[0]!, domain: b.domain, name: b.domain, active: true }))];
  const brands = [...i.sites.map(s => ({ domain: s.domain, sector: s.sector, palette: [], accent: null })), ...extra.map(b => ({ domain: b.domain, sector: "fintech", palette: [], accent: b.accent }))];
  return { ...i, sites, art: { works, brands, through: "2026-11-23T12:00:00Z" } };
}

describe("brand colours the museum works hold (W3c)", () => {
  it("is live with the switch on, 150 vivid accents and 500 works", () => {
    const i = input(), f = accentStudyFigures(i);
    expect([f.vivid, f.works, f.ready, f.headline]).toEqual([160, 520, true, 1]);
    expect(statusOf(e, i)).toEqual({ status: "live", reason: null });
    expect(indexRows(i, null).find(r => r.slug === MUSEUM_ACCENT_SLUG)?.href).toBe(`/data/${MUSEUM_ACCENT_SLUG}`);
  });
  it("the headline and deck are written by rule from the stored numbers", () => {
    const s = buildStory(MUSEUM_ACCENT_SLUG, input(), new Map())!;
    expect(s.fallbackHeadline).toBe("None of 520 museum works holds brand green or pink");
    expect(s.deck).toBe("160 tracked brands' accent colours, one at a time, against 520 public-domain works from The Metropolitan Museum of Art and The Art Institute of Chicago.");
    expect(s.key).toEqual({ n: "0 of 80", label: "brand green or pink accents a stored work holds" });
  });
  it("families run from most held to least held; the empty ones sit at the bottom with the plain sentence", () => {
    const s = buildStory(MUSEUM_ACCENT_SLUG, input(), new Map())!, fam = s.figures["families"] as DriftFig;
    expect(fam.bands.map(b => b.q)).toEqual(["Orange", "Blue", "Green", "Pink"]);
    expect(fam.bands.map(b => b.note)).toEqual(["40 of 40 brand accents have a near work.", "40 of 40 brand accents have a near work.", `0 of 40 brand accents have a near work. ${NONE_HELD}`, `0 of 40 brand accents have a near work. ${NONE_HELD}`]);
    expect((s.figures["none"] as DriftFig).bands.map(b => b.q)).toEqual(["Green", "Pink"]);
    expect(s.scenes.map(x => x.id)).toEqual(["intro", "held", "none", "limits"]);
  });
  it("each pair is a small, credited, linked work with its share", () => {
    const s = buildStory(MUSEUM_ACCENT_SLUG, input(), new Map())!, p = (s.figures["held"] as DriftFig).bands[0]!.pairs!;
    expect(p.length).toBe(3);
    expect(p[0]).toMatchObject({ brandHex: "#FF7A00", workHex: "#FF7A00", share: 0.12, distance: 0, width: 48, height: 64, museum: "The Art Institute of Chicago", credit: "Artist 0. Work 0, 1880. The Art Institute of Chicago." });
    expect(p[0]!.href).toMatch(/^https:\/\/www\.artic\.edu\/artworks\//);
    expect(capText(s.steps.find(x => x.id === "family-orange")!.caption)).toMatch(/where the colour holds 12% of the picture/);
  });
  it("the method note gives the limit, the share, the kinds and the limits of photographs and pigments", () => {
    const s = buildStory(MUSEUM_ACCENT_SLUG, input(), new Map())!;
    expect(s.basis.rule).toMatch(/within 0\.04 of it in OKLab/); expect(s.basis.rule).toMatch(/at least 2% of the picture/);
    expect(s.basis.lines[0]).toMatch(/^520 works: 416 paintings and 104 prints, from /);
    expect(s.basis.lines.join(" ")).toMatch(/varnish yellows/); expect(s.basis.lines.join(" ")).toMatch(/no pigment in these works reaches/);
    expect([s.fallbackHeadline, s.deck, ...s.steps.map(x => capText(x.caption))].join(" ")).not.toMatch(/painters never|never had/i);
  });
  it("is not built under 150 vivid accents or under 500 works, and waits with its counts", () => {
    for (const i of [input({ perColour: 37 }), input({ works: 499 })]) {
      expect(statusOf(e, i).status).toBe("draft");
      expect(buildStory(MUSEUM_ACCENT_SLUG, i, new Map())).toBeNull();
      expect(indexRows(i, null).some(r => r.slug === MUSEUM_ACCENT_SLUG)).toBe(false);
    }
    expect(waitOf("museum-accent", input({ perColour: 37 })).text).toBe("Has 148 brands with a vivid accent (needs 150) and 520 public-domain works (needs 500).");
  });
  it("the check recomputes the counts and fails when the headline's numbers are not the stored numbers", () => {
    expect(CHECKS["museum-accent"](input()).pass).toBe(true);
    expect(museumAccentVerdict({ vivid: 160, works: 520, headline: 0 })).toMatchObject({ pass: false, reason: "The headline's numbers are not the stored numbers." });
  });
  it("a removed work holds nothing: with the orange works removed, orange joins the empty families", () => {
    const s = buildStory(MUSEUM_ACCENT_SLUG, input({ works: 600, removedOrange: true }), new Map())!;
    expect(s.fallbackHeadline).toBe("None of 540 museum works holds brand orange, green or pink");
  });
});
