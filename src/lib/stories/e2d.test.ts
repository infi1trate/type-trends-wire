// Phase E2d · the carousel rule widened to colour, the studio rule, and the page a retired story keeps — on the 20 Nov data where it applies.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// P2 · these tests build whole story days from fixtures (1.5 to 4 s alone); under the full suite's load they ran past vitest's 5 s default.
vi.setConfig({ testTimeout: 30_000 });
import day20 from "./golden/__fixtures__/day-2026-11-20.json";
import { runGolden } from "./golden/run";
import type { BuildInput } from "./candidates";
import { carouselEventIds, isShowcaseSector, withoutRotation } from "../carousel";
import { changeOf } from "./editor";
import type { EventRow } from "../agency/changes";
import { sourceEventIds } from "./page.server";
import { storyPage, type StoryRecord } from "./view";

const input = day20 as unknown as BuildInput;
const WOLFF_PALETTE = 4766, WOLFF_HERO = 4767, PENTAGRAM_PALETTE = 4776, RAGGED_PALETTE = 3687, WOLFF_SNAPSHOT = 7509;
const tells = (p: { sourceIds: string[] }, id: number) => p.sourceIds.includes(`event:${id}`) || p.sourceIds.includes(`story:move:${id}`);
const published = (b: BuildInput) => runGolden(b).plan.filter(p => p.status === "published");

describe("E2d · studio homepages are showcases", () => {
  it("the fixture holds the 20 Nov studio changes: Wolff Olins palette + image → video, Pentagram and Ragged Edge palettes", () => {
    const by = new Map(input.events.map(e => [e.id, e]));
    expect(by.get(WOLFF_PALETTE)?.type).toBe("palette_shift"); expect(by.get(WOLFF_HERO)?.after).toEqual({ hero_media: "video" });
    expect(by.get(PENTAGRAM_PALETTE)?.domain).toBe("pentagram.com"); expect(by.get(RAGGED_PALETTE)?.domain).toBe("ragged-edge.com");
  });
  it("none of the Wolff Olins, Pentagram and Ragged Edge changes of 20 Nov makes a story; each stays a tape line", () => {
    const { plan, all } = runGolden(input);
    for (const d of ["wolffolins.com", "pentagram.com", "ragged-edge.com"]) expect(all.candidates.some(c => c.id.startsWith(`brand:${d}:`)), d).toBe(false);
    for (const id of [WOLFF_PALETTE, WOLFF_HERO, PENTAGRAM_PALETTE, RAGGED_PALETTE]) {
      expect(plan.filter(p => p.status === "published" && p.domains.length === 1).some(p => tells(p, id)), String(id)).toBe(false);
      expect(all.tape[id], String(id)).toBeTruthy();
    }
    // A palette on a studio homepage joins no story at all, gathered or not (as on an editorial homepage).
    for (const id of [WOLFF_PALETTE, PENTAGRAM_PALETTE, RAGGED_PALETTE]) expect(plan.filter(p => p.status === "published").some(p => tells(p, id)), String(id)).toBe(false);
  });
  it("after the rule the 20 Nov lead is Netlify, not Wolff Olins", () => {
    const p = published(input).filter(x => x.happenedAt.slice(0, 10) === "2026-11-20" && x.domains.length === 1);
    expect(p.some(x => x.id === "brand:netlify.com:2026-11-20")).toBe(true);
    expect(p.some(x => x.id === "brand:wolffolins.com:2026-11-20")).toBe(false);
  });
  it("a studio's own typeface change is judged as before", () => {
    const font = { ...input.events.find(e => e.id === PENTAGRAM_PALETTE)!, id: 990001, type: "type_change", before: { h1: "Helvetica Now Display" }, after: { h1: "Söhne Breit" } };
    const { all } = runGolden({ ...input, events: [...input.events, font] } as BuildInput);
    expect(all.candidates.some(c => c.id.startsWith("brand:pentagram.com:") && c.sourceIds.includes("event:990001"))).toBe(true);
  });
  it("decided from the sector: palette, accent and hero count for nothing on a studio; fonts, headline and alignment still count", () => {
    expect(isShowcaseSector("studios")).toBe(true); expect(isShowcaseSector("media")).toBe(false); expect(isShowcaseSector(null)).toBe(false);
    const ev = (type: string, before: object, after: object) => ({ id: 1, domain: "pentagram.com", sector: "studios", type, before, after, detected_at: "2026-11-20T10:00:00Z" }) as unknown as EventRow;
    const studio = { showcase: true };
    expect(changeOf(ev("palette_shift", { accent: "#000" }, { accent: "#fff" }), "standard", null, studio).dims).toEqual([]);
    expect(changeOf(ev("palette_shift", { accent: "#000" }, { accent: "#fff" }), "standard", null).dims).toEqual(["colour"]);
    expect(changeOf(ev("layout_change", { hero_media: "image", h1_align: "center" }, { hero_media: "video", h1_align: "left" }), "standard", null, studio).things).toEqual(["headline alignment"]);
    expect(changeOf(ev("type_change", { h1: "Helvetica Now Display" }, { h1: "Söhne Breit" }), "standard", null, studio).typeface).toBe(true);
    expect(changeOf(ev("message_pivot", { headline: "We design" }, { headline: "We build brands for AI" }), "standard", "position", studio).position).toBe(true);
  });
  it("gathered stories that include studios are unaffected: the video-hero roundup still gathers Frog (golden item 7 checks Studio Dumbar too)", () => {
    const r = published(input).find(p => p.id.startsWith("roundup:") && p.signalKeys.includes("hero_media:video"));
    expect(r?.domains).toEqual(expect.arrayContaining(["frog.co"]));
  });
});

