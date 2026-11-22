// @vitest-environment node
// W1d · the first quiet-change story ran too thin: what a quiet change needs, "How we know" gives both dates, no empty section.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { quietCandidates, QUIET_NEEDS, type QuietInput } from "./quiet";
import { newsMatcher, type WireIn } from "./candidates";
import type { EventRow } from "../agency/changes";
import { quietRetire, W1D_RETIRE } from "./retire";
import { howWeKnowOf } from "./texts";
import { writerFacts, type FactSource } from "./writer-facts";
import { betweenDates } from "./capture-dates";
import { overlay, type StoredStory } from "./edits";
import { storyPage } from "./view";
import { recolour } from "./recolour";
import { leadPicture, type LeadPics } from "../lead-picture";
import { beatsDoc } from "../newsroom/docs";
import { StoryView } from "@/components/read/StoryView";

const NOW = "2026-11-21T12:00:00Z";
const sites = new Map([["acme.com", { domain: "acme.com", name: "Acmecorp", sector: "dev-tools", kind: "standard" }]]);
const m = newsMatcher([...sites.values()], []);
const wire = (o: Partial<WireIn> = {}): WireIn => ({ id: 1, title: "Something else entirely", url: "https://x", source: "Dezeen", source_kind: "rss", published_at: "2026-11-18T00:00:00Z", excerpt: null, ...o });
const seen = { before: "2026-11-13T09:00:00Z", after: "2026-11-20T10:33:51Z" };
const ev = (o: Partial<EventRow> = {}): EventRow => ({ id: 4905, domain: "acme.com", type: "type_change", before: { h1: "Figtree" }, after: { h1: "Systemia" }, detected_at: "2026-11-21T06:13:40Z", page_type: "about", source: "live", viewport: "desktop", snapshot_id: 2, prev_snapshot_id: 1, seen, ...o } as EventRow);
const shot = (path: string, first: string) => ({ domain: "acme.com", page: "about", path, first_seen_at: first, last_seen_at: first });
const pair = [shot("acme.com/page-about/2026-11-10-aaaaaaaa.webp", "2026-11-10T06:00:00Z"), shot("acme.com/page-about/2026-11-20-bbbbbbbb.webp", "2026-11-20T10:40:00Z")];
const input = (o: Partial<QuietInput> = {}): QuietInput => ({ assets: [], urls: { 1: "https://acme.com/about", 2: "https://acme.com/about" }, wire: [wire()], shots: pair, ...o });
const run = (events: EventRow[], q: QuietInput = input()) => quietCandidates({ now: NOW, events, quiet: q, matcher: m, sites });

