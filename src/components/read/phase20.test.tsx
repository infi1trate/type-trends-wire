import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { StoryNo } from "@/components/brand/Ledger";
import { ScrollRow } from "./ScrollRow";
import { Wall } from "./Wall";
import { renderGatePage } from "@/lib/gate";
import { imagePolicy } from "@/lib/crops";
import { BOT_NAME, LEGACY_UA_TOKEN } from "@/lib/brand";
import type { GalleryTile } from "@/lib/gallery";

const dom = (el: ReturnType<typeof createElement>) => { const d = document.createElement("div"); d.innerHTML = renderToString(el); return d; };
const tile = (k: number): GalleryTile => ({ id: String(k), snapshot: k, domain: "neon.com", name: "Neon", sector: "dev-tools", at: "2026-11-16T00:00:00Z", day: "16 Nov 2026", quarter: "2026Q4", source: "live", label: "neon.com, first screen, 16 Nov 2026", href: "/brands/neon.com", size: k ? "sm" : "lg", crop: null, note: null,
  frame: { id: String(k), at: "2026-11-16", source: "live", w: 1280, h: 900, bg: null, ink: null, accent: null, tones: [], boxes: [["h", 0, 0, 400, 60]], crop: null, archiveUrl: null } });

describe("phase 20 polish", () => {
  it("a story number never wraps: the figure with No. as a small label", () => {
    const d = dom(createElement(StoryNo, { n: 45 }));
    expect(d.querySelector("[data-story-number]")!.textContent).toBe("No. 45");
    expect(d.querySelector(".ledger-no-label")!.textContent).toBe("No.");
    expect(d.querySelector(".ledger-no-fig")!.textContent).toBe("45");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.ledger-no\s*\{[^}]*white-space:\s*nowrap/);
  });
  it("sub-navigation is one row that scrolls sideways", () => {
    const d = dom(createElement(ScrollRow, { label: "Sections", children: [createElement("a", { key: "a", href: "/a", "aria-current": "page" }, "A"), createElement("a", { key: "b", href: "/b" }, "B")] }));
    expect(d.querySelector(".scroll-row")).not.toBeNull();
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.scroll-row\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(css).toMatch(/overflow-x:\s*auto/);
  });
  it("the gate's password field has one ring at rest and focuses only when asked", () => {
    const html = renderGatePage("/");
    expect(html).not.toMatch(/autofocus/);
    expect(html).toMatch(/input\{[^}]*outline:none/);
    expect(html).toMatch(/:focus-visible/);
  });
  it("what-we-show names both crawler names and honours robots.txt for either", () => {
    const item = imagePolicy().find(x => x.id === "crawler")!;
    expect(item.text).toContain(BOT_NAME);
    expect(item.text).toContain(LEGACY_UA_TOKEN);
    expect(item.text).toContain("robots.txt");
  });
  it("terminal sentences use the text face; cells stay mono", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.t-say\s*\{[^}]*font-family:\s*var\(--sys-font-text\)/);
    for (const f of ["Tour", "Glossary", "primitives"]) expect(readFileSync(`src/components/terminal/${f}.tsx`, "utf8")).toContain("t-say");
  });
});

describe("the wall", () => {
  it("is one list with a name per tile and links to brand pages", () => {
    const d = dom(createElement(Wall, { tiles: [tile(0), tile(1)], label: "Big type" }));
    const ul = d.querySelector("ul.wall")!;
    expect(ul.getAttribute("aria-label")).toBe("Big type");
    const links = [...ul.querySelectorAll("li > a.wall-tile")];
    expect(links.map(a => a.getAttribute("aria-label"))).toEqual(["neon.com, first screen, 16 Nov 2026", "neon.com, first screen, 16 Nov 2026"]);
    expect(links[0]!.getAttribute("href")).toBe("/brands/neon.com");
  });
  it("never carries a filtered illustration", () => {
    const d = dom(createElement(Wall, { tiles: [tile(0), tile(1)], label: "x" }));
    expect(d.querySelectorAll("[data-illustration]").length).toBe(0);
    for (const f of ["Wall", "GalleryView", "CollectionsViews"]) expect(readFileSync(`src/components/read/${f}.tsx`, "utf8")).not.toMatch(/Illustration|data-illustration/);
  });
});
