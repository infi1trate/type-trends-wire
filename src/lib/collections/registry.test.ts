import { describe, expect, it } from "vitest";
import { COLLECTIONS, COLLECTION_MIN, collectionForStory, collectionStatus, liveCollections } from "./registry";
import { DATA_STORIES } from "../data-stories/registry";
import { SURFACES } from "../ia";
import { NO_FILTER } from "../gallery";

describe("collections registry", () => {
  it("the minimum is 12, checked on both sides", () => {
    expect(COLLECTION_MIN).toBe(12);
    expect(collectionStatus(12)).toEqual({ status: "live", reason: null });
    expect(collectionStatus(11)).toEqual({ status: "draft", reason: "11 captures match its filter so far; a collection needs at least 12." });
  });
  it("unique slugs and numbers", () => {
    expect(new Set(COLLECTIONS.map(c => c.slug)).size).toBe(COLLECTIONS.length);
    expect(new Set(COLLECTIONS.map(c => c.number)).size).toBe(COLLECTIONS.length);
  });
  it("the five starting collections, each live one clearing the minimum on its recorded count; drafts carry a reason", () => {
    expect(COLLECTIONS.map(c => c.title)).toEqual(["Fintech heroes, this quarter", "Who went big", "Dark pages in dev tools", "Changed this month", "The software homepage, 2021 to now"]);
    for (const c of COLLECTIONS) {
      if (c.status === "live") expect(c.recorded).toBeGreaterThanOrEqual(COLLECTION_MIN);
      else expect(c.reason).toBeTruthy();
    }
  });
  it("every filter is a gallery filter", () => {
    const keys = new Set(Object.keys(NO_FILTER));
    for (const c of COLLECTIONS) for (const k of Object.keys(c.filter)) expect(keys.has(k)).toBe(true);
  });
  it("pairing links resolve, and data stories link back", () => {
    for (const c of COLLECTIONS) {
      expect(c.pairs.href.startsWith("/")).toBe(true);
      if (c.pairs.dataStory) {
        expect(DATA_STORIES.some(s => s.slug === c.pairs.dataStory)).toBe(true);
        expect(c.pairs.href).toBe(`/data/${c.pairs.dataStory}`);
        expect(collectionForStory(c.pairs.dataStory)).toEqual({ label: `Collection ${c.number}: ${c.title}`, href: `/collections/${c.slug}` });
      }
    }
    expect(collectionForStory("not-a-story")).toBeNull();
  });
  it("both routes are registered under Patterns", () => {
    expect(SURFACES["collections.index"]!.section).toBe("patterns");
    expect(SURFACES["collections.$slug"]!.section).toBe("patterns");
    expect(liveCollections().length).toBeGreaterThan(0);
  });
});
