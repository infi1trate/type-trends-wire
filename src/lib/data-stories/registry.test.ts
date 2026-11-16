import { describe, expect, it } from "vitest";
import { DATA_STORIES, WHERE_YOU_SIT, TEMPLATES, relatedFor } from "./registry";
import { BUILDERS, statusOf, indexRows } from "./build";
import { softwareVerdict, bigTypeVerdict, fintechVerdict, sectorMindsVerdict } from "./checks";
import { pickBrands } from "./picker";

const VERDICT = { software: softwareVerdict, "big-type": bigTypeVerdict, "fintech-colour": fintechVerdict, "sector-minds": sectorMindsVerdict } as const;
describe("data stories registry", () => {
  it("slugs and numbers are unique, including the reader's own story", () => {
    const all = [...DATA_STORIES.map(e => [e.slug, e.number] as const), [WHERE_YOU_SIT.slug, WHERE_YOU_SIT.number] as const];
    expect(new Set(all.map(x => x[0])).size).toBe(all.length);
    expect(new Set(all.map(x => x[1])).size).toBe(all.length);
  });
  it("every live story passed its check on the recorded figures and has a builder; every draft carries a reason and failed", () => {
    for (const e of DATA_STORIES) {
      const v = e.check ? VERDICT[e.check](e.recorded as never) : null;
      if (e.status === "live") { expect(v?.pass, e.slug).toBe(true); expect(BUILDERS[e.slug], e.slug).toBeDefined(); expect(e.reason).toBeNull(); }
      else { expect(e.reason?.length ?? 0, e.slug).toBeGreaterThan(20); expect(v?.pass, e.slug).toBe(false); }
    }
    expect(DATA_STORIES.filter(e => e.status === "live").map(e => e.number)).toEqual([1, 2, 4]);
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
    expect(rows.map(r => r.number)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.filter(r => !r.href).map(r => r.number)).toEqual([3]);
  });
  it("every story ends with three related links, never itself", () => {
    for (const e of DATA_STORIES) { const r = relatedFor(e.slug); expect(r).toHaveLength(3); expect(r.some(x => x.href === `/data/${e.slug}`)).toBe(false); }
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
