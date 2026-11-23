// W3d · with ICONS_SHOWN false the icon study does not exist for readers, whatever is stored: not live, not listed, not on the shelf or
// the Studies home, builds nothing, and its page (and so its share image and embed) answers missing.
import { describe, expect, it } from "vitest";
import { ICONS_SHOWN, MUSEUM_SHOWN } from "../site";
import { fxInput } from "./fixtures";
import { buildStory, dataShelf, indexRows, liveNow, statusOf } from "./build";
import { entryOf, liveEntries, relatedFor, withheld, ICONS_SLUG, MUSEUM_ACCENT_SLUG } from "./registry";
import { homeWithout, studiesHome, type HomeStudy } from "./shelf";
import { probeRows } from "../icons/__fixtures__/probe";
import { computeDataStory, loadDataStory } from "./page.server";

const e = entryOf(ICONS_SLUG)!;
describe("the icon study withheld (W3d)", () => {
  it("ships off, beside the museum switch", () => { expect(ICONS_SHOWN).toBe(false); expect(MUSEUM_SHOWN).toBe(false); expect(withheld(e)).toBe(true); });
  it("does not exist for readers even with a full week stored", () => {
    const i = { ...fxInput(), icons: probeRows() };
    expect(statusOf(e, i)).toEqual({ status: "draft", reason: "Withheld by the editor." });
    expect(indexRows(i, null).some(r => r.slug === ICONS_SLUG)).toBe(false);
    expect(liveNow(i).some(x => x.slug === ICONS_SLUG)).toBe(false);
    expect(liveEntries().some(x => x.slug === ICONS_SLUG)).toBe(false);
    expect(dataShelf().some(x => x.slug === ICONS_SLUG)).toBe(false);
    expect(relatedFor(MUSEUM_ACCENT_SLUG).some(l => l.href === `/data/${ICONS_SLUG}`)).toBe(false);
    expect(buildStory(ICONS_SLUG, i, new Map())).toBeNull();
  });
  it("a stored Studies home that held it loses it on read", () => {
    const st = { slug: ICONS_SLUG, number: 8, label: "Study No. 8", series: "beyond-homepage", seriesTitle: "", headline: "H", deck: "", question: "", dataThrough: null, href: `/data/${ICONS_SLUG}`, key: ICONS_SLUG, cover: null, changedAt: "2026-11-23" } as unknown as HomeStudy;
    const h = studiesHome([st], [{ key: ICONS_SLUG, question: "", series: "", wait: "", earliest: null, ready: false }]);
    expect(JSON.stringify(homeWithout(h, s => withheld({ slug: s })))).not.toContain(ICONS_SLUG);
    // Beyond the homepage holds only withheld studies (No. 7 and No. 8), so it is not listed at all.
    expect(studiesHome([], []).series.map(s => s.id)).toEqual(["first-movers", "long-view", "sector-v-sector"]);
  });
  it("its page answers missing before any read", async () => {
    expect(await computeDataStory(ICONS_SLUG)).toMatchObject({ kind: "missing" });
    expect(await loadDataStory(ICONS_SLUG)).toEqual({ kind: "missing" });
  });
});
