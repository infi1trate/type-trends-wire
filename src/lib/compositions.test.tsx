import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { COMPOSITIONS } from "./compositions";
import { DENSITY } from "./ia";
import { CONTAINER_NAMES } from "@/components/brand/Containers";
import { ILLUSTRATION_MAX } from "./illustration";
import { overlay, type StoredStory } from "./stories/edits";
import { storyPage } from "./stories/view";
import { traitModel } from "./digest/trait";
import { traitFixture } from "./digest/__fixtures__/trait";
import { issueModel } from "./digest/issue";
import { fixture } from "./digest/__fixtures__/issue-w46";
import { brandModel } from "./brand-page";
import { auditFixture } from "./agency/test-fixtures";
import { StoryView } from "@/components/read/StoryView";
import { SignalView } from "@/components/read/SignalView";
import { IssueView } from "@/components/digest/IssueView";
import { BrandView } from "@/components/read/BrandView";

async function html(el: () => ReactElement, path = "/") {
  const root = createRootRoute({ component: el });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  const div = document.createElement("div");
  div.innerHTML = renderToString(createElement(RouterProvider, { router } as never));
  return div;
}
const NOW = Date.parse("2026-11-16T12:00:00Z");
const story = (o: Partial<StoredStory> = {}): StoredStory => ({ id: "move:1", type: "move", status: "published", reason: "ran", score: 60, components: { size: { value: 15, why: "x" }, brand: { value: 20, why: "x" }, novelty: { value: 15, why: "x" }, relevance: { value: 10, why: "y" } },
  why_ran: "Score 60.", kicker: "Move · Color · Fintech", headline: "a.com changed its accent", deck: "Blue → Red. Confirmed 12 Nov.", facts: [{ text: "Before: Blue", href: "/brands/a.com", basis: "measured", kind: "before" }, { text: "After: Red", href: "/brands/a.com", basis: "measured", kind: "after" }, { text: "Confirmed on a second capture, 12 Nov", href: "/library/a.com", basis: "measured", kind: "date" }],
  why_line: null, why_model: null, why_at: null, sector: "fintech", signal_keys: [], domains: ["a.com"], evidence: [{ label: "Brand page", href: "/brands/a.com" }], source_ids: ["event:1"], basis: "measured", happened_at: "2026-11-15T10:00:00Z", created_at: "2026-11-15T11:00:00Z", ...o });

/** The composition rules every rendered page type must keep. */
function checkComposition(root: HTMLElement, id: keyof typeof COMPOSITIONS) {
  const c = COMPOSITIONS[id];
  const used = [...new Set([...root.querySelectorAll("[data-container]")].map(e => e.getAttribute("data-container")!))];
  for (const u of used) expect(CONTAINER_NAMES as readonly string[], `${id}: ${u}`).toContain(u);
  expect(root.querySelectorAll('[data-container="plate"]').length, id).toBeLessThanOrEqual(c.plates);
  const ills = [...root.querySelectorAll("[data-illustration]")];
  expect(ills.length, id).toBeLessThanOrEqual(1);
  for (const i of ills) {
    expect(i.closest("li, [data-ledger]"), `${id}: illustration inside a list`).toBeNull();
    if (c.illustration) expect(i.getAttribute("data-illustration")).toBe(c.illustration);
    const box = i.querySelector("svg[viewBox]")?.getAttribute("viewBox")?.split(" ").map(Number);
    if (box) { expect(box[2]!).toBeLessThanOrEqual(ILLUSTRATION_MAX.w); expect(box[3]!).toBeLessThanOrEqual(ILLUSTRATION_MAX.h); }
  }
}

describe("compositions", () => {
  it("each page type's density is the one recorded for its routes in ia.ts", () => {
    for (const [id, c] of Object.entries(COMPOSITIONS)) for (const r of c.routes) expect(DENSITY[r], `${id} ${r}`).toBe(c.density);
    expect(COMPOSITIONS.story.density).toBe("quiet"); expect(COMPOSITIONS.signal.density).toBe("quiet");
    expect(COMPOSITIONS.brand.density).toBe("steady"); expect(COMPOSITIONS.pattern.density).toBe("steady");
    expect(COMPOSITIONS.tools.density).toBe("steady"); expect(COMPOSITIONS["data-story"].density).toBe("quiet");
  });
  it("only the eight containers, and at most the front page's one Plate", () => {
    for (const c of Object.values(COMPOSITIONS)) { for (const n of c.containers) expect(CONTAINER_NAMES as readonly string[]).toContain(n); expect(c.plates).toBeLessThanOrEqual(1); }
    expect(Object.entries(COMPOSITIONS).filter(([, c]) => c.plates === 1).map(([k]) => k)).toEqual(["front"]);
  });
  it("story: an ink cover with one cut-and-paste object, frames before text, no plate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 304 })));
    const [s] = overlay([story()], [], NOW);
    const page = { ...storyPage(s!, { earlier: [], soWhat: "So what.", patterns: [] }), thumb: null, series: null };
    const r = await html(() => createElement(StoryView, { s: page }), "/stories/move%3A1");
    const cover = r.querySelector('[data-cover="story"]')!;
    expect(cover.getAttribute("data-container")).toBe("slab");
    expect(cover.querySelector('[data-illustration="cut"]')).not.toBeNull();
    expect(cover.querySelectorAll("[data-pin]").length).toBe(2);
    expect(cover.querySelector(".cover-deck")).not.toBeNull();
    expect(r.querySelector("[data-composition]")!.getAttribute("data-composition")).toBe("quiet");
    checkComposition(r, "story");
  });
  it("signal: one figure with Momentum and Confidence as facts, the share trail, Ledgers", async () => {
    const page = traitModel(traitFixture())!;
    const r = await html(() => createElement(SignalView, { page, sector: "all" }), "/signals/css%3Asubgrid");
    expect(r.querySelectorAll('[data-cover="signal"] [data-signal-figure] .ed-figure-num').length).toBe(1);
    expect([...r.querySelectorAll('[data-signal-figure] dt')].map(d => d.textContent)).toEqual(expect.arrayContaining(["Momentum", "Confidence"]));
    checkComposition(r, "signal");
  });
  it("digest: a soft-object cover, the contents as a Ledger, the sections in rule boxes", async () => {
    const issue = issueModel(fixture())!;
    const r = await html(() => createElement(IssueView, { issue }));
    expect(r.querySelector('[data-cover="edition"] [data-illustration="soft"]')).not.toBeNull();
    expect(r.querySelector('nav[aria-labelledby="ed-contents"] [data-ledger]')).not.toBeNull();
    expect(r.querySelectorAll('section[id^="ed-"] [data-container="rulebox"]').length).toBeGreaterThan(2);
    checkComposition(r, "digest");
  });
  it("brand: an identity card with the H1, the moves as Ledger rows", async () => {
    const b = brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [["css:has", "headline"]] });
    const r = await html(() => createElement(BrandView, { b }), "/brands/vercel.com");
    expect(r.querySelector("h1")!.className).toContain("ed-h1");
    expect(r.querySelector("[data-identity-card] h1")).not.toBeNull();
    expect(r.querySelector("[data-brand-actions] .c-raised")).not.toBeNull();
    checkComposition(r, "brand");
  });
});
