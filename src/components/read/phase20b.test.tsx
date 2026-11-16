import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { screen } from "@testing-library/react";
import { renderInRouter } from "@/test/router-harness";
import { Route as PatternsRoute } from "@/routes/patterns.index";
import { Route as CollectionRoute } from "@/routes/collections.$slug";
import { Route as CollectionsRoute } from "@/routes/collections.index";
import { BrandView } from "./BrandView";
import { brandModel, faceLine, openPairId } from "@/lib/brand-page";
import { auditFixture } from "@/lib/agency/test-fixtures";
import { TILE_FOLD } from "@/lib/gallery";
import type { CaptureRaw } from "@/lib/data-stories/templates/frames";

const errorProps = { error: new Error("canceling statement due to statement timeout"), reset: () => undefined, info: { componentStack: "" } };
describe("the gallery's error page", () => {
  for (const [name, route] of [["/patterns", PatternsRoute], ["/collections/$slug", CollectionRoute], ["/collections", CollectionsRoute]] as const) {
    it(`${name} keeps the Patterns shell and offers a Raised "Try again"`, async () => {
      const { container } = await renderInRouter(() => createElement(route.options.errorComponent as never, errorProps as never), "/patterns");
      expect(container.querySelector("[data-unavailable]")).not.toBeNull();
      expect(container.querySelector('nav[aria-label="Editions"]')).toBeNull(); // not the Digest's sub-navigation
      const retry = screen.getByText("Try again");
      expect([retry.tagName, retry.getAttribute("data-container"), retry.getAttribute("href")]).toEqual(["A", "raised", "/patterns"]);
      expect(container.textContent).toContain("Patterns");
      expect(container.textContent).not.toMatch(/Read the latest issue/);
    });
  }
});

const cap = (id: number, at: string): CaptureRaw => ({ id, captured_at: `${at}T00:00:00Z`, source: "live", page: { w: 1280, h: 3200 }, color: null,
  skeleton: [{ kind: "heading", x: 0, y: 40, w: 600, h: 80 }, { kind: "text", x: 0, y: 1400, w: 600, h: 200 }], h1: null, body: null, h1_size: null, whitespace: null, hero: null, radius: null, archive_url: null });
const model = () => brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [],
  captures: [cap(1, "2025-12-01"), cap(2, "2026-02-01"), cap(3, "2026-09-01"), cap(4, "2026-10-05")] });

describe("brand page moves", () => {
  it("each pair is cut to the first screen", () => {
    const b = model(), pairs = b.timeline.flatMap(m => (m.pair ? [m.pair] : []));
    expect(pairs.length).toBe(2);
    for (const p of pairs) for (const fr of [p.before, p.after]) { expect(fr.h).toBeLessThanOrEqual(TILE_FOLD); expect(fr.boxes.every(x => x[2] + x[4] <= fr.h)).toBe(true); }
  });
  it("only the newest move's pair is open; the rest sit behind the row's disclosure", async () => {
    const b = model();
    expect(openPairId(b.timeline)).toBe(b.timeline[0]!.id);
    const { container } = await renderInRouter(() => createElement(BrandView, { b }), "/brands/vercel.com");
    expect(container.querySelectorAll("[data-pair-open]").length).toBe(1);
    const closed = [...container.querySelectorAll("details[data-pair-closed]")];
    expect(closed.length).toBe(1);
    expect(closed[0]!.querySelector("summary")!.textContent).toBe("Show the two captures");
    const open = container.querySelector("[data-pair-open] [data-figure=before-after]")!;
    expect(open.getAttribute("data-layout")).toBe("pair");
    expect(open.querySelectorAll("figure.max-w-\\[520px\\]").length).toBe(2); // side by side, each at most 520 px
    expect(open.querySelector('input[type="range"]')).not.toBeNull(); // the slider
    expect([...open.querySelectorAll("button")].map(x => x.textContent?.split(" · ")[0])).toEqual(["Before", "After"]); // its keyboard alternative
  });
  it("type lines say the face, its size and where it comes from, nothing more", async () => {
    expect(faceLine({ family: "Inter", size: 56, google: true, css: null })).toBe("Inter · 56px · Google Fonts");
    expect(faceLine({ family: "Söhne", size: null, google: false, css: null })).toBe("Söhne");
    expect(faceLine({ family: "Arial", size: 16.4, google: false, css: "Arial, sans-serif" })).toBe("Arial · 16px · System font");
    const { container } = await renderInRouter(() => createElement(BrandView, { b: model() }), "/brands/vercel.com");
    const card = container.querySelector("[data-identity-card]")!.textContent!;
    expect(card).not.toMatch(/name only|fetching the font|set in the face/);
    expect(card).toContain("Geist · 64px");
  });
});