describe("E2d · the carousel rule covers colour", () => {
  it("a palette or accent change on a carousel is a rotation; type and layout are judged as before", () => {
    const pal = { id: 1, type: "palette_shift", before: { palette: ["#000"], accent: "#111" }, after: { palette: ["#fff"], accent: "#222" }, snapshot_id: 9, prev_snapshot_id: 8 };
    expect(carouselEventIds([pal], new Set([9]))).toEqual(new Set([1]));
    expect(withoutRotation(pal)).toBeNull();
    expect(carouselEventIds([{ ...pal, type: "type_change", before: { h1: "A" }, after: { h1: "B" } }], new Set([9])).size).toBe(0);
    expect(withoutRotation({ ...pal, type: "layout_change", before: { cta_radius_px: 4 }, after: { cta_radius_px: 12 } })).toMatchObject({ after: { cta_radius_px: 12 } });
  });
  it("on a carousel page outside the studios, a palette change is marked Carousel and never makes or joins a story", () => {
    const netlifyPalette = input.events.find(e => e.domain === "netlify.com" && e.type === "palette_shift")!;
    const { all, plan } = runGolden({ ...input, carousel: [netlifyPalette.snapshot_id!] } as BuildInput);
    expect(all.tape[netlifyPalette.id]).toMatch(/· Carousel$/);
    expect(plan.filter(p => p.status === "published").some(p => tells(p, netlifyPalette.id))).toBe(false);
  });
  it("the Wolff Olins palette and hero on its flagged snapshot are marked Carousel on the tape", () => {
    const { all } = runGolden({ ...input, carousel: [WOLFF_SNAPSHOT] } as BuildInput);
    for (const id of [WOLFF_PALETTE, WOLFF_HERO]) expect(all.tape[id]).toMatch(/· Carousel$/);
  });
});

describe("E2d · a retired story keeps its page", () => {
  const rec = { id: "brand:wolffolins.com:2026-11-20", type: "move", state: "killed", number: 86, killReason: "Retired: the first screen is a rotating showcase; the video and the colours belong to one slide",
    headline: "Wolff Olins swapped its still for video", deck: null, kicker: "Identity change", happened_at: "2026-11-20T09:33:45Z", sector: "studios", domains: ["wolffolins.com"], signal_keys: [],
    facts: [], evidence: [], source_ids: ["event:4766", "event:4767", "story:move:4767", "rebrand:x"], basis: "measured", score: 50, reason: "", edits: [], correctedAt: null, pinnedUntil: null } as unknown as StoryRecord;
  it("keeps its number, headline and note; the page reads the tape lines from its sources", () => {
    const p = storyPage(rec, { earlier: [], patterns: [] });
    expect(p.headline).toBe("Wolff Olins swapped its still for video"); expect(p.killReason).toMatch(/^Retired: the first screen/);
    expect(p.brands.map(b => b.href)).toEqual(["/brands/wolffolins.com"]);
    expect(sourceEventIds(rec.source_ids)).toEqual([4766, 4767]);
  });
  it("a held story still has no number on its page", () => expect(storyPage({ ...rec, state: "held" } as StoryRecord, { earlier: [], patterns: [] }).number).toBeNull());
  it("the page is sent with a do-not-index header whenever the story did not run", () => {
    expect(readFileSync("src/routes/stories.$id.tsx", "utf8")).toContain('headers: ({ loaderData }) => (loaderData && (loaderData.data || !loaderData.ran) ? DATA_VIEW_HEADERS : undefined)');
  });
});
