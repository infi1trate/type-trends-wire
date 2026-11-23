import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FRONT_PICTURE_MEDIA, firstOf, frontPicture, linkHeader, planPicture, LEAD_SIZES } from "./first-paint";
import { LeadPicture } from "@/components/read/LeadPicture";
import type { LeadItem, LeadPlan } from "./lead-picture";

const item = (d: string, srcSet: string | null = `/thumbs/${d}/2026-11-22-desktop-320w.webp 320w, /thumbs/${d}/2026-11-22-desktop-640w.webp 640w, /thumbs/${d}/2026-11-22-desktop.webp 1280w`): LeadItem => ({
  domain: d, section: "First screen", date: "2026-11-22", src: `/thumbs/${d}/2026-11-22-desktop.webp`, srcSet, width: 1280, height: 800, asset: `thumb:${d}/2026-11-22-desktop.webp`,
  credit: "c", alt: "a", live: `https://${d}`, report: "/what-we-show", role: null });
const plan = (kind: LeadPlan["kind"], items: LeadItem[]): LeadPlan => ({ kind, items, rule: "single" as LeadPlan["rule"], caption: null });
/** The first <img> the component draws, as the browser would choose its file: src, srcset and sizes. */
const firstImg = (html: string) => {
  const tag = /<img [^>]*>/.exec(html)?.[0] ?? "";
  const attr = (n: string) => new RegExp(`${n}="([^"]*)"`).exec(tag)?.[1]?.replace(/&amp;/g, "&") ?? null;
  return { href: attr("src"), srcSet: attr("srcSet"), sizes: attr("sizes"), priority: attr("fetchPriority") };
};

describe("C1b · the announced picture is the one the lead slot draws first", () => {
  it("Today's two-picture stack: the first picture with the stack's sizes, from 1024 px only; the second does not ask for high priority", () => {
    const p = plan("mosaic", [item("vercel.com"), item("netlify.com")]);
    const html = renderToStaticMarkup(<LeadPicture plan={p} compact stack tileSizes={LEAD_SIZES.frontMosaic} />);
    const img = firstImg(html), hint = planPicture(p, "front")!;
    expect({ href: hint.href, srcSet: hint.srcSet, sizes: hint.sizes }).toEqual({ href: img.href, srcSet: img.srcSet, sizes: img.sizes });
    expect(hint.media).toBe(FRONT_PICTURE_MEDIA);
    expect((html.match(/<img [^>]*>/g) ?? []).map(t => /fetchPriority="high"/.test(t))).toEqual([true, false]);
  });
  it.each([["pair", 2], ["single", 1], ["mosaic", 4]] as const)("a story's %s plan: the first picture with the sizes LeadPicture gives it, at every width", (kind, n) => {
    const p = plan(kind, ["a.com", "b.com", "c.com", "d.com"].slice(0, n).map(d => item(d)));
    const img = firstImg(renderToStaticMarkup(<LeadPicture plan={p} />)), hint = planPicture(p, "story")!;
    expect({ href: hint.href, srcSet: hint.srcSet, sizes: hint.sizes, media: hint.media }).toEqual({ href: img.href, srcSet: img.srcSet, sizes: img.sizes, media: null });
  });
  it("a crop without renditions is announced by its address alone", () => {
    const p = plan("single", [item("netlify.com", null)]);
    expect(planPicture(p, "story")).toEqual({ href: "/thumbs/netlify.com/2026-11-22-desktop.webp", srcSet: null, sizes: null, media: null });
  });
  it("type, swatches, marks, a chart or nothing announce no picture", () => {
    for (const k of ["words", "swatches", "marks", "chart", "none"] as const) expect(planPicture(plan(k, []), "story")).toBeNull();
    expect(planPicture(null, "front")).toBeNull();
  });
  it("Today's other slots: one crop or the brand's card by address from 1024 px; before/after crops (lazy) and the sparkline nothing", () => {
    expect(frontPicture({ kind: "crop", crop: { src: "/crops/a.com/hero/2026-11-20-ffffffff.webp" } })).toEqual({ href: "/crops/a.com/hero/2026-11-20-ffffffff.webp", srcSet: null, sizes: null, media: FRONT_PICTURE_MEDIA });
    expect(frontPicture({ kind: "card", cover: { src: "/crops/assets/a.com/card/2026-11-20-ffc0ff80.webp" } })?.href).toBe("/crops/assets/a.com/card/2026-11-20-ffc0ff80.webp");
    expect(frontPicture({ kind: "crops" })).toBeNull();
    expect(frontPicture({ kind: "spark" })).toBeNull();
    expect(frontPicture(null)).toBeNull();
  });
});

