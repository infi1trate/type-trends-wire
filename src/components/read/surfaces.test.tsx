// W1c · the brand page's Surfaces list: compact rows with no pictures until the crawler sends first screens of the other pages, then a
// small lazy thumbnail in a fixed box on that page's row only (built from fixtures; nothing changes on the live page until then).
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { SurfacesBlock } from "./Surfaces";
import { latestSurfaces, matchLine, surfaceList, type BrandSurfaces, type SurfaceCapture, type SurfaceCrop } from "@/lib/surfaces";
import { longDay } from "@/lib/pictures";

const cap = (page_type: string, o: Partial<SurfaceCapture> = {}): SurfaceCapture => ({ id: page_type.length, domain: "acme.com", page_type, captured_at: "2026-11-21T06:00:00Z", run_id: "r1", url: `https://acme.com/${page_type === "home" ? "" : page_type}`, h1: { family: "Systemia" }, body: { family: "Systemia" }, theme: "light", accent: "#130281", ...o });
const all = [cap("home"), cap("product"), cap("about", { h1: { family: "Inter" } }), cap("pricing", { h1: null, body: null, theme: null, accent: null }), cap("changelog")];
const block = (crops: SurfaceCrop[] = []): BrandSurfaces => {
  const list = surfaceList(latestSurfaces(all), { domain: "acme.com", crops, report: "/what-we-show#ed-w-images", day: longDay });
  return { domain: "acme.com", show: true, list, matchLine: matchLine(list), productLine: null, rows: [], fieldNames: [], history: [] };
};
const crop = (section: string, o: Partial<SurfaceCrop> = {}): SurfaceCrop => ({ section, path: `acme.com/${section}/2026-11-21-abcdef01.webp`, src: `/crops/acme.com/${section}/2026-11-21-abcdef01.webp`, width: 1280, height: 800, captured_at: "2026-11-21T06:00:00Z", ...o });

describe("W1c · Surfaces list", () => {
  it("one row per surface, homepage first, with typeface, accent swatch and name, match, date and live link; no pictures", () => {
    const { container } = render(createElement(SurfacesBlock, { s: block() }));
    const rows = [...container.querySelectorAll("[data-surface]")];
    expect(rows.map(r => r.getAttribute("data-surface"))).toEqual(["home", "product", "about", "pricing", "changelog"]);
    expect(container.querySelector("[data-match-line]")!.textContent).toBe("2 of the 4 other pages we read match the homepage; 1 could not be compared.");
    expect(rows[2]!.textContent).toContain("Matches home: no");
    expect(rows[3]!.textContent).toContain("Matches home: not comparable");
    expect(rows[1]!.querySelector(".surface-swatch")).not.toBeNull();
    expect(rows[1]!.querySelector<HTMLAnchorElement>("a")!.getAttribute("href")).toBe("https://acme.com/product");
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector("[data-pics]")).toBeNull();
  });
  it("a stored first screen shows on its own row as a lazy thumbnail with explicit size, live link and Report this image", () => {
    const { container } = render(createElement(SurfacesBlock, { s: block([crop("page-product"), crop("page-pricing", { blank: true })]) }));
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs).toHaveLength(1);
    expect([imgs[0]!.getAttribute("width"), imgs[0]!.getAttribute("height"), imgs[0]!.getAttribute("loading"), imgs[0]!.closest("[data-surface]")!.getAttribute("data-surface")]).toEqual(["1280", "800", "lazy", "product"]);
    expect(imgs[0]!.getAttribute("alt")).toBe("acme.com product page, first screen, captured 21 Nov 2026");
    const row = imgs[0]!.closest("[data-surface]")!;
    expect([...row.querySelectorAll("a")].map(a => a.textContent)).toContain("Report this image");
    expect(container.querySelector("[data-surface='pricing'] img")).toBeNull(); // near-blank crops are not shown
  });
  it("a homepage section crop named pricing is never shown as the pricing page's first screen", () => {
    const { container } = render(createElement(SurfacesBlock, { s: block([crop("pricing"), crop("product"), crop("pricing_page")]) }));
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
  it("no block when the brand has only a homepage", () => {
    const list = surfaceList(latestSurfaces([cap("home")]), { domain: "acme.com", report: "", day: longDay });
    expect(matchLine(list)).toBeNull();
    const { container } = render(createElement(SurfacesBlock, { s: { ...block(), show: false, list } }));
    expect(container.innerHTML).toBe("");
  });
});
