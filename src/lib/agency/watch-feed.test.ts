// @vitest-environment node
import { describe, expect, it } from "vitest";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { FEED_MAX, WATCH_FEED_HEADERS, watchFeedXml, watchItems, watchView, sinceFor } from "./watch-feed";
import { feedRows } from "./test-fixtures";

const ID = "A".repeat(22), FEED = "F".repeat(22);

describe("watch items", () => {
  const items = watchItems(feedRows(), sinceFor("2026-11-15T18:00:00Z", "30d"));
  const by = (g: string) => items.find(i => i.guid === g);
  it("site changes in plain words with readable color names, only for watched sites", () => {
    expect(by("event-1")!.title).toMatch(/^Linear changed its accent: .+ → .+$/);
    expect(by("event-1")!.title).not.toContain("#");
    expect(items.some(i => i.domain === "other.com")).toBe(false);
  });
  it("stage changes for named traits (all + list sectors) and site traits (all only); alerts for both", () => {
    expect(by("stage-9-all-css:subgrid")!.title).toBe("Subgrid layouts [LAYOUT] moved from Emerging to Rising in all sectors (6.1% of sites)");
    expect(by("stage-9-all-theme:dark")!.detail).toBe("Shown by linear.app");
    expect(by("stage-9-fintech-theme:dark")).toBeUndefined();
    expect(by("stage-9-dev-tools-css:subgrid")).toBeUndefined();
    expect(by("stage-9-all-css:has")).toBeUndefined();
    expect(by("alert-55")!.title).not.toContain("$");
    expect(by("alert-56")).toBeUndefined();
  });
  it("weekly summary item after each weekly run with changes", () => {
    expect(by("summary-2026-W46")!.title).toBe("This week on Acme & co: 2 site changes, 2 trait stage changes");
    expect(by("summary-2026-W45")!.title).toBe("This week on Acme & co: 1 site change");
  });
  it("newest first with stable guids", () => {
    const again = watchItems(feedRows(), sinceFor("2026-11-15T18:00:00Z", "30d"));
    expect(again.map(i => i.guid)).toEqual(items.map(i => i.guid));
    expect([...items].sort((a, b) => b.at.localeCompare(a.at)).map(i => i.at)).toEqual(items.map(i => i.at));
  });
  it("watch page: week range, no summaries, plain-words empty state", () => {
    const v = watchView(feedRows(), "week");
    expect(v.items.every(i => i.kind !== "summary" && i.at > "2026-11-08T18:00:00Z")).toBe(true);
    const quiet = { ...feedRows(), events: [], rebrands: [], stages: [], alerts: [], lastEvent: feedRows().events[1]! };
    expect(watchView(quiet, "week").empty).toBe("Nothing changed on these 2 sites or signals this week. Last change: Vercel changed its headline: “Ship faster” → “Build & ship <AI>”, 2026-11-02.");
  });
});

describe("watch RSS feed", () => {
  const xml = watchFeedXml(feedRows(80));
  it("is well-formed RSS 2.0 with atom:link self", () => {
    expect(XMLValidator.validate(xml)).toBe(true);
    const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
    expect(doc.rss["@_version"]).toBe("2.0");
    expect(doc.rss.channel["atom:link"]["@_href"]).toBe(`https://slug.global/api/public/watch-feed/${FEED}.xml`);
    expect(doc.rss.channel["atom:link"]["@_rel"]).toBe("self");
    const items = doc.rss.channel.item as { title: string; guid: { "#text": string }; link: string; pubDate: string }[];
    expect(items.length).toBe(FEED_MAX);
    expect(new Set(items.map(i => i.guid["#text"])).size).toBe(items.length);
    expect(items[0]!.link).toMatch(new RegExp(`^https://slug\\.global/watch/${ID}#c-`));
    expect(items.every(i => !Number.isNaN(Date.parse(i.pubDate)))).toBe(true);
  });
  it("names come from labels, no $ tickers, escaped text", () => {
    expect(xml).toContain("Subgrid layouts");
    expect(xml).not.toMatch(/\$[A-Z]/);
    expect(xml).toContain("Acme &amp; co");
    expect(watchFeedXml(feedRows())).toContain("&lt;AI&gt;");
  });
  it("headers: RSS content type, 15-minute public cache, noindex", () => {
    expect(WATCH_FEED_HEADERS).toEqual({ "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900", "X-Robots-Tag": "noindex" });
  });
});
