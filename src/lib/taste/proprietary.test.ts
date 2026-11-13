// @vitest-environment node
import { describe, it, expect } from "vitest";
import { brandToken, buildFontCatalog, classifyLicense } from "./fonts";
import { chooseScope, minSites } from "./eligibility";
import { typeInput } from "./schema";
import { normalizeFont as k } from "../library-diff";

const byKey = (rows: ReturnType<typeof buildFontCatalog>) => new Map(rows.map(r => [r.key, r]));

describe("proprietary font classification", () => {
  it("derives brand tokens from the registrable label minus TLD", () => {
    expect(brandToken("www.coinbase.com")).toBe("coinbase");
    expect(brandToken("airbnb.co.uk")).toBe("airbnb");
    expect(brandToken("x.ai")).toBeNull();
  });
  it("marks a family proprietary when it contains a using domain's brand token", () => {
    const rows = byKey(buildFontCatalog(["Brex Grotesk"], [], new Map([["brexgrotesk", new Set(["brex.com", "a.com"])]])));
    expect(rows.get("brexgrotesk")).toMatchObject({ license_hint: "proprietary", license_reason: "brand_token" });
  });
  it("marks curated bespoke faces proprietary, including every Coinbase cut", () => {
    for (const name of ["Airbnb Cereal", "Uber Move", "Netflix Sans", "Google Sans", "Product Sans", "Optimistic Display", "Shopify Sans", "Atlassian Sans", "Arcadia Text", "Coinbase Sans", "Coinbase Text", "Coinbase Display"]) {
      const r = classifyLicense(k(name), { google: false });
      expect(r.license_hint, name).toBe("proprietary");
      expect(r.license_reason, name).toBe("curated_bespoke");
    }
  });
  it("keeps the explicit non-proprietary exceptions", () => {
    const rows = byKey(buildFontCatalog(["Söhne", "SF Pro", "San Francisco", "Mona Sans", "Hubot Sans", "Notion Inter"], [], new Map([[k("Söhne"), new Set(["stripe.com"])], ["monasans", new Set(["github.com"])], [k("SF Pro"), new Set(["apple.com"])]])));
    expect(rows.get(k("Söhne"))?.license_hint).toBe("commercial");
    expect(rows.get(k("SF Pro"))?.license_hint).toBe("system");
    expect(rows.get("sanfrancisco")?.license_hint).toBe("system");
    expect(rows.get("monasans")?.license_hint).toBe("free");
    expect(rows.get("hubotsans")?.license_hint).toBe("free");
    expect(rows.get("notioninter")?.license_hint).toBe("free");
  });
  it("marks a non-Google, non-curated family seen on exactly one domain proprietary", () => {
    const rows = byKey(buildFontCatalog(["Zebrafont", "Wavefont", "Lora", "Graphik"], [{ family: "Lora", category: "serif" }], new Map([["zebrafont", new Set(["one.com"])], ["wavefont", new Set(["one.com", "two.com"])], ["lora", new Set(["one.com"])], ["graphik", new Set(["one.com"])]])));
    expect(rows.get("zebrafont")).toMatchObject({ license_hint: "proprietary", license_reason: "single_site" });
    expect(rows.get("wavefont")?.license_hint).toBe("commercial");
    expect(rows.get("lora")?.license_hint).toBe("free");
    expect(rows.get("graphik")?.license_hint).toBe("commercial");
  });
  it("does not treat Google families as proprietary even when named after a using domain", () => {
    expect(classifyLicense("ibmplexsans", { google: true, domains: ["ibm.com"] }).license_hint).toBe("free");
  });
  it("defaults include_proprietary to false", () => {
    expect(typeInput.parse({ role: "headline" }).include_proprietary).toBe(false);
  });
});

describe("minimum-sites threshold", () => {
  const data: Record<string, { key: string; sites: number }[]> = {
    fintech: [{ key: "a", sites: 1 }, { key: "b", sites: 2 }, { key: "c", sites: 1 }],
    "dev-tools": [{ key: "a", sites: 2 }, { key: "b", sites: 4 }, { key: "c", sites: 2 }],
    all: [{ key: "a", sites: 2 }, { key: "b", sites: 3 }, { key: "c", sites: 9 }, { key: "d", sites: 3 }],
  };
  const build = (scope: string) => data[scope] ?? [];
  it("requires 2 sites in a sector and 3 in all", () => { expect(minSites("fintech")).toBe(2); expect(minSites("all")).toBe(3); });
  it("ranks within the sector when it has 3 qualifying candidates", () => {
    const r = chooseScope("dev-tools", build, 6);
    expect(r.scope).toBe("dev-tools"); expect(r.fallback).toBeNull(); expect(r.items.map(i => i.key)).toEqual(["a", "b", "c"]);
  });
  it("falls back to all (≥3 sites) and explains why", () => {
    const r = chooseScope("fintech", build, 6);
    expect(r.scope).toBe("all");
    expect(r.items.map(i => i.key)).toEqual(["b", "c", "d"]);
    expect(r.fallback).toMatchObject({ requested: "fintech", used: "all", qualifying_in_requested: 1, min_sites_used: 3 });
    expect(r.fallback?.note).toBe("fintech has only 1 faces seen on ≥2 sites; ranked across all sectors instead (≥3 sites each)");
  });
  it("drops single-site observations from all without fallback", () => {
    const r = chooseScope("all", build, 6);
    expect(r.fallback).toBeNull(); expect(r.items.every(i => i.sites >= 3)).toBe(true);
  });
});