describe("W1d · 1 · what a quiet change needs", () => {
  it("an accent, palette or theme change alone on another page never qualifies: it stays a tape line", () => {
    const r = run([ev({ type: "palette_shift", before: { accent: "#FB2180" }, after: { accent: "#130281" } }), ev({ id: 2, type: "palette_shift", before: { accent: "#111111", palette: ["#111111"] }, after: { accent: "#222222", palette: ["#222222"] } }), ev({ id: 3, type: "theme_flip", before: { theme: "light" }, after: { theme: "dark" } })]);
    expect(r.candidates).toEqual([]);
    expect(r.verdicts.map(v => v.outcome)).toEqual(["tape line", "colour follows content", "tape line"]);
  });
  it("a headline or body typeface change on another page at the same address qualifies, with the page's first screen before and after", () => {
    const r = run([ev({}), ev({ id: 5, before: { body: "Inter" }, after: { body: "Söhne" } })]);
    expect(r.candidates.map(c => c.id)).toEqual(["quiet:event:4905", "quiet:event:5"]);
    expect(r.candidates[0]!.sourceIds).toEqual(["event:4905", `page-from:${pair[0]!.path}`, `page-to:${pair[1]!.path}`]);
  });
  it("with no picture it does not run: no stored first screen, only one side, or the same picture on both sides", () => {
    for (const shots of [[], [pair[0]!], [pair[1]!], [pair[0]!, { ...pair[0]!, first_seen_at: "2026-11-12T00:00:00Z" }]]) {
      const r = run([ev({})], input({ shots }));
      expect([r.candidates.length, r.verdicts[0]!.outcome]).toEqual([0, "no picture"]);
    }
  });
  it("a picture taken more than a week after the change is not its after picture", () => {
    const r = run([ev({})], input({ shots: [pair[0]!, shot("acme.com/page-about/2026-11-30-cccccccc.webp", "2026-11-28T00:00:00Z")] }));
    expect(r.verdicts[0]!.outcome).toBe("no picture");
  });
  it("leads with the page's first screen before and after", () => {
    const none: LeadPics = { okCrop: () => true, hero: () => null, thumb: () => null, card: () => null, carousel: () => false, name: d => d, icon: () => null };
    const pic = (path: string, at: string) => ({ path, src: `/crops/${path}`, width: 1280, height: 800, at });
    const pl = leadPicture({ kind: "story", story: { id: "quiet:event:4905", type: "move", domains: ["acme.com"], happened_at: NOW, assetPair: { kind: "page-about", before: pic("p/old.webp", "2026-11-13T00:00:00Z"), after: pic("p/new.webp", "2026-11-20T00:00:00Z") } } }, none);
    expect([pl.kind, pl.rule, pl.items.map(i => [i.role, i.asset, i.section])]).toEqual(["pair", "quiet", [["before", "crop:p/old.webp", "About page · first screen"], ["after", "crop:p/new.webp", "About page · first screen"]]]);
  });
  it("retires No. 92 by rule with the visible line; a typeface story without a picture and theme alone too; icon stories never", () => {
    expect(W1D_RETIRE[quietRetire({ id: "quiet:event:4905", source_ids: ["event:4905"] }, { type: "palette_shift" })!]).toBe("Retired: one accent colour on one page is a line on the tape, not a story.");
    expect(quietRetire({ id: "quiet:event:9", source_ids: ["event:9"] }, { type: "theme_flip" })).toBe("theme");
    expect(quietRetire({ id: "quiet:event:9", source_ids: ["event:9"] }, { type: "type_change" })).toBe("picture");
    expect(quietRetire({ id: "quiet:event:9", source_ids: ["event:9", "page-from:a", "page-to:b"] }, { type: "type_change" })).toBeNull();
    expect(quietRetire({ id: "quiet:asset:acme.com:icon:2026-11-16", source_ids: [] }, { type: "palette_shift" })).toBeNull();
  });
  it("beats.md states both rules, from the code", () => {
    const beats = beatsDoc();
    for (const t of [QUIET_NEEDS.what, QUIET_NEEDS.notAlone, QUIET_NEEDS.picture]) expect(beats).toContain(t);
  });
});

// A stored story from a candidate, as the build stores it.
const stored = (c: ReturnType<typeof run>["candidates"][number], o: Partial<StoredStory> = {}): StoredStory => ({ id: c.id, type: c.type, status: "published", reason: "ran", score: 61, components: {}, why_ran: "", kicker: c.kicker, headline: c.headline, deck: c.deck, facts: c.facts,
  why_line: null, why_model: null, why_at: null, sector: c.sector, signal_keys: c.signalKeys, domains: c.domains, evidence: c.evidence, source_ids: c.sourceIds, basis: c.basis, happened_at: c.happenedAt, created_at: NOW, ...o } as StoredStory);
const deckDates = (deck: string, year = "2026") => betweenDates(deck, year);
const lineDates = (line: string) => { const m = /on (\d{1,2}) and (\d{1,2}) (November)/.exec(line); return m ? [`2026-11-${m[1]!.padStart(2, "0")}`, `2026-11-${m[2]!.padStart(2, "0")}`] : []; };

