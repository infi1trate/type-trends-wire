import { describe, expect, it } from "vitest";
import { DAY, FEEDS, HN_QUERIES, RUN_RETENTION_DAYS, WIRE_RETENTION_DAYS, isDesignStory, parseFeed, parseHn, recentUnique, snapshotRows, stripHtml, tagText, type WireItem } from "./ingest";
describe("ingest rules", () => {
  it("uses the nine feeds and ten HN queries", () => { expect(FEEDS).toHaveLength(9); expect(HN_QUERIES).toEqual(["typeface", "font", "typography", "design system", "figma", "rebrand", "logo", "color palette", "web design", "ui design"]); });
  it("tags whole words across all seven categories", () => { expect(tagText("font palette logo figma css animation ai")).toEqual(["type", "color", "brand", "ui", "web", "motion", "ai"]); expect(tagText("chair waiting website")).toEqual(["web"]); });
  it("excludes AI-only and web-only HN titles", () => { expect(isDesignStory("AI agents in CSS")).toBe(false); expect(isDesignStory("A designer's website")).toBe(true); expect(isDesignStory("New variable font")).toBe(true); });
  it("strips HTML and limits excerpts to 280 characters", () => { expect(stripHtml("<b>Hello</b>&nbsp;&amp; world")).toBe("Hello & world"); expect(stripHtml("x".repeat(300))).toBe("x".repeat(279) + "…"); });
  it("parses RSS and rejects absent dates and unsafe URLs", () => {
    const rows = parseFeed('<rss><channel><item><title>Font</title><link>https://example.com/font</link><pubDate>2026-11-10</pubDate><description>Serif</description></item><item><title>Bad</title><link>javascript:alert(1)</link><pubDate>2026-11-10</pubDate></item><item><title>Undated</title><link>https://example.com/none</link></item></channel></rss>', "Dezeen");
    expect(rows).toEqual([{ title: "Font", url: "https://example.com/font", published_at: "2026-11-10T00:00:00.000Z", excerpt: "Serif", tags: ["type"], source: "Dezeen", source_kind: "rss" }]);
  });
  it("parses Atom alternate links and updated dates", () => {
    const rows = parseFeed('<feed><entry><title>Logo</title><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/logo"/><updated>2026-11-10</updated><summary>Branding</summary></entry></feed>', "Atom");
    expect(rows[0]?.url).toBe("https://example.com/logo"); expect(rows[0]?.published_at).toBe("2026-11-10T00:00:00.000Z");
  });
  it("uses HN discussion fallback and points/comments receipts", () => {
    const rows = parseHn({ hits: [{ title: "Typography", objectID: "123", created_at_i: 1794268800, points: 10, num_comments: 2 }, { title: "AI agents", created_at_i: 1794268800 }] });
    expect(rows).toHaveLength(1); expect(rows[0]?.url).toBe("https://news.ycombinator.com/item?id=123"); expect(rows[0]?.excerpt).toBe("10 points · 2 comments · https://news.ycombinator.com/item?id=123");
  });
  it("includes exactly seven-day boundary and deduplicates URL", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const item: WireItem = { url: "https://example.com", title: "Font", source: "Test", source_kind: "rss", published_at: new Date(now.getTime() - 7 * DAY).toISOString(), excerpt: null, tags: ["type"] };
    expect(recentUnique([item, { ...item, title: "Updated" }, { ...item, url: "https://example.com/old", published_at: new Date(now.getTime() - 7 * DAY - 1).toISOString() }], now)).toEqual([{ ...item, title: "Updated" }]);
  });
  it("uses one-based independent ranks, fallback rank and VF axes", () => {
    expect(snapshotRows([{ family: "A", category: "serif", axes: [{}] }, { family: "B", category: "serif" }], [{ family: "B", category: "serif" }], "2026-11-10")).toEqual([
      { family: "A", category: "serif", captured_on: "2026-11-10", popularity_rank: 1, trending_rank: 2, is_variable: true },
      { family: "B", category: "serif", captured_on: "2026-11-10", popularity_rank: 2, trending_rank: 1, is_variable: false },
    ]);
  });
  it("retains wire for 90 days", () => { expect(WIRE_RETENTION_DAYS).toBe(90); });
  it("retains run receipts for 30 days", () => { expect(RUN_RETENTION_DAYS).toBe(30); });
});