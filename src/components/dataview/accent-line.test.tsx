// W3c Part 3 · the brand line as drawn on the Data view: one line, the title the only link, the full credit on hover and for screen readers.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { AccentLine } from "./Views";
import type { AccentNear } from "@/lib/art/accent";

const a: AccentNear = { accent: "#3D5AFE", family: "blue", workHex: "#3C58F0", share: 0.19, distance: 0.012, title: "The Millinery Shop", artistDate: "Edgar Degas, 1879–86", credit: "Edgar Degas. The Millinery Shop, 1879–86. The Art Institute of Chicago.", museum: "The Art Institute of Chicago", href: "https://www.artic.edu/artworks/14572", thumb: "/crops/art/aic-14572.webp", width: 64, height: 48, work: "aic:14572" };
describe("the accent line", () => {
  it("reads swatch, thumbnail, 'This blue is in' the title, artist and date, and the share", () => {
    const { container } = render(createElement(AccentLine, { a }));
    const p = container.querySelector("[data-accent-art]")!;
    expect(p.textContent).toContain("This blue is in The Millinery Shop");
    expect(p.textContent).toContain("holds 19% of the picture");
    const links = p.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0]!.getAttribute("href")).toBe(a.href);
    expect(links[0]!.getAttribute("title")).toBe(a.credit);
    expect(links[0]!.querySelector(".sr-only")!.textContent).toContain(a.credit);
    const img = p.querySelector("img")!;
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["64", "48"]);
    expect(p.querySelector(".line-clamp-2")).not.toBeNull();
  });
});
