// Phase E2c · the carousel rule, the fragment guard, shares beside their bases, and kept crops — each on the 20 Nov data where it applies.
import { describe, expect, it, vi } from "vitest";
import day20 from "./golden/__fixtures__/day-2026-11-20.json";
import { runGolden } from "./golden/run";
import type { BuildInput } from "./candidates";
import { callHeadline, CAROUSEL_REASON, FRAGMENT_REASON, ruleCall } from "./headline-call";
import { carouselEventIds, isCarouselSignals, withoutRotation } from "../carousel";
import { tapeLine } from "../tape";
import { librarySnapshotsPayload } from "../library-payload";
import { checkText, shareBaseFailures, shareFits, type WriterFacts } from "./writer";
import { baseOf, shareLine } from "./writer-facts";
import { latestTexts, type TextRow } from "./texts";
import { cropEvictions, type CropRow } from "../crops";
import { keepFromEvidence, withKept, type StoryEvidence } from "./evidence";
import { toCrop } from "../crops";

const input = day20 as unknown as BuildInput;
const SOFI_HEADLINE = 4783, SOFI_FONT = 4782, SOFI_IMAGERY = 4784, SOFI_SNAPSHOT = 7619;
const tells = (p: { sourceIds: string[] }, id: number) => p.sourceIds.includes(`event:${id}`) || p.sourceIds.includes(`story:move:${id}`);

describe("E2c · the SoFi change of 20 Nov", () => {
  it("the fixture holds the change: “NEW IPO” → “Bank smarter–” and TT Norms → Larsseit on snapshot 7619", () => {
    const h = input.events.find(e => e.id === SOFI_HEADLINE)!, f = input.events.find(e => e.id === SOFI_FONT)!;
    expect(h.after).toEqual({ headline: "Bank smarter–" }); expect(h.snapshot_id).toBe(SOFI_SNAPSHOT); expect(f.type).toBe("type_change");
  });
  it("until the crawler sends the flag: a headline ending in a dash is a fragment, called unclear in code (held), never a story", () => {
    expect(ruleCall("NEW IPO", "Bank smarter–")).toEqual({ call: "unclear", reason: FRAGMENT_REASON, source: "rule" });
    for (const h of ["Bank smarter -", "Meet the new:", "Fast, simple,"]) expect(ruleCall("Old line here", h)?.call).toBe("unclear");
    // As the page read before the flag existed (E2f: the fixture now carries the page's inherited flag, so drop it here).
    const { plan, all } = runGolden({ ...input, carousel: [] });
    // The stored call for this change said "position"; the code call wins over it.
    expect(all.candidates.find(c => c.id === `call:${SOFI_HEADLINE}`)?.holdReason).toMatch(/unclear headline call/);
    expect(plan.filter(p => p.status === "published").some(p => tells(p, SOFI_HEADLINE))).toBe(false);
    // The headline typeface change on the same page is judged as before.
    expect(plan.some(p => p.id === "brand:sofi.com:2026-11-20" && tells(p, SOFI_FONT))).toBe(true);
  });
  it("with layout.hero_carousel on either capture: product rotation, reason “carousel”, made in code with no AI call", async () => {
    const ask = vi.fn(async () => ({ call: "position", reason: "x" }));
    const c = await callHeadline("NEW IPO", "Bank smarter– 4.40% savings APY for up to six months.*", ask, "m", "SoFi", { carousel: true });
    expect(c).toMatchObject({ call: "product_rotation", reason: CAROUSEL_REASON, source: "rule" }); expect(ask).not.toHaveBeenCalled();
  });
  it("a carousel headline, hero or imagery change is a tape line marked Carousel and cannot make or join a story; type is judged as before", () => {
    const carousel = { ...input, carousel: [SOFI_SNAPSHOT] } as BuildInput, { plan, all } = runGolden(carousel);
    expect(all.tape[SOFI_HEADLINE]).toMatch(/^SoFi · headline, .* · 20 Nov · Carousel$/);
    expect(all.tape[SOFI_IMAGERY]).toMatch(/· Carousel$/);
    expect(all.tape[SOFI_FONT]).not.toMatch(/Carousel/);
    for (const id of [SOFI_HEADLINE, SOFI_IMAGERY]) expect(plan.some(p => tells(p, id)), String(id)).toBe(false);
    expect(all.candidates.some(c => c.id === `call:${SOFI_HEADLINE}`)).toBe(false);
    expect(plan.some(p => p.id === "brand:sofi.com:2026-11-20" && tells(p, SOFI_FONT))).toBe(true);
  });
  it("carousel helpers: only an explicit true counts; a layout change keeps its other fields without the hero", () => {
    expect(isCarouselSignals({ layout: { hero_carousel: true } })).toBe(true);
    expect(isCarouselSignals({ layout: { hero_carousel: "yes" } })).toBe(false);
    const e = { id: 1, type: "layout_change", before: { hero_media: "image", h1_align: "center" }, after: { hero_media: "video", h1_align: "left" }, snapshot_id: 9, prev_snapshot_id: 8 };
    expect(carouselEventIds([e], new Set([8]))).toEqual(new Set([1]));
    expect(withoutRotation(e)).toMatchObject({ before: { h1_align: "center" }, after: { h1_align: "left" } });
    expect(withoutRotation({ ...e, before: { hero_media: "image" }, after: { hero_media: "video" } })).toBeNull();
    expect(tapeLine({ domain: "sofi.com", type: "message_pivot", before: { headline: "NEW IPO" }, after: { headline: "Bank smarter–" }, page_type: "home", summary: null, detected_at: "2026-11-20T10:52:07Z" }, { carousel: true }, "SoFi")).toBe("SoFi · headline, “NEW IPO” to “Bank smarter–” · 20 Nov · Carousel");
  });
  it("intake accepts layout.hero_carousel and keeps it in the stored signals", () => {
    const snap = { domain: "sofi.com", page_type: "home", viewport: "desktop", captured_at: "2026-11-21T10:00:00Z", url: "https://sofi.com", signals: { layout: { hero_media: "image", hero_carousel: true } } };
    const r = librarySnapshotsPayload.safeParse({ kind: "library_snapshots", snapshots: [snap] });
    expect(r.success).toBe(true);
    expect(r.success && r.data.snapshots[0]!.signals.layout).toEqual({ hero_media: "image", hero_carousel: true });
  });
});

