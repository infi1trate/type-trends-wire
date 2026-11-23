// W3d Part 2 · ground at its edges, removed apps, short categories, the lean.
import { describe, expect, it } from "vitest";
import { CATEGORY_MIN_APPS, MIXED_BELOW, groundOf, leanText, readWeek, topText, type IconIn } from "./measure";

const W = "2026-W48";
let seq = 0;
const icon = (genre: [number, string], rank: number, palette: { hex: string; share: number }[], o: Partial<IconIn> = {}): IconIn => ({ app_id: String(++seq), rank, name: `App ${seq}`, maker: "M", link: `https://apps.apple.com/us/app/id${seq}`, palette, genre_id: genre[0], genre_name: genre[1], week: W, ...o });
const BLUE = "#1F5FD0", GREEN = "#1FA050", WHITE = "#FFFFFF", BLACK = "#000000", RED = "#D02020";
/** A category of `n` icons: `spec` maps a colour to how many icons sit on it (the rest are mixed). */
function category(genre: [number, string], spec: [string, number][], n = 100, o: Partial<IconIn> = {}): IconIn[] {
  const out: IconIn[] = []; let rank = 1;
  for (const [hex, k] of spec) for (let j = 0; j < k; j++) out.push(icon(genre, rank++, [{ hex, share: 0.7 }, { hex: "#808080", share: 0.3 }], o));
  while (out.length < n) out.push(icon(genre, rank++, [{ hex: RED, share: 0.3 }, { hex: BLUE, share: 0.3 }, { hex: GREEN, share: 0.3 }], o));
  return out;
}

describe("an icon's ground (W3d)", () => {
  it("is the largest colour; at exactly 0.35 it counts, under it the icon is mixed", () => {
    expect(MIXED_BELOW).toBe(0.35);
    expect(groundOf([{ hex: BLUE, share: 0.35 }, { hex: RED, share: 0.3 }, { hex: GREEN, share: 0.3 }]).ground).toBe("blue");
    expect(groundOf([{ hex: BLUE, share: 0.3499 }, { hex: RED, share: 0.33 }, { hex: GREEN, share: 0.32 }])).toEqual({ ground: "mixed", hex: "#1F5FD0", share: 0.3499 });
  });
  it("names white, grey and black as themselves, and keeps the icon's own hex", () => {
    expect(groundOf([{ hex: "#fbfbf8", share: 0.8 }]).ground).toBe("white");
    expect(groundOf([{ hex: "#777777", share: 0.8 }]).ground).toBe("grey");
    expect(groundOf([{ hex: "#0a0a0c", share: 0.8 }]).ground).toBe("black");
    expect(groundOf([{ hex: "#ff6a00", share: 0.2 }, { hex: "#fbfbf8", share: 0.6 }])).toEqual({ ground: "white", hex: "#FBFBF8", share: 0.6 });
  });
});

describe("a week's reading (W3d)", () => {
  const finance = category([6015, "Finance"], [[BLUE, 23], [WHITE, 21], [GREEN, 15]]);
  const games = category([6014, "Games"], [[BLUE, 28], [BLACK, 10]]);
  const prod = category([6007, "Productivity"], [[WHITE, 52], [BLUE, 20]]);
  const short = category([6020, "Medical"], [[WHITE, 40]], CATEGORY_MIN_APPS - 1);
  const rows = [...finance, ...games, ...prod, ...short];
  it("counts by ground, leading ground and the mixed share; leaves out a category under 80 apps", () => {
    const r = readWeek(rows);
    expect(r.week).toBe(W);
    expect(r.categories.map(c => c.name)).toEqual(["Productivity", "Games", "Finance"]);
    expect(r.leftOut).toEqual([{ name: "Medical", apps: 79 }]);
    const f = r.categories.find(c => c.name === "Finance")!;
    expect(f.counts).toMatchObject({ blue: 23, white: 21, green: 15, mixed: 41 });
    expect(f.leading).toEqual({ grounds: ["blue"], n: 23, share: 0.23 });
    expect(f.mixedShare).toBe(0.41);
    expect(topText(f)).toBe("Blue 23 · White 21 · Green 15 · 41 mixed");
    expect(r.all).toMatchObject({ apps: 300 });
    expect(r.all.counts.blue).toBe(71);
  });
  it("orders each row's cells by ground then lightest first", () => {
    const f = readWeek(rows).categories.find(c => c.name === "Finance")!;
    expect(f.cells.slice(0, 2).map(c => c.ground)).toEqual(["green", "green"]);
    expect([...new Set(f.cells.map(c => c.ground))]).toEqual(["green", "blue", "white", "mixed"]);
  });
  it("a removed app never counts, so a category can fall under 80", () => {
    const cut = finance.map((a, k) => (k < 21 ? { ...a, removed_at: "2026-11-25T00:00:00Z" } : a));
    const r = readWeek([...cut, ...games]);
    expect(r.categories.map(c => c.name)).toEqual(["Games"]);
    expect(r.leftOut).toEqual([{ name: "Finance", apps: 79 }]);
    const r2 = readWeek([...finance.map((a, k) => (k === 0 ? { ...a, removed_at: "x" } : a)), ...games]);
    expect(r2.categories.find(c => c.name === "Finance")!.counts.blue).toBe(22);
  });
  it("the lean is the ground furthest above its share across all categories, in points", () => {
    const r = readWeek(rows), f = r.leans.find(l => l.category === "Finance")!;
    // green: 15/100 against 15/300 = 5 per 100, +10 points; white: 21% against 73/300 = 24.3%, below; blue 23% against 23.7%, below.
    expect(f).toMatchObject({ ground: "green", n: 15, apps: 100, allN: 15, allApps: 300, points: 10 });
    expect(f.examples.map(e => e.name)).toEqual(["App 45", "App 46", "App 47"]);
    expect(leanText(f)).toBe("Finance leans green: 15 of 100, against 5 of 100 across all categories");
    expect(r.leans.find(l => l.category === "Productivity")).toMatchObject({ ground: "white", n: 52 });
    expect(r.leans.find(l => l.category === "Games")).toMatchObject({ ground: "black", n: 10 });
  });
  it("a tie for the lead is kept as a tie", () => {
    const food = category([6023, "Food & Drink"], [[RED, 24], [WHITE, 24]]);
    expect(readWeek(food).categories[0]!.leading).toEqual({ grounds: ["red", "white"], n: 24, share: 0.24 });
  });
  it("reads only the newest week", () => {
    const old = category([6015, "Finance"], [[RED, 90]], 100, { week: "2026-W47" });
    const r = readWeek([...old, ...finance]);
    expect(r.week).toBe(W);
    expect(r.categories[0]!.counts.red).toBe(0);
  });
});
