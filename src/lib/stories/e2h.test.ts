// Phase E2h · the corrected deck stays corrected, a headline stored twice is one headline, the census recount, and "New this fortnight".
import { describe, expect, it } from "vitest";
import { brandFolds, type ShownStory } from "./editor";
import { censusLines } from "./view";
import type { Candidate, Fact } from "./types";
import { oneHeadline } from "../headline-text";
import { equalField, extractFields } from "../library-diff";
import { rangeWords, tapeLine, undated } from "../tape";
import { eventSentence } from "../agency/changes";
import { promoTexts } from "../promo";
import { censusCandidates, censusDue, censusStoryOf, recountRowId, type CensusCapture } from "../census";

const LINEAR = "The product development system for teams and agents";
const DOUBLED = `${LINEAR} ${LINEAR}`;

describe("1 · a correction's dates are not undone by an automatic update", () => {
  const member = (text: string): Fact => ({ text, href: "/brands/coinbase.com", basis: "measured", kind: "member" });
  const story: ShownStory = { id: "brand:coinbase.com:2026-11-20", type: "move", state: "published", happened_at: "2026-11-20T13:40:00Z", domains: ["coinbase.com"], headline: "Coinbase", deck: "Hero, video to still (between 11 and 14 Nov).", source_ids: ["event:4811", "event:4812"],
    facts: [member("Hero, video to still · between 11 and 14 Nov"), member("Headline, “Trusted by millions worldwide” to “The trusted financial account for you and your agents” · between 11 and 14 Nov")] };
  const cand = (texts: string[]) => ({ id: story.id, type: "move", kicker: "", headline: "Coinbase", deck: "Hero, video to still (20 Nov).", facts: texts.map(member), sector: "fintech", signalKeys: [], domains: ["coinbase.com"], evidence: [], sourceIds: [], basis: "measured", happenedAt: story.happened_at, magnitude: 2 }) as unknown as Candidate;
  it("the same changes dated by confirmation (20 Nov) are not new specifics: no fold, the dated deck stays", () => {
    expect(brandFolds([cand(["Hero, video to still · 20 Nov", "Headline, “Trusted by millions worldwide” to “The trusted financial account for you and your agents” · 20 Nov"])], [story], "2026-11-20T17:15:00Z").folds).toEqual([]);
  });
  it("a genuinely new change still folds in", () => {
    const f = brandFolds([cand(["Hero, video to still · 20 Nov", "Accent, Vivid blue to Vivid indigo · between 14 and 20 Nov"])], [story], "2026-11-20T17:15:00Z").folds;
    expect(f).toHaveLength(1); expect(f[0]!.added).toEqual(["Accent, Vivid blue to Vivid indigo · between 14 and 20 Nov"]);
  });
  it("a line without its date part; ranges read as the captures say", () => {
    expect(undated("Measured: Netlify · hero, none to still · between 14 and 20 Nov")).toBe("Measured: Netlify · hero, none to still");
    expect(undated("On · hero, video to still · 14 Nov · Seasonal")).toBe("On · hero, video to still · Seasonal");
    expect(undated("Brand · x · between 30 Oct and 2 Nov")).toBe("Brand · x");
    // No. 87: earliest old value last seen (On, 11 Nov) to latest new value first seen (Netlify, 20 Nov).
    expect(rangeWords("2026-11-11T22:25:03Z", "2026-11-20T05:53:38Z")).toBe("between 11 and 20 Nov");
    expect(rangeWords("2026-11-14T02:00:00Z", "2026-11-14T20:00:00Z")).toBe("on 14 Nov");
  });
});