describe("W1d · 3 · How we know gives both capture dates, the same as the deck", () => {
  const c = run([ev({})]).candidates[0]!;
  it("the facts-built line names both dates the deck uses", () => {
    expect(c.deck).toContain("between 13 and 20 Nov");
    const line = howWeKnowOf(stored(c));
    expect(line).toBe("Measured from captures on 13 and 20 November.");
    expect(lineDates(line)).toEqual(deckDates(c.deck!));
  });
  const src = (seenToo: boolean): FactSource => ({ events: new Map([[4905, seenToo ? ev({}) : ev({ seen: null })]]), texts: new Map(), calls: {}, names: new Map(), known: [] });
  it("the writers' sheet carries both dates, with or without capture dates on the loaded event", () => {
    for (const withSeen of [true, false]) {
      const { facts, template } = writerFacts(stored(c), src(withSeen));
      expect(facts.dates).toEqual(["2026-11-13", "2026-11-20"]);
      expect(lineDates(template.how_we_know)).toEqual(deckDates(c.deck!));
    }
  });
  it("an older single change without capture-dated lines still reads its deck's dates", () => {
    expect(howWeKnowOf({ type: "move", basis: "measured", kicker: "Move", happened_at: "2026-11-20T00:00:00Z", deck: "A new typeface, between 13 and 20 Nov.", facts: [{ text: "Before: A", kind: "before" }, { text: "Confirmed on a second capture, 21 Nov", kind: "date" }] }))
      .toBe("Measured from captures on 13 and 20 November.");
  });
});

describe("W1d · 4 · no empty section", () => {
  const render = async (s: StoredStory) => {
    const [r] = overlay([s], [], Date.parse(NOW));
    const page = { ...storyPage(r!, { earlier: [], patterns: [] }), thumb: null, series: null };
    const root = createRootRoute({ component: () => createElement(StoryView, { s: page }) });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/stories/x"] }) });
    await router.load();
    return { page, html: renderToString(createElement(RouterProvider, { router } as never)) };
  };
  it("a quiet change lists what it stores: the two values, the page, the capture dates and the outlet count", async () => {
    const accent = ev({ type: "palette_shift", before: { accent: "#FB2180" }, after: { accent: "#130281" } });
    // No. 92's stored lines, as it ran.
    const s = stored(run([ev({})]).candidates[0]!, { facts: [
      { text: "Page: https://acme.com/about, the same address in both captures", href: "https://acme.com/about", basis: "measured", kind: "source" },
      { text: "Before: Vivid red", href: "/brands/acme.com", basis: "measured", kind: "before" }, { text: "After: Navy", href: "/brands/acme.com", basis: "measured", kind: "after" },
      { text: "Changed between 13 and 20 Nov, dated by the last capture before and the first capture after", href: "/brands/acme.com?view=data", basis: "measured", kind: "date" },
      { text: "We found no mention of the brand in the 8 outlets we read between 6 Nov 2026 and 21 Nov 2026", href: "/wire", basis: "measured", kind: "source" }] });
    const { page, html } = await render(s);
    expect(page.facts.map(f => f.text)).toEqual(["Page: https://acme.com/about, the same address in both captures", "Before: Vivid red", "After: Navy", "Changed between 13 and 20 Nov, dated by the last capture before and the first capture after", "We found no mention of the brand in the 8 outlets we read between 6 Nov 2026 and 21 Nov 2026"]);
    expect(html).not.toContain("No facts were stored");
    expect(recolour(s.facts as never, [accent]).filter(f => f.kind === "before" || f.kind === "after").map(f => f.text)).toEqual(["Before: Vivid pink", "After: Navy"]);
  });
  it("a single change with only before, after and its confirmation lists the before and after", async () => {
    const { page } = await render(stored(run([ev({})]).candidates[0]!, { facts: [{ text: "Before: Blue", href: "/brands/acme.com", basis: "measured", kind: "before" }, { text: "After: Red", href: "/brands/acme.com", basis: "measured", kind: "after" }, { text: "Confirmed on a second capture, 12 Nov", href: "/x", basis: "measured", kind: "date" }] }));
    expect(page.facts.map(f => f.text)).toEqual(["Before: Blue", "After: Red"]);
  });
  it("a story with nothing to list leaves the section out", async () => {
    const { page, html } = await render(stored(run([ev({})]).candidates[0]!, { facts: [{ text: "Confirmed on a second capture, 12 Nov", href: "/x", basis: "measured", kind: "date" }, { text: "Headline call: position. x", href: null, basis: "measured", kind: "source" }] as never }));
    expect(page.facts).toEqual([]);
    expect(html).not.toContain("data-story-changes"); expect(html).not.toContain("No facts were stored"); expect(html).not.toContain("The numbers");
  });
});
