import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Treated, TREATMENTS } from "./Treated";
import type { Crop } from "@/lib/crops";

const crop: Crop = { domain: "vercel.com", section: "hero", sectionName: "Hero", captured_at: "2026-11-15T10:00:00Z", last_seen_at: "2026-11-15T10:00:00Z", hash: "h", src: "/crops/vercel.com/hero.webp", width: 1280, height: 800,
  alt: "vercel.com hero, captured 2026-11-15", caption: "Hero · vercel.com · captured 2026-11-15", live: "https://vercel.com", report: "/what-we-show#ed-w-images" };

describe("<Treated>", () => {
  for (const t of TREATMENTS) it(`${t}: renders the crop with its credit, live link and report link unchanged`, () => {
    const { container, unmount } = render(<Treated crop={crop} treatment={t} />);
    expect(container.querySelector(".tk-treated")).toHaveAttribute("data-treatment", t);
    const img = screen.getByRole("img", { name: crop.alt });
    expect(img).toHaveAttribute("src", crop.src);
    expect(img.closest("a")).toHaveAttribute("href", "https://vercel.com");
    expect(screen.getByText(/Hero · vercel\.com · captured/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live site ↗" })).toHaveAttribute("href", "https://vercel.com");
    expect(screen.getByRole("link", { name: "Report this image" })).toHaveAttribute("href", crop.report);
    // filters are inline SVG only for real treatments; nothing is drawn on a canvas
    expect(container.querySelectorAll("filter").length).toBe(t === "none" ? 0 : t.startsWith("print-") ? 10 : 4);
    expect(container.querySelector("canvas")).toBeNull();
    unmount();
  });
  it("defaults to none", () => {
    const { container } = render(<Treated crop={crop} />);
    expect(container.querySelector(".tk-treated")).toHaveAttribute("data-treatment", "none");
  });
  it("with no crop, shows the placeholder state and never claims a capture", () => {
    render(<Treated crop={null} treatment="duotone" />);
    expect(screen.getByText(/No section crops captured yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Report this image" })).toBeNull();
  });
});
