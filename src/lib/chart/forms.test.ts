// L2 · the chart registry: one table for every chart the product draws; proposed forms stay off reader pages.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FIGURE_SHAPE, FORMS, PROPOSED_MODULES, SHAPE_FORMS, chartFormOfProposal, formsByEdition, multiplesChart } from "./forms";
import { chartProposal, formsFor } from "../newsroom/graphics";

const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const SOURCE = [...walk("src/components"), ...walk("src/routes")].filter(p => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p));
/** Files that draw SVG that is not a chart (marks, illustrations, page wireframes, image filters), with why. */
const NOT_CHARTS: Record<string, string> = {
  "src/components/brand/Illustration.tsx": "brand illustration", "src/components/brand/Wordmark.tsx": "the wordmark", "src/components/brand/mark.ts": "the mark",
  "src/components/brand/pages/BrandPages.tsx": "brand-book diagrams of the mark", "src/components/read/Treated.tsx": "image treatment filters",
  "src/components/terminal/LibraryWireframe.tsx": "a page's layout boxes", "src/components/terminal/LibraryArchiveStrip.tsx": "archive capture wireframes",
};

describe("the chart registry", () => {
  it("every form has the fields the brief asks for, a unique id and modules that exist", () => {
    expect(new Set(FORMS.map(f => f.id)).size).toBe(FORMS.length);
    for (const f of FORMS) {
      expect(f.fits.length, f.id).toBeGreaterThan(0);
      expect(f.use && f.avoid && f.least && f.access.table && f.access.alt, f.id).toBeTruthy();
      expect(f.looks.read || f.looks.data, f.id).toBeTruthy();
      for (const m of f.modules) expect(existsSync(m), `${f.id}: ${m}`).toBe(true);
      expect(f.status === "live" ? f.liveIn != null : f.liveIn == null, f.id).toBe(true);
    }
  });
  it("lists the five kit forms, the six special forms and the two proposed ones", () => {
    const ids = FORMS.map(f => f.id);
    for (const id of ["quarter-line", "small-multiples", "bars", "sparkline", "before-after-strip", "whitespace-scatter", "vibe-map", "library-history", "font-rank-flow", "palette-strip", "score-bars"]) expect(ids).toContain(id);
    expect(FORMS.filter(f => f.status === "proposed").map(f => f.id)).toEqual(["slope", "dot-range"]);
  });
  it("is N3's figure table (one table, not two): the same shapes and live forms in the same order", () => {
    expect(SHAPE_FORMS).toEqual({ "series per panel": ["line", "bars"], "share over quarters": ["quarter line"], "brands on two axes": ["scatter"], "bands over quarters": ["bands"], "two captures": ["before and after"], "frames in time": ["strip"] });
    expect(FIGURE_SHAPE["multiples"]).toBe("series per panel");
    expect(formsFor({ kind: "multiples", xs: ["Q1", "Q2", "Q3"] })).toEqual(["line", "bars"]);
  });
  it("fails when a component draws a chart that is not in it", () => {
    const listed = new Set(FORMS.flatMap(f => f.modules));
    const drawing = SOURCE.filter(p => /<svg[\s>]/.test(readFileSync(p, "utf8")));
    const unlisted = drawing.filter(p => !listed.has(p) && !NOT_CHARTS[p]);
    expect(unlisted).toEqual([]);
  });
  it("no reader route or reader component imports a proposed form (only the /brand/system specimens)", () => {
    const allowed = new Set(["src/components/brand/pages/SystemPage.tsx", ...PROPOSED_MODULES]);
    const names = [...PROPOSED_MODULES].map(m => m.replace(/^src\//, "@/").replace(/\.tsx?$/, ""));
    const importers = SOURCE.filter(p => !allowed.has(p) && names.some(n => readFileSync(p, "utf8").includes(`"${n}"`) || readFileSync(p, "utf8").includes(`/${n.split("/").pop()}"`)));
    expect(importers).toEqual([]);
    const kitIndex = readFileSync("src/components/chartkit/index.ts", "utf8");
    expect(kitIndex).not.toMatch(/Slope|DotRange/);
  });
  it("the colophon lists live forms by edition and never a proposed one", () => {
    const listed = formsByEdition().flatMap(e => e.forms);
    expect(listed).toContain("Quarter line");
    expect(listed).not.toContain("Slope chart");
    expect(listed).not.toContain("Dot with range");
  });
  it("the study builder's multiples choice: a line needs three points", () => {
    expect(multiplesChart(4, "line")).toBe("line");
    expect(multiplesChart(2, "line")).toBe("bars");
    expect(multiplesChart(6, "bars")).toBe("bars");
  });
});

describe("a proposed form goes live only through a proposal", () => {
  it("a figure no live form shows whole names the proposed form that would fit", () => {
    const fig = { kind: "multiples", title: "Each sector then and now", xs: ["2021Q1", "2026Q4"], panels: 14 };
    const p = chartProposal(fig, "sector-against-sector", "slope chart", "bars")!;
    expect(p.form?.id).toBe("slope");
    expect(p.text).toContain("“bars” shows it only by dropping part of its data");
    expect(p.text).toContain("The registry's proposed form “Slope chart” (slope) would fit");
    expect(chartFormOfProposal(p.text)?.id).toBe("slope");
  });
  it("describes a missing form the registry does not list, and files nothing when a live form fits whole", () => {
    const fig = { kind: "multiples", title: "Twelve composites", xs: ["Q1", "Q2", "Q3", "Q4"], panels: 4 };
    expect(chartProposal(fig, "s", "", "line")).toBeNull();
    const m = chartProposal(fig, "s", "radial tree", "line")!;
    expect(m.form).toBeNull();
    expect(m.text).toContain("A chart form the registry does not list: radial tree");
    expect(chartFormOfProposal(m.text)).toBeNull();
    expect(chartProposal(fig, "s", "bars", "line")).toBeNull();
  });
});
