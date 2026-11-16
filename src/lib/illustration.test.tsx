import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ANIMATABLE, ILLUSTRATION_MAX, STYLE_FILTERS, TILT, clampSize, flatMode, seedOf, stripsOf, stripShifts, tapeCorners, tapeOf, tiltOf, trailGeom } from "./illustration";
import { FILTER_FILE, parseFilterSvg } from "@/components/brand/filter-file";
import { FILTER_DEFS, FILTER_IDS } from "@/components/brand/filters.gen";
import { CutAndPaste, SoftObject, Trail } from "@/components/brand/Illustration";

const dom = (html: string) => { const d = document.createElement("div"); d.innerHTML = html; return d; };
const CSS = readFileSync("src/styles.css", "utf8");

describe("illustration: determinism", () => {
  it("the same seed always draws the same tilt, tape and strips; different seeds differ", () => {
    for (const s of [1, 48, 2026, seedOf("2026-W46")]) {
      expect(tiltOf(s)).toBe(tiltOf(s)); expect(tapeOf(s)).toEqual(tapeOf(s)); expect(stripShifts(s, 3)).toEqual(stripShifts(s, 3));
      const t = Math.abs(tiltOf(s)); expect(t).toBeGreaterThanOrEqual(TILT.min); expect(t).toBeLessThanOrEqual(TILT.max);
      const [a, b] = tapeCorners(s); expect(a).not.toBe(b);
    }
    expect(seedOf("No. 48")).toBe(seedOf("No. 48"));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(tiltOf)).size).toBeGreaterThan(1);
  });
  it("strips cut at word boundaries, two or three of them, and rejoin to the headline", () => {
    const h = "neon.com moved its accent from blue to green on the home page";
    const s = stripsOf(h, 48);
    expect(s.join(" ")).toBe(h); expect(s.length).toBe(3); expect(stripsOf(h, 48)).toEqual(s);
    expect(stripsOf("Short headline here", 1)).toHaveLength(2);
    expect(stripsOf("One", 1)).toEqual(["One"]);
  });
  it("server and browser render the same markup for the same seed", () => {
    const a = renderToString(createElement(SoftObject, { text: "47", seed: 1, label: "Issue 1" }));
    expect(renderToString(createElement(SoftObject, { text: "47", seed: 1, label: "Issue 1" }))).toBe(a);
    const pts = [{ x: "Q1", y: 0.2 }, { x: "Q2", y: 0.31 }, { x: "Q3", y: 0.47 }];
    expect(trailGeom(pts, 640, 360)).toEqual(trailGeom(pts, 640, 360));
    expect(trailGeom(pts, 640, 360).at).toEqual([0, expect.any(Number), 1]);
  });
});

describe("illustration: limits", () => {
  it("the filtered area is at most 900 × 600 CSS pixels", () => {
    expect(ILLUSTRATION_MAX).toEqual({ w: 900, h: 600 });
    expect(clampSize(1800, 600)).toEqual({ w: 900, h: 300 }); expect(clampSize(400, 300)).toEqual({ w: 400, h: 300 });
    const t = dom(renderToString(createElement(Trail, { points: [{ x: "a", y: 1 }, { x: "b", y: 2 }], label: "x", format: String, w: 1600, h: 1200 })));
    const vb = t.querySelector("svg[role=img]")!.getAttribute("viewBox")!.split(" ").map(Number);
    expect(vb[2]).toBeLessThanOrEqual(900); expect(vb[3]).toBeLessThanOrEqual(600);
  });
  it("filters come only from the kit, through CSS (so flat mode can drop them), never as attributes", () => {
    const html = renderToString(createElement("div", null,
      createElement(Trail, { points: [{ x: "a", y: 1 }, { x: "b", y: 2 }], label: "x", format: String }),
      createElement(SoftObject, { text: "47", seed: 1, label: "x" }),
      createElement(CutAndPaste, { seed: 48, picture: createElement("div", null, "pic"), note: "15 Nov" })));
    expect(html).not.toMatch(/\sfilter="/);
    const used = [...html.matchAll(/data-filter="([^"]+)"/g)].map(m => m[1]!);
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(FILTER_IDS as readonly string[]).toContain(id);
    for (const ids of Object.values(STYLE_FILTERS)) for (const id of ids) expect(FILTER_IDS as readonly string[]).toContain(id);
  });
  it("flat mode: Save-Data or reduced data drops every filter and the picture still reads", () => {
    expect(flatMode({ saveData: true })).toBe(true); expect(flatMode({ reducedData: true })).toBe(true); expect(flatMode({})).toBe(false);
    expect(CSS).toMatch(/html\[data-save-data\] \.ill-f \{ filter: none; \}/);
    expect(CSS).toMatch(/@media \(prefers-reduced-data: reduce\) \{ \.ill-f \{ filter: none; \} \}/);
  });
  it("the value, the brand and the date stay in type outside the filtered groups", () => {
    const t = dom(renderToString(createElement(Trail, { points: [{ x: "Q1", y: 0.2 }, { x: "Q2", y: 0.47 }], label: "Share", format: v => `${v * 100}%` })));
    expect(t.querySelectorAll(".ill-f text").length).toBe(0);
    expect(t.querySelector(".ill-sticker")!.closest(".ill-f")).toBeNull();
    expect(t.querySelector(".ill-sticker")!.textContent).toBe("47%");
    expect(t.querySelector("[data-chart-table]")).not.toBeNull();
    expect(t.querySelector("svg[role=img]")!.getAttribute("aria-label")).toContain("Q2 47%");
    const c = dom(renderToString(createElement(CutAndPaste, { seed: 48, picture: createElement("div", null, "pic"), note: "Confirmed 15 Nov" })));
    expect([...c.querySelectorAll(".ill-f")].some(f => f.textContent?.includes("15 Nov"))).toBe(false);
    expect(c.textContent).toContain("Confirmed 15 Nov");
  });
  it("filters are never animated: keyframes move only transform, opacity, stroke-dashoffset (and the Cut wipe's clip-path)", () => {
    const frames = [...CSS.matchAll(/@keyframes ([\w-]+) \{([^@]*?)\}\s*\}?\s*(?=@|\n|$)/g)];
    expect(frames.length).toBeGreaterThan(5);
    for (const m of CSS.matchAll(/@keyframes ([\w-]+) (\{(?:[^{}]|\{[^{}]*\})*\})/g)) {
      const props = [...m[2]!.matchAll(/([a-z-]+)\s*:/g)].map(x => x[1]!);
      expect(props, m[1]).not.toContain("filter");
      if (m[1]!.startsWith("slug-")) for (const p of props) expect([...ANIMATABLE, ...(m[1] === "slug-wipe" ? ["clip-path"] : [])], `${m[1]} ${p}`).toContain(p);
    }
  });
});

describe("illustration: filter module", () => {
  it("filters.gen.ts matches brand/illustration/slug-filters.svg exactly", () => {
    const { defs, ids } = parseFilterSvg(readFileSync(FILTER_FILE, "utf8"));
    expect(FILTER_DEFS).toBe(defs); expect([...FILTER_IDS]).toEqual(ids);
  });
});
