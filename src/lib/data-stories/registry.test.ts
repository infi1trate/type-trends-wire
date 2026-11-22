import { describe, expect, it } from "vitest";
import { DATA_STORIES, WHERE_YOU_SIT, TEMPLATES, SERIES, RETIRED_NUMBERS, relatedFor } from "./registry";
import { BUILDERS, statusOf, indexRows } from "./build";
import { softwareVerdict, bigTypeVerdict, fintechVerdict, sectorMindsVerdict, museumVerdict } from "./checks";
import { pickBrands } from "./picker";

const VERDICT = { software: softwareVerdict, "big-type": bigTypeVerdict, "fintech-colour": fintechVerdict, "sector-minds": sectorMindsVerdict, museum: museumVerdict } as const;
describe("studies registry", () => {
  it("slugs and numbers are unique; the brand tool is not a study and number 5 is retired, never reused", () => {
    const slugs = [...DATA_STORIES.map(e => e.slug), WHERE_YOU_SIT.slug];
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(DATA_STORIES.map(e => e.number)).size).toBe(DATA_STORIES.length);
    expect(DATA_STORIES.map(e => e.number)).toEqual([1, 2, 3, 4, 6]);
    expect(RETIRED_NUMBERS).toEqual([5]);
    for (const n of RETIRED_NUMBERS) expect(DATA_STORIES.some(e => e.number === n)).toBe(false);
    expect("number" in WHERE_YOU_SIT).toBe(false);
    expect(DATA_STORIES.some(e => e.slug === WHERE_YOU_SIT.slug)).toBe(false);
  });
  it("every study belongs to one series, in the approved order", () => {
    expect(SERIES.map(s => s.id)).toEqual(["first-movers", "long-view", "sector-v-sector"]);
    expect(SERIES.map(s => s.title)).toEqual(["Who moved first", "The long view", "Sector against sector"]);
    for (const s of SERIES) { expect(s.description.split(/\s+/).length).toBeLessThan(20); expect(s.description).not.toMatch(/\d/); }
    const of = Object.fromEntries(DATA_STORIES.map(e => [e.number, e.series]));
    expect(of).toEqual({ 1: "long-view", 2: "first-movers", 3: "long-view", 4: "sector-v-sector", 6: "sector-v-sector" });
  });
  it("every live story passed its check on the recorded figures and has a builder; every draft carries a reason and failed", () => {
    for (const e of DATA_STORIES) {
      const v = e.check ? VERDICT[e.check](e.recorded as never) : null;
      if (e.status === "live") { expect(v?.pass, e.slug).toBe(true); expect(BUILDERS[e.slug], e.slug).toBeDefined(); expect(e.reason).toBeNull(); }
      else { expect(e.reason?.length ?? 0, e.slug).toBeGreaterThan(20); expect(v?.pass, e.slug).toBe(false); }
    }
    expect(DATA_STORIES.filter(e => e.status === "live").map(e => e.number)).toEqual([1, 2, 4, 6]);
    expect(DATA_STORIES.filter(e => e.hidden).map(e => e.number)).toEqual([6]);
    expect(DATA_STORIES.find(e => e.number === 3)?.status).toBe("draft");
  });
  it("templates come from the six views", () => {
    for (const e of DATA_STORIES) for (const t of e.templates) expect(Object.keys(TEMPLATES)).toContain(t);
  });
  it("a live story reads as a draft when its builder is missing; drafts keep their reason", () => {
    expect(statusOf({ ...DATA_STORIES[0]!, slug: "nope" }, null)).toMatchObject({ status: "draft" });
    expect(statusOf(DATA_STORIES[2]!, null)).toEqual({ status: "draft", reason: DATA_STORIES[2]!.reason });
  });
  it("the index lists every story in number order and links only live ones", () => {
    const rows = indexRows(null, null);
    expect(rows.map(r => r.number)).toEqual([1, 2, 3, 4]);
    expect(rows.filter(r => !r.href).map(r => r.number)).toEqual([3]);
  });
  it("related links stay in the study's own series, never itself, and end with All studies", () => {
    for (const e of DATA_STORIES) {
      const r = relatedFor(e.slug);
      expect(r.some(x => x.href === `/data/${e.slug}`)).toBe(false);
      expect(r.at(-1)).toEqual({ label: "All studies", href: "/data" });
      for (const x of r.filter(l => l.href.startsWith("/data/"))) expect(DATA_STORIES.find(d => `/data/${d.slug}` === x.href)?.series).toBe(e.series);
    }
  });
});
describe("brand picker", () => {
  const brands = [{ domain: "stripe.com", name: "Stripe", sector: "fintech" }, { domain: "linear.app", name: "Linear", sector: "dev-tools" }, { domain: "stripe-press.com", name: "Stripe Press", sector: "media" }];
  it("accepts only tracked brands, exact matches first", () => {
    expect(pickBrands(brands, "stripe").map(b => b.domain)).toEqual(["stripe.com", "stripe-press.com"]);
    expect(pickBrands(brands, "https://www.linear.app/features").map(b => b.domain)).toEqual(["linear.app"]);
    expect(pickBrands(brands, "example.com")).toEqual([]);
    expect(pickBrands(brands, "  ")).toEqual([]);
  });
});
