import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { OBJECT_BLOCKS } from "./ia";
import { brandModel, brandSoWhat } from "./brand";
import { PATTERN_NOTE, patternIndex, patternModel, type PatternSite } from "./patterns";
import { traitModel } from "./digest/trait";
import { traitFixture } from "./digest/__fixtures__/trait";
import { auditFixture } from "./agency/test-fixtures";
import { ObjectPage } from "@/components/read/ObjectPage";
import { SignalView } from "@/components/read/SignalView";
import type { Signal } from "./signals";

const order = (html: string) => [...html.matchAll(/data-block="([a-z-]+)"/g)].map(m => m[1]);
const brand = () => brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [{ domain: "linear.app", name: "Linear", sector: "dev-tools", traits: ["css:has"] }], tiers: [["css:has", "headline"], ["theme:dark", "headline"], ["css:container-queries", "supporting"]] });
const sig = (key: string, dimension: Signal["dimension"], o: Partial<Signal> = {}): Signal => ({ key, name: key, dimension, basis: "measured", tier: "headline", reasons: [], scope: "all", stage: "Rising", share: 0.2, momentum: 1, direction: "rising", next_wave_score: 0.5, momentum_index: 50, confidence: "Medium", confidence_reason: "", so_what: "So what.", sites: 100, quarters: 5, components: 7, ...o } as Signal);
const site = (domain: string, sector: string, traits: string[], captured = "2026-11-14T00:00:00Z"): PatternSite => ({ domain, name: null, sector, captured, traits });

describe("object pages share one anatomy", () => {
  it("ObjectPage renders headline → evidence → so what → related, whatever order blocks are given in", () => {
    const html = renderToString(createElement(ObjectPage, { kind: "brand", id: "x", blocks: { related: "R", "so-what": "S", evidence: "E", headline: "H" } }));
    expect(order(html)).toEqual(["headline", "evidence", "so-what", "related"]);
  });
  it("signal page renders the four blocks in order", async () => {
    const page = traitModel(traitFixture())!;
    expect(page.blocks).toEqual(OBJECT_BLOCKS);
    const root = createRootRoute({ component: () => createElement(SignalView, { page, sector: "all" }) });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/signals/css%3Asubgrid"] }) });
    await router.load();
    expect(order(renderToString(createElement(RouterProvider, { router } as never)))).toEqual(["headline", "evidence", "so-what", "related"]);
  });
  it("brand model: four blocks, deterministic so-what, newest move first, terminal record link", () => {
    const b = brand();
    expect(b.blocks).toEqual(OBJECT_BLOCKS);
    expect(b.soWhat).toBe(brandSoWhat(b.versus?.ahead.length ?? 0, b.versus?.behind.length ?? 0));
    expect(b.timeline.map(t => t.at)).toEqual([...b.timeline.map(t => t.at)].sort().reverse());
    expect(b.actions.terminal).toBe("/library/vercel.com");
    expect(b.actions.differentiate).toContain("diff");
  });
  it("brand so-what reads in plain words", () => {
    expect(brandSoWhat(3, 1)).toBe("Ahead of its sector on 3 rising signals; still using 1 fading one.");
    expect(brandSoWhat(1, 0)).toBe("Ahead of its sector on 1 rising signal; using no fading ones.");
    expect(brandSoWhat(0, 0)).toBe("Neither ahead of nor behind its sector on any signal we stage right now.");
  });
  it("patterns: headline layout and composite signals with at least three examples, filtered by sector", () => {
    const signals = [sig("css:subgrid", "LAYOUT"), sig("combo:big_type", "FONT"), sig("theme:dark", "COLOR"), sig("css:clamp", "LAYOUT", { tier: "supporting" })];
    const sites = [site("a.com", "fintech", ["css:subgrid", "theme:dark", "css:clamp", "combo:big_type"]), site("b.com", "fintech", ["css:subgrid", "theme:dark", "css:clamp", "combo:big_type"]), site("c.com", "media", ["css:subgrid", "theme:dark", "css:clamp"], "2026-11-15T00:00:00Z"), site("d.com", "media", ["combo:big_type"])];
    expect(patternIndex(sites, signals).map(p => p.key).sort()).toEqual(["combo:big_type", "css:subgrid"]);
    expect(patternIndex(sites, signals, "fintech")).toEqual([]);
    const p = patternModel("css:subgrid", sites, signals, [], "all")!;
    expect(p.blocks).toEqual(OBJECT_BLOCKS);
    expect(p.examples.map(e => e.domain)).toEqual(["c.com", "a.com", "b.com"]);
    expect(p.note).toBe(PATTERN_NOTE);
    expect(patternModel("css:subgrid", sites, signals, [], "fintech")!.examples.map(e => e.domain)).toEqual(["a.com", "b.com"]);
    expect(patternModel("theme:dark", sites, signals, [])).toBeNull();
  });
});
