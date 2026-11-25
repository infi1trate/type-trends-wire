// B2 · the three proposed forms' layout rules: no dot or label overlap at 390/768/1440, the lag including "not yet", band heights
// summing to the strip, and the role palette's contrast against paper and ink.
import { describe, expect, it } from "vitest";
import { dotSize, wakeDotLine, wakeLayout, wakeOrder, wakeTicks } from "./wake-layout";
import { gapAreas, lagOf, lagText, leadLine, leadPoints, type LeadRow } from "./leadlag-layout";
import { FILLS, ROLE_FILL, bandLine, multiplesLayout, sortByRole, stripBands, textOn, typicalPage, yearsRead, type Fill } from "./anatomy-layout";
import { contrast } from "@/lib/theme/contrast";
import type { Adopter } from "@/lib/data-stories/types";

const qs = ["2021Q1", "2021Q3", "2022Q1", "2022Q3", "2023Q1", "2023Q3", "2024Q1", "2024Q3", "2025Q1", "2025Q3", "2026Q1", "2026Q3", "2026Q4"];
const ad = (i: number, first: string, censored = false, dropped = false): Adopter => ({ domain: `b${i}.com`, name: ["Vercel", "Linear", "Stripe", "Notion", "Figma"][i % 5]! + (i > 4 ? ` ${i}` : ""), sector: "dev", first, firstAt: "", censored, dropped, href: `/library/b${i}.com` });
// A real-sized fixture: 64 adopters, a crowd in the last quarters, nine already there.
const adopters = [...Array.from({ length: 9 }, (_, i) => ad(i, qs[0]!, true)), ...Array.from({ length: 55 }, (_, i) => ad(i + 9, qs[Math.min(qs.length - 1, Math.floor(Math.sqrt(i) * 1.7))]!, false, i % 7 === 0))];
const fig = { quarters: qs, adopters, share: qs.map((q, i) => ({ x: q, y: 0.02 + i * 0.02 })) };
const V = new Set(["b9.com", "b12.com", "b20.com"]);

