// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { traitModel } from "./trait";
import { traitFixture } from "./__fixtures__/trait";
import { traitDefinition } from "./copy";
import { explainerUrl, explainerPath } from "../labels";
import { SignalView } from "@/components/read/SignalView";

describe("trait explainer", () => {
  it("known key: name, stage, definition, sectors, receipts, examples, related and terminal deep link", () => {
    const p = traitModel(traitFixture())!;
    expect(p).toMatchObject({ key: "css:subgrid", name: "Subgrid layouts", dimension: "LAYOUT", stage: "Rising", dataThrough: "Q4 2026", terminal: "/terminal?panel=brief&trait=css%3Asubgrid" });
    expect(p.definition).toBe("Subgrid layouts tracks the share of homepages whose stylesheets use subgrid layouts. It is measured directly from each page's code and rendered styles.");
    expect(p.sectors).toEqual([{ sector: "dev-tools", share: 0.567, stage: "Peaking", lead: expect.closeTo(0.307, 3) }]);
    expect(p.receipts.map(r => r.term)).toEqual(["Sample", "Momentum", "Gap", "Curation", "Corroboration", "Discourse", "Next-wave score"]);
    expect(p.receipts.find(r => r.term === "Curation")!.text).toBe("Not measured this run: no curated index in the latest crawl.");
    expect(p.examples.map(e => [e.domain, e.adopted, e.thumb])).toEqual([["vercel.com", "Q1 2025", null]]);
    // Same dimension (LAYOUT) by share: Fluid type and spacing (css:clamp) and Bento grids; Variable fonts is FONT, Minimalism is VIBE.
    expect(p.related.map(r => r.key)).toEqual(["css:clamp", "components:bento_grid"]);
    expect(p.card?.series.length).toBe(3);
  });
  it("unknown key (no forecast rows) → not found", () => {
    expect(traitModel({ ...traitFixture(), rows: [] })).toBeNull();
  });
  it("AI-tagged traits say they are estimates", () => {
    expect(traitDefinition("aesthetic:minimal")).toMatch(/AI tagger.*estimate/);
  });
  it("renders the page with the chart and typographic example card", async () => {
    const page = traitModel(traitFixture())!;
    const root = createRootRoute({ component: () => createElement(SignalView, { page, sector: "all" }) });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/"] }) });
    await router.load();
    const html = renderToString(createElement(RouterProvider, { router } as never));
    expect(html).toContain("Subgrid layouts");
    expect(html).toContain("digest-figure");
    expect(html).toContain('class="ed-typo"');
    expect(html).not.toMatch(/\$[A-Z][A-Z0-9-]+/);
  });
  it("explainer URLs use the stable key on SITE_URL, only for forecast traits", () => {
    expect(explainerPath("css:subgrid:all")).toBe("/signals/css%3Asubgrid");
    expect(explainerUrl("spread:tight_tracking")).toBe("https://type-trends-wire.lovable.app/signals/tracking%3Atight");
    expect(explainerUrl("family:Inter")).toBeNull();
  });
});