describe("C1b · the Link header and which requests announce", () => {
  it("writes one preload with renditions, sizes, media and high priority", () => {
    expect(linkHeader({ href: "/thumbs/v.com/x.webp", srcSet: "/a 320w, /b 640w", sizes: "(min-width: 1024px) 34vw, 50vw", media: "(min-width: 1024px)" }))
      .toBe('</thumbs/v.com/x.webp>; rel=preload; as=image; fetchpriority=high; imagesrcset="/a 320w, /b 640w"; imagesizes="(min-width: 1024px) 34vw, 50vw"; media="(min-width: 1024px)"');
    expect(linkHeader({ href: "/crops/c.webp", srcSet: null, sizes: null, media: null })).toBe("</crops/c.webp>; rel=preload; as=image; fetchpriority=high");
    expect(linkHeader(null)).toBeNull();
  });
  it("Today without a lens, a brand and a story Read view announce; a lens, a Data view or any other page does not", () => {
    const q = (s = "") => new URLSearchParams(s);
    expect(firstOf("/", q())).toEqual({ kind: "front", id: "today" });
    expect(firstOf("/", q("sector=fintech"))).toBeNull();
    expect(firstOf("/", q("format=video"))).toBeNull();
    expect(firstOf("/brands/netlify.com", q())).toEqual({ kind: "brand", id: "netlify.com" });
    expect(firstOf("/brands/netlify.com", q("view=data"))).toEqual({ kind: "brand-data", id: "netlify.com" });
    expect(firstOf("/brands/netlify.com", q("view=read"))).toBeNull();
    expect(firstOf("/brands/netlify.com", q("view=data&sector=fintech"))).toBeNull();
    expect(firstOf("/patterns/combo%3Aai_forward", q())).toEqual({ kind: "pattern", id: "combo:ai_forward" });
    expect(firstOf("/patterns/combo%3Aai_forward", q("sector=fintech"))).toBeNull();
    expect(firstOf("/patterns/combo%3Aai_forward", q("view=data"))).toBeNull();
    expect(firstOf("/stories/brand%3Anetlify.com%3A2026-11-20", q())).toEqual({ kind: "story", id: "brand:netlify.com:2026-11-20" });
    expect(firstOf("/stories/%E0%A4%A", q())).toBeNull();
    expect(firstOf("/signals", q())).toBeNull();
    expect(firstOf("/data/who-went-big-first", q())).toBeNull();
  });
});

describe("C1b · how long the first flush waits for its picture address", () => {
  it("counts from the request's arrival, up to the deadline", async () => {
    const { firstWaitMs, FIRST_PAINT_DEADLINE_MS, FIRST_PAINT_FLOOR_MS, FIRST_PAINT_WAIT_MS } = await import("./first-paint");
    expect(FIRST_PAINT_DEADLINE_MS).toBe(650);
    expect(firstWaitMs(0)).toBe(650);
    expect(firstWaitMs(150)).toBe(500);
    expect(firstWaitMs(600)).toBe(FIRST_PAINT_FLOOR_MS);
    expect(firstWaitMs(5_000)).toBe(50);
    expect(firstWaitMs(-20)).toBe(650);
    expect(firstWaitMs(null)).toBe(FIRST_PAINT_WAIT_MS);
  });
});

describe("W3d Part 5 · the brand Data view, a pattern, a collection and the directory", () => {
  it("each announces the picture it paints largest, at the widths where it is largest", async () => {
    const { thumbPicture, patternPicture, patternFirstIndex, wallPicture, brandsPicture, NARROW_PICTURE_MEDIA } = await import("./first-paint");
    expect(NARROW_PICTURE_MEDIA).toBe("(max-width: 767px)");
    const t = { src: "/thumbs/vercel.com/2026-11-23-desktop-320w.webp", srcSet: "/thumbs/vercel.com/2026-11-23-desktop-320w.webp 320w, /thumbs/vercel.com/2026-11-23-desktop-640w.webp 640w" };
    expect(thumbPicture(t)).toEqual({ href: t.src, srcSet: t.srcSet, sizes: "320px", media: null });
    expect(thumbPicture(null)).toBeNull();
    const ex = [{ crop: null }, { crop: { src: "/crops/slack.com/hero/a.webp" } }, { crop: { src: "/crops/b.com/hero/b.webp" } }];
    expect(patternPicture({ examples: ex })).toEqual({ href: "/crops/slack.com/hero/a.webp", srcSet: null, sizes: null, media: null });
    expect(patternFirstIndex(ex)).toBe(1);
    expect(patternPicture({ examples: [{ crop: null }] })).toBeNull();
    expect(wallPicture([{ crop: null }, { crop: { src: "/crops/wise.com/hero/w.webp" } }])).toEqual({ href: "/crops/wise.com/hero/w.webp", srcSet: null, sizes: null, media: "(max-width: 767px)" });
    const moved = ["a.com", "b.com", "c.com"].map(d => ({ domain: d, hero: { src: `/crops/${d}/hero/x.webp` } }));
    const sites = [{ domain: "a.com", sector: "fintech" }, { domain: "b.com", sector: "ai" }, { domain: "c.com", sector: "ai" }];
    expect(brandsPicture({ moved, sites }, { tab: "directory", sector: "all" })?.href).toBe("/crops/a.com/hero/x.webp");
    expect(brandsPicture({ moved, sites }, { tab: "moves", sector: "all" })).toBeNull();
    // The band shows only with three cards in the lens; two in "ai" draws no band, so nothing is announced.
    expect(brandsPicture({ moved, sites }, { tab: "directory", sector: "ai" })).toBeNull();
    expect(linkHeader(wallPicture([{ crop: { src: "/crops/w.webp" } }]))).toBe('</crops/w.webp>; rel=preload; as=image; fetchpriority=high; media="(max-width: 767px)"');
  });
});