describe("adoption wake", () => {
  it("draws 8 px dots at 1440 and 6 px at 390", () => { expect(dotSize(1440)).toBe(8); expect(dotSize(390)).toBe(6); });
  for (const w of [390, 768, 1440]) it(`no dots or labels overlap at ${w}`, () => {
    const l = wakeLayout(fig, V, w);
    for (let i = 0; i < l.dots.length; i++) for (let j = i + 1; j < l.dots.length; j++) { const a = l.dots[i]!, b = l.dots[j]!; expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.domain}/${b.domain}`).toBeGreaterThanOrEqual(a.r + b.r); }
    for (const t of l.labels) {
      expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x + t.w).toBeLessThanOrEqual(w);
      for (const o of l.dots) { const inX = o.x + o.r > t.x && o.x - o.r < t.x + t.w, inY = o.y + o.r > t.y - 11 && o.y - o.r < t.y + 3; expect(inX && inY, `${t.text} over ${o.domain}`).toBe(false); }
      for (const u of l.labels) if (u !== t) expect(t.x + t.w <= u.x || u.x + u.w <= t.x || Math.abs(t.y - u.y) >= 12).toBe(true);
    }
    expect(l.labels.length).toBeLessThanOrEqual(3);
  });
  for (const w of [390, 768, 1440]) it(`axis years never touch at ${w}`, () => {
    const t = wakeTicks(wakeLayout(fig, V, w));
    for (let i = 1; i < t.length; i++) expect(t[i]!.x - t[i - 1]!.x).toBeGreaterThanOrEqual(t[i]!.text.length * 6.6 + 4);
  });
  it("puts brands that already had it in the left column, never a dated one", () => {
    const l = wakeLayout(fig, V, 768);
    expect(l.dots.filter(d => d.censored).every(d => d.col === 0)).toBe(true);
    expect(l.dots.filter(d => !d.censored).every(d => d.col > 0)).toBe(true);
    expect(l.dated).toBe(55);
  });
  it("reads a dot as name · first seen · vanguard · still there, and walks quarter by quarter", () => {
    expect(wakeDotLine({ name: "Vercel", quarter: "2024Q1", vanguard: true, dropped: false })).toBe("Vercel · first seen early 2024 · vanguard · still there");
    const o = wakeOrder(wakeLayout(fig, V, 768));
    for (let i = 1; i < o.length; i++) expect(o[i]!.col).toBeGreaterThanOrEqual(o[i - 1]!.col);
  });
});

const row = (quarter: string, v: number, r: number, vn = 40, rn = 200): LeadRow => ({ quarter, van_n: vn, van_yes: Math.round(v * vn), rest_n: rn, rest_yes: Math.round(r * rn) });
describe("lead and lag", () => {
  it("measures how many quarters earlier the vanguard reached the level the rest reached last", () => {
    const rows = [row("2024Q1", 0.1, 0.02), row("2024Q2", 0.2, 0.05), row("2024Q3", 0.3, 0.1), row("2024Q4", 0.3, 0.2), row("2025Q1", 0.3, 0.3)];
    const l = lagOf(leadPoints(rows))!;
    expect(l.kind).toBe("ahead"); expect(l.vanAt).toBe("2024Q3"); expect(l.restAt).toBe("2025Q1"); expect(lagText(l)).toBe("2 quarters ahead");
  });
  it("says “at least” when the vanguard was already there in the first quarter read", () => {
    const l = lagOf(leadPoints([row("2021Q1", 0.4, 0.1), row("2023Q1", 0.4, 0.2), row("2026Q4", 0.3, 0.3)]))!;
    expect(lagText(l)).toBe("at least 23 quarters ahead");
  });
  it("says “not yet” when the vanguard holds a level the rest never reached", () => {
    const l = lagOf(leadPoints([row("2025Q1", 0.2, 0.05), row("2025Q2", 0.4, 0.08), row("2025Q3", 0.41, 0.12)]))!;
    expect(l.kind).toBe("not-yet"); expect(l.quarters).toBeNull(); expect(lagText(l)).toBe("not yet");
  });
  it("reports a vanguard behind the rest", () => {
    const l = lagOf(leadPoints([row("2025Q1", 0.02, 0.1), row("2025Q2", 0.1, 0.2), row("2025Q3", 0.2, 0.2)]))!;
    expect(l.kind).toBe("behind"); expect(l.quarters).toBe(1);
  });
  it("marks quarters under 15 vanguard brands thin and never draws a rest share under 15", () => {
    const p = leadPoints([row("2025Q1", 0.3, 0.1, 10, 14)])[0]!;
    expect(p.thin).toBe(true); expect(p.r).toBeNull();
  });
  it("fills green where the vanguard is ahead and pink where it is behind, split at the crossing", () => {
    const a = gapAreas([{ x: 0, v: 10, r: 50 }, { x: 100, v: 60, r: 40 }]); // pixel y: smaller is higher
    expect(a.map(x => x.ahead)).toEqual([true, false]);
  });
  it("reads as Vanguard · Everyone else · gap · quarter", () => {
    expect(leadLine(leadPoints([row("2026Q3", 0.41, 0.12, 100, 100)])[0]!, "Q3 2026")).toBe("Vanguard 41% · Everyone else 12% · gap 29 points · Q3 2026");
  });
});

const HEX: Record<Fill, string> = { ink: "#0A0A0A", ink60: "#6A6862", ink30: "#B2ADA2", ink12: "#DCD7CB", pink: "#FF8FC4", yellow: "#FFE600", green: "#19B560", paper: "#F1ECE0" };
describe("page anatomy", () => {
  const secs = [{ r: "hero", y: 0, h: 900, t: null }, { r: "logos", y: 900, h: 120, t: null }, { r: "testimonials", y: 1020, h: 400, t: null }, { r: "pricing", y: 1420, h: 700, t: null }, { r: "footer", y: 2120, h: 300, t: null }];
  it("band heights sum to the strip", () => {
    for (const H of [200, 260, 360]) expect(stripBands(secs, H).reduce((t, b) => t + b.h, 0)).toBeCloseTo(H, 6);
  });
  it("reads a band as brand · section n of m · role · share · start", () => {
    const b = stripBands(secs, 1)[2]!;
    expect(bandLine("Linear", b, 5)).toBe("Linear · section 3 of 5 · Quotes · 17% of the page · starts 42% down");
  });
  it("hero is the strongest fill, and every band's label reads against its fill; every fill stands off paper or is outlined in ink", () => {
    expect(ROLE_FILL["hero"]).toBe("ink");
    expect(new Set(Object.values(HEX)).size).toBe(Object.keys(FILLS).length);
    for (const f of Object.keys(FILLS) as Fill[]) {
      expect(contrast(textOn(f) === "paper" ? HEX.paper : HEX.ink, HEX[f]), f).toBeGreaterThanOrEqual(4.5);
      // ink tints, pink and green stand off the paper by lightness; yellow stands off it by hue (and every band is outlined in ink)
      if (f !== "paper" && f !== "yellow") expect(contrast(HEX.paper, HEX[f]), `${f} off paper`).toBeGreaterThanOrEqual(1.1);
    }
  });
  it("the typical page takes median positions and sums to one; pages sort by a role's start; the 15-page floor", () => {
    const pages = Array.from({ length: 16 }, (_, i) => ({ domain: `p${i}`, name: `P${i}`, sections: secs.map((s, k) => (k === 3 ? { ...s, h: s.h + i * 10 } : s)) }));
    const t = typicalPage(pages);
    expect(t[0]!.role).toBe("hero"); expect(t.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6);
    expect(sortByRole(pages, "pricing").length).toBe(16);
    expect(multiplesLayout(14, 800)).toBeNull(); expect(multiplesLayout(15, 800)).not.toBeNull();
    expect(yearsRead({ "2026Q4": 283, "2026Q3": 3 })).toEqual(["2026Q4"]);
  });
});