describe("E2c · a share sits beside the base it was counted on", () => {
  const facts: WriterFacts = { type: "white_space", kind: "White space", sector: "Health", brands: [], changes: [], copy: [], headline_call: null,
    numbers: [{ text: "Technical voice: 4 of 29 tracked Health homepages with an AI read (13.8%)", basis: "ai" }, { text: "Technical voice: 145 of 281 tracked homepages with an AI read (51.6%)", basis: "ai" }, { text: "30 tracked health brands", basis: null as never }], lines: [], dates: ["2026-11-16"], rebrand: false };
  const body = ["Health homepages mostly talk to patients in plain words. Only a handful lean on product jargon, specifications or code, and most of those sell lab tests or devices rather than care itself.", "Elsewhere the technical voice is the default for a little over half of the library, led by dev tools, where nearly every homepage speaks to engineers first and buyers second."];
  const text = (deck: string) => ({ headline: "Health homepages rarely sound technical", deck, body, how_we_know: "Our read of homepage copy, an AI estimate." });
  it("rejects “13.8% of the 30 tracked health homepages” (13.8% is 4 of 29) and accepts it beside 29", () => {
    expect(checkText(text("On 16 November, 13.8% of the 30 tracked health homepages used a technical voice."), facts, { names: [] }, { requireBody: true })).toContain("a share beside the wrong base: 13.8% of 30");
    expect(checkText(text("On 16 November, 13.8% of the 29 tracked health homepages used a technical voice."), facts, { names: [] }, { requireBody: true })).toEqual([]);
  });
  it("reads the base on either side and at the precision written", () => {
    expect(shareBaseFailures("Across all 300 tracked homepages, 51.6% use a technical voice.")).toEqual(["a share beside the wrong base: 51.6% of 300"]);
    expect(shareBaseFailures("Across all 281 tracked homepages, 51.6% use it. 30% of 30 dev tools homepages show charts.")).toEqual([]);
    expect(shareFits("21", 30)).toBe(false); expect(shareFits("23.3", 30)).toBe(true); expect(shareFits("13.8", 29)).toBe(true);
  });
  it("the writer's facts carry each share's own count and base", () => {
    const q = [{ q: "2026Q3", n: 0, s: null }, { q: "2026Q4", n: 29, s: 0.13793103448275862 }];
    expect(baseOf(q, 0.137931034482758)).toEqual({ count: 4, base: 29 });
    expect(baseOf(q, 0.5)).toBeNull();
    expect(shareLine({ name: "Technical voice", share: 0.137931034482758, where: "Health ", basis: "ai", base: { count: 4, base: 29 }, stage: "Steady" })).toBe("Technical voice: 4 of 29 tracked Health homepages with an AI read (13.8%), Steady");
    expect(shareLine({ name: "Technical voice", share: 0.137931034482758, where: "Health ", basis: "ai", base: null })).toBe("Technical voice: 13.8% of tracked Health homepages");
  });
  it("a stored version with a share beside the wrong base is not shown; the earlier good version (or the template) is", () => {
    const row = (version: number, deck: string): TextRow => ({ story_id: "white:health:2026-W47", version, headline: "Health homepages rarely sound technical", deck, body: [], how_we_know: "Our read.", model: "m", created_at: `2026-11-1${version}T00:00:00Z` });
    expect(latestTexts([row(1, "13.8% of the 29 tracked health homepages."), row(2, "13.8% of the 30 tracked health homepages.")]).get("white:health:2026-W47")?.version).toBe(1);
    expect(latestTexts([row(2, "13.8% of the 30 tracked health homepages.")]).size).toBe(0);
  });
});

