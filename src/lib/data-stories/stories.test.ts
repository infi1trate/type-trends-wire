import { describe, expect, it } from "vitest";
import { fxInput, fxCapture } from "./fixtures";
import { softwareStory, bigTypeStory, sectorMindsStory, whereYouSit, mindsBrand, signalContrast, type Meta } from "./stories";
import { softwareFigures } from "./checks";
import { capText, cap, num, ref, isNum, pctText, dayText } from "./text";
import { buildWhereYouSit, isTracked, normDomain, dataShelf } from "./build";
import type { StoryModel } from "./types";

const meta = (slug: string): Meta => ({ slug, number: 9, question: "Q?", deck: "D", template: "T", collection: { label: "C", href: "/c" }, related: [] });
const i = fxInput();
const capsFor = (ds: string[]) => new Map(ds.map((d, k) => [d, [fxCapture(k * 10 + 1, "2021-02-10T00:00:00Z"), fxCapture(k * 10 + 2, "2023-02-10T00:00:00Z", { h1_size: 80 }), fxCapture(k * 10 + 3, "2026-11-14T00:00:00Z", { source: "live", bg: "#0A0A0A" })]]));
const stories: StoryModel[] = [
  softwareStory(i, capsFor(softwareFigures(i).topBrands.map(b => b.domain)), meta("software")),
  bigTypeStory(i, new Map(), meta("big")),
  sectorMindsStory(i, capsFor([mindsBrand(i)!]), meta("minds")),
  whereYouSit(i, "b00.example", capsFor(["b00.example"]).get("b00.example")!, meta("where-you-sit"))!,
];

describe("data stories: every sentence is a template filled from numbers", () => {
  for (const s of stories) it(`${s.slug}: every step has a caption, a figure that exists, and no digit outside a number with a receipt`, () => {
    expect(s.steps.length).toBeGreaterThan(2);
    expect(new Set(s.steps.map(x => x.id)).size).toBe(s.steps.length);
    for (const st of s.steps) {
      expect(capText(st.caption).trim().length, st.id).toBeGreaterThan(10);
      expect(s.figures[st.view.figure], st.id).toBeDefined();
      for (const seg of st.caption) {
        if (typeof seg === "string") expect(seg, `${s.slug}/${st.id}`).not.toMatch(/\d/);
        else expect(seg.href, st.id).toMatch(/^\//);
      }
    }
  });
  for (const s of stories) it(`${s.slug}: each number's text is the number it carries`, () => {
    for (const n of s.steps.flatMap(x => x.caption).filter(isNum)) {
      expect(Number.isFinite(n.v)).toBe(true);
      if (/^\d+$/.test(n.n)) expect(Number(n.n)).toBe(n.v);
      else if (/^\d+\.\d%$/.test(n.n)) expect(pctText(n.v)).toBe(n.n);
      else if (/^\d+%$/.test(n.n)) expect(`${Math.round(n.v * 100)}%`).toBe(n.n);
      else if (/^\d+px$/.test(n.n)) expect(`${Math.round(n.v)}px`).toBe(n.n);
      else if (/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(n.n)) expect(dayText(new Date(n.v).toISOString())).toBe(n.n);
      else expect(n.n).toMatch(/^(Q[1-4] \d{4}|\d+\.\d|\d+ points|\d{4}–\d{4}|\d+\.\d times)$/);
    }
  });
  it("software: every share in a caption is a point on the chart", () => {
    const s = stories[0]!, fig = s.figures["multiples"]!;
    const ys = fig.kind === "multiples" ? fig.panels.flatMap(p => p.points.map(q => q.y)) : [];
    for (const n of s.steps.flatMap(x => x.caption).filter(isNum).filter(n => n.n.endsWith("%"))) expect(ys).toContain(n.v);
  });
  it("big type: the first three are the earliest established adopters", () => {
    const s = stories[1]!, st = s.steps.find(x => x.id === "first-three")!, fig = s.figures["adoption"]!;
    const first = fig.kind === "adoption" ? fig.adopters.filter(a => !a.censored).slice(0, 3).map(a => a.domain) : [];
    expect(st.view.highlight).toEqual(first);
  });
  it("captions compose segments with receipts", () => {
    const c = cap`${num("12", 12, "/x")} brands in ${ref("Fintech", "/sectors/fintech")}.`;
    expect(capText(c)).toBe("12 brands in Fintech.");
    expect(c).toHaveLength(4);
  });
});

describe("where you sit", () => {
  it("builds only for tracked brands", () => {
    expect(isTracked(i, "b00.example")).toBe(true);
    expect(isTracked(i, "example.com")).toBe(false);
    expect(buildWhereYouSit(i, "example.com", [])).toBeNull();
    expect(normDomain("https://www.B00.example/pricing")).toBe("b00.example");
  });
  it("contrasts against the rest of the sector: signals it has that most don't, and the reverse", () => {
    const c = signalContrast(i, "b00.example");
    for (const h of c.has) expect(h.sector.v).toBeLessThan(0.5);
    for (const l of c.lacks) expect(l.sector.v).toBeGreaterThan(0.5);
  });
  it("its strip falls back to skeletons with zero crops", () => {
    const s = stories[3]!, fig = s.figures["strip"]!;
    expect(fig.kind === "strip" && fig.frames.every(f => f.crop === null && f.boxes.length > 0)).toBe(true);
  });
});

describe("front shelf", () => {
  it("lists live stories by registry status", () => {
    expect(dataShelf().map(d => d.number)).toEqual([1, 2, 4]);
  });
});