describe("3 · a headline stored twice is one headline (Linear)", () => {
  it("collapses exactly the same phrase twice, and nothing else", () => {
    expect(oneHeadline(DOUBLED)).toBe(LINEAR);
    expect(oneHeadline(`${LINEAR}${LINEAR}`)).toBe(LINEAR);
    expect(oneHeadline(LINEAR)).toBe(LINEAR);
    expect(oneHeadline("Every scale. Every agent. One platform")).toBe("Every scale. Every agent. One platform");
    expect(oneHeadline("Go Go")).toBe("Go Go");
  });
  it("the doubled and single forms are the same headline: no change when the crawler's fix arrives", () => {
    expect(equalField("headline", DOUBLED, LINEAR)).toBe(true);
    const f = extractFields({ lexicon: { h1: DOUBLED } }, { page_type: "home", viewport: "desktop", sector: "dev-tools" });
    expect(f["headline"]).toBe(LINEAR);
  });
  it("tape lines, sentences and the texts the writer reads quote it once", () => {
    const e = { id: 1, domain: "linear.app", type: "message_pivot", before: { headline: "Plan and build products" }, after: { headline: DOUBLED }, page_type: "home", summary: "", detected_at: "2026-11-20T10:00:00Z" };
    expect(tapeLine(e as never)).toBe(`Linear · headline, “Plan and build products” to “${LINEAR}” · 20 Nov`);
    expect(eventSentence(e as never)).toContain(`→ “${LINEAR}”`);
    expect(promoTexts({ lx_h1: DOUBLED })).toEqual([LINEAR]);
  });
});

describe("2 · the census recount is a correction, not a new run", () => {
  const NOW = "2026-11-20T17:09:11Z", cap = (id: number, domain: string, at: string, h1: string): CensusCapture => ({ id, domain, at, source: "h1", h1, ctas: [] });
  const caps = Array.from({ length: 8 }, (_, i) => [cap(i * 2 + 1, `b${i}.com`, "2026-11-20T16:00:00Z", "Agents at work"), cap(i * 2 + 2, `b${i}.com`, "2026-11-20T15:00:00Z", "Agents at work"), cap(i * 2 + 100, `b${i}.com`, "2026-11-20T08:00:00Z", "Agents at work")]).flat();
  const sites = new Map(Array.from({ length: 8 }, (_, i) => [`b${i}.com`, { domain: `b${i}.com`, name: `B${i}`, sector: "ai" }]));
  const history = [{ census_key: "agents", day: "2026-11-20", count: 6, base: 6 }];
  it("the week's census does not run again; the recount counts it anyway, without an earlier count", () => {
    expect(censusCandidates({ now: NOW, census: { captures: caps, history }, events: [] }, sites, new Map()).filter(c => c.id.startsWith("census:agents"))).toEqual([]);
    const [c] = censusCandidates({ now: NOW, census: { captures: caps, history, recount: true }, events: [] }, sites, new Map()).filter(x => x.id.startsWith("census:agents"));
    expect(c!.id).toBe("census:agents:2026-W47"); expect(c!.census).toMatchObject({ count: 8, base: 8 }); expect(c!.deck).not.toMatch(/from 6/);
  });
  it("a recount row belongs to its story and is the count the next census compares with", () => {
    const row = recountRowId("census:agents:2026-W47", "2026-11-20T17:40:00Z");
    expect(censusStoryOf(row)).toBe("census:agents:2026-W47");
    const due = censusDue(18, [{ census_key: "agents", day: "2026-11-20", count: 14, base: 140 }, { census_key: "agents", day: "2026-11-20", count: 16, base: 162 }], "agents", "2026-11-27T10:00:00Z");
    expect(due).toMatchObject({ run: true, earlier: { count: 16 } });
  });
});

describe("4 · the census lines: new this fortnight first", () => {
  it("newly added members come first and are marked, then the rest in rank order", () => {
    const line = (name: string, d: string): Fact => ({ text: `${name} · “${name} for agents”`, href: `/brands/${d}`, basis: "measured", kind: "line" });
    const facts: Fact[] = [line("Vercel", "vercel.com"), line("Framer", "framer.com"), line("Coinbase", "coinbase.com"), line("Slack", "slack.com"), line("MongoDB", "mongodb.com"),
      { text: "Coinbase · headline, “a” to “b” · between 11 and 14 Nov", href: "/brands/coinbase.com", basis: "measured", kind: "member" },
      { text: "MongoDB · headline, “c” to “d” · between 11 and 13 Nov", href: "/brands/mongodb.com", basis: "measured", kind: "member" }];
    expect(censusLines(facts).map(l => [l.name, l.isNew])).toEqual([["Coinbase", true], ["MongoDB", true], ["Vercel", false], ["Framer", false], ["Slack", false]]);
  });
});