describe("E2c · a published story keeps the crops it cites", () => {
  const crop = (id: number, day: number, hash = `h${id}`): CropRow & { id: number } => ({ id, domain: "dropbox.com", section: "hero", viewport: "desktop", captured_at: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`, first_seen_at: "", last_seen_at: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`, path: `dropbox.com/hero/2026-11-${String(day).padStart(2, "0")}-${hash.padEnd(8, "0").slice(0, 8)}.webp`, width: 1280, height: 800, bytes: 1000, hash });
  const rows = Array.from({ length: 14 }, (_, i) => crop(i + 1, i + 1));
  it("history evicts beyond the newest 12, but never a kept crop, and a kept crop does not count toward the 12", () => {
    expect(cropEvictions(rows).map(r => r.id)).toEqual([2, 1]);
    expect(cropEvictions(rows, 12, new Set([1])).map(r => r.id)).toEqual([2]);
    expect(cropEvictions(rows, 12, new Set([1, 2])).map(r => r.id)).toEqual([]);
  });
  it("the story page shows the kept pair, not a newer version", () => {
    const ev: StoryEvidence = { section: "hero", sectionName: "Hero", compare: null, after: toCrop(rows[13]!), grid: null, note: null };
    const kept = [{ path: rows[2]!.path, domain: "dropbox.com", role: "before" as const }, { path: rows[3]!.path, domain: "dropbox.com", role: "after" as const }];
    const shown = withKept(ev, kept, rows);
    expect(shown.compare?.before.src).toBe(`/crops/${rows[2]!.path}`); expect(shown.compare?.after.src).toBe(`/crops/${rows[3]!.path}`); expect(shown.after).toBeNull();
    // Removed by an owner's request: the kept rows point at nothing, and the page falls back to what is stored.
    expect(withKept(ev, kept, rows.slice(5))).toEqual(ev);
    expect(keepFromEvidence(shown)).toEqual(kept);
  });
});
