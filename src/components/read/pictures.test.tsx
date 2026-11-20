// I1 · real pictures: BrandMark, the brand page cover, and the wireframe reveal.
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandMark } from "./BrandMark";
import { CoverFigure } from "./Evidence";
import { RevealBox, REVEAL_DELAY_MS } from "./Reveal";
import { CaptureFrame } from "@/components/data/Figures";
import { coverOf, coverBox, heroRevealFor, pictureIndex, iconsFor, reserveIconSpace, revealOf, type BrandPics } from "@/lib/pictures";
import type { Frame } from "@/lib/data-stories/types";
import type { CropRow } from "@/lib/crops";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const pic = (src: string, width = 1200, height = 630, at = "2026-11-20T06:00:00Z") => ({ src, width, height, at });
const reveal = revealOf("gopro.com", pic("/crops/gopro.com/hero/desktop/2026-11-20-aaaaaaaa.webp", 1280, 800))!;
const imgs = (el: HTMLElement) => el.querySelectorAll("img").length;
const setReduced = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

describe("BrandMark", () => {
  it("renders nothing without an icon", () => {
    expect(renderToStaticMarkup(<BrandMark icon={null} />)).toBe("");
  });
  it("has explicit width and height, empty alt and lazy loading with an icon", () => {
    const html = renderToStaticMarkup(<BrandMark icon={pic("/crops/assets/gopro.com/icon/x.webp", 180, 180)} size={32} />);
    expect(html).toContain('width="32"'); expect(html).toContain('height="32"');
    expect(html).toContain('alt=""'); expect(html).toContain('loading="lazy"');
  });
  it("a list reserves the icon's width only when most rows have one", () => {
    expect(reserveIconSpace(26, 50)).toBe(true);
    expect(reserveIconSpace(25, 50)).toBe(false);
    expect(renderToStaticMarkup(<BrandMark icon={null} reserve size={16} />)).toContain("data-brand-mark-space");
  });
  it("iconsFor returns only brands that have an icon", () => {
    const idx = pictureIndex([{ domain: "a.com", kind: "icon", path: "assets/a.com/icon/1.webp", width: 64, height: 64, captured_at: "2026-11-20T00:00:00Z" }]);
    expect(Object.keys(iconsFor(idx, ["a.com", "b.com"]))).toEqual(["a.com"]);
  });
});

describe("brand page cover", () => {
  const pics: BrandPics = { icon: null, card: pic("/crops/assets/gopro.com/card/c.webp"), hero: pic("/crops/gopro.com/hero/desktop/h.webp", 1280, 800) };
  it("the social card wins over the hero crop; the hero crop when there is no card; nothing without either", () => {
    expect(coverOf("gopro.com", pics)?.kind).toBe("card");
    expect(coverOf("gopro.com", { ...pics, card: null })?.kind).toBe("hero");
    expect(coverOf("gopro.com", { icon: null, card: null, hero: null })).toBeNull();
  });
  it("carries the credit line, live-site link and report link", () => {
    const html = renderToStaticMarkup(<CoverFigure c={coverOf("gopro.com", pics)!} />);
    expect(html).toContain("Social card published by gopro.com · captured");
    expect(html).toContain("20 Nov 2026");
    expect(html).toContain("Live site"); expect(html).toContain("Report this image");
    expect(html).toContain('loading="eager"'); expect(html).toMatch(/fetch[pP]riority="high"/);
  });
  it("reserves its box from the stored size and never upscales", () => {
    const b = coverBox(600, 315);
    expect(b.aspectRatio).toBe("600 / 315");
    expect(b.width).toContain("600px");
  });
});

describe("wireframe reveal", () => {
  const drawing = <svg data-testid="drawing" width="100" height="60" />;
  it("requests no image before intent; Enter shows, Escape hides", () => {
    setReduced(false);
    const { container } = render(<RevealBox reveal={reveal} label="gopro.com">{drawing}</RevealBox>);
    const box = container.querySelector("[data-reveal]") as HTMLElement;
    expect(imgs(container)).toBe(0);
    expect(box.getAttribute("aria-label")).toContain("A real capture is available");
    expect(box.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(imgs(container)).toBe(1);
    expect(container.querySelector("[data-reveal-layer]")?.getAttribute("data-reveal-layer")).toBe("shown");
    expect(container.textContent).toContain("gopro.com · captured 20 Nov 2026");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(container.querySelector("[data-reveal-layer]")?.getAttribute("data-reveal-layer")).toBe("hidden");
  });
  it("a pointer shows it only after the short delay", () => {
    setReduced(false); vi.useFakeTimers();
    const { container } = render(<RevealBox reveal={reveal} label="gopro.com">{drawing}</RevealBox>);
    const box = container.querySelector("[data-reveal]") as HTMLElement;
    fireEvent.pointerEnter(box, { pointerType: "mouse" });
    expect(imgs(container)).toBe(0);
    act(() => { vi.advanceTimersByTime(REVEAL_DELAY_MS + 1); });
    expect(imgs(container)).toBe(1);
    fireEvent.pointerLeave(box, { pointerType: "mouse" });
    expect(container.querySelector("[data-reveal-layer]")?.getAttribute("data-reveal-layer")).toBe("hidden");
  });
  it("reduced motion swaps with no transition", () => {
    setReduced(true);
    const { container } = render(<RevealBox reveal={reveal} label="gopro.com">{drawing}</RevealBox>);
    fireEvent.keyDown(container.querySelector("[data-reveal]") as HTMLElement, { key: " " });
    const layer = container.querySelector("[data-reveal-layer]") as HTMLElement;
    expect(layer.style.transition).toBe("none");
    setReduced(false);
  });
  it("without a crop nothing changes and nothing hints at a picture", () => {
    const fr: Frame = { id: "x", at: "2026-11-01T00:00:00Z", source: "live", w: 1440, h: 900, bg: "#fff", ink: "#000", accent: null, tones: [], boxes: [], crop: null, archiveUrl: null };
    const plain = renderToStaticMarkup(<CaptureFrame fr={fr} label="gopro.com" />);
    expect(plain).not.toContain("data-reveal"); expect(plain).not.toContain("real capture");
    const withCrop = renderToStaticMarkup(<CaptureFrame fr={{ ...fr, reveal }} label="gopro.com" />);
    expect(withCrop).toContain("data-reveal"); expect(withCrop).not.toContain("<img");
  });
  it("picks the hero crop current at the drawing's capture, else the oldest", () => {
    const c = (at: string, h: string): CropRow => ({ id: 1, domain: "gopro.com", section: "hero", viewport: "desktop", captured_at: at, first_seen_at: at, last_seen_at: at, path: `gopro.com/hero/desktop/${h}.webp`, width: 1280, height: 800, bytes: 1, hash: h } as CropRow);
    const crops = [c("2026-11-10T00:00:00Z", "old"), c("2026-11-20T00:00:00Z", "new")];
    expect(heroRevealFor(crops, "gopro.com", "2026-11-12T00:00:00Z")?.src).toContain("old");
    expect(heroRevealFor(crops, "gopro.com", "2026-11-21T00:00:00Z")?.src).toContain("new");
    expect(heroRevealFor(crops, "gopro.com", "2026-10-01T00:00:00Z")?.src).toContain("old");
    expect(heroRevealFor(crops, "other.com", "2026-11-12T00:00:00Z")).toBeNull();
  });
});
