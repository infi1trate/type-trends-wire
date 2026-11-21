// P1 · shell first: deferred slots hold same-size, aria-hidden placeholders (aria-busy on the slot) until their data is in; the
// brand page's first render carries the identity card and placeholders, never the moves.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { render } from "@testing-library/react";

const never = () => new Promise<never>(() => {});
vi.mock("@/lib/read.functions", async orig => { const w = () => new Promise<never>(() => {}); return { ...(await orig<object>()), getBrandMoves: w, getBrandSections: w, getBrandSector: w, getBrandSimilar: w, getBrandStories: w, getBrandSurfaces: w }; });

import { Later, Placeholder, ROW } from "./Later";
import { BrandPageView } from "./BrandView";
import { renderInRouter } from "@/test/router-harness";
import { brandModel, cardOf } from "@/lib/brand-page";
import { auditFixture } from "@/lib/agency/test-fixtures";
import { GLISTEN_MS } from "@/lib/motion";

describe("placeholders", () => {
  it("draw rows at the list's row height, pictures at their ratio, hidden from assistive tech", () => {
    const { container } = render(createElement(Placeholder, { shapes: [{ kind: "rows", n: 3, height: ROW.ledger }, { kind: "picture", ratio: 1280 / 800 }, { kind: "text", lines: 2 }] }));
    const ph = container.querySelector("[data-placeholder]")!;
    expect(ph.getAttribute("aria-hidden")).toBe("true");
    const rows = [...ph.querySelectorAll<HTMLElement>(".ph-row")];
    expect(rows.length).toBe(3);
    for (const r of rows) expect(r.style.height).toBe(`${ROW.ledger}px`);
    expect(ph.querySelectorAll(".ph-b").length).toBe(3 + 1 + 2); // the picture block's ratio is an inline aspect-ratio (jsdom drops it)
    expect(ph.querySelectorAll(".ph-line").length).toBe(2);
    expect(ph.textContent).toBe("");
  });
  it("mark the slot busy while it waits", () => {
    const Wait = () => { throw never(); };
    const { container } = render(createElement(Later, { shapes: [{ kind: "block", height: 120 }], children: createElement(Wait) }));
    expect(container.querySelector("[data-later]")!.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("[data-placeholder]")).not.toBeNull();
  });
  it("glisten every 1.6 s and stand still with reduced motion", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(GLISTEN_MS).toBe(1600);
    expect(css).toMatch(/\.ph-b::after\s*\{[^}]*animation:\s*glisten 1\.6s/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.ph-b::after\s*\{\s*animation:\s*none/);
  });
});

describe("brand page, first render", () => {
  it("has the identity card and placeholders but no moves", async () => {
    const b = brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [], captures: [] });
    expect(b.timeline.length).toBeGreaterThan(0);
    const { container } = await renderInRouter(() => createElement(BrandPageView, { card: cardOf(b) }), "/brands/vercel.com");
    expect(container.querySelector("h1")?.textContent).toContain(b.name);
    expect(container.querySelectorAll("[data-later][aria-busy='true']").length).toBe(6);
    expect(container.querySelector("[data-pair-open]")).toBeNull();
    const moves = container.querySelector("#ed-moves")!;
    expect(moves.getAttribute("aria-busy")).toBe("true");
    expect(moves.querySelector("li, [data-later-ready]")).toBeNull();
  });
});
