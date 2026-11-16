import { describe, expect, it } from "vitest";
import { shareScene, parseSharePath, sharePath, SHARE_SIZE } from "./scene";
import { withShare } from "./meta";
import { issueOgScene } from "../digest/og";
import { auditOgScene } from "../agency/og";
import { textWidth, type Prim } from "../chart/card";

// The longest published headline, the longest stored headline of any status and the longest tracked brand name (16 Nov 2026).
const LONGEST_HEADLINE = "apple.com changed its palette to Off-white and light grey, Muted dark indigo, Vivid purple";
const LONGEST_ANY = "Work from anywhere | Sr. Software Quality Analyst USD 23–31 USD/hr contract with Shrine Development Reviewing specs and Figma flows for gaps and testability";
const LONGEST_BRAND = "daylightcomputer.com";
const LONG_DECK = "theverge.com shifted its imagery (AI estimate): Abstract shapes, Lifestyle photography, Product UI shots → People photography, Product photography, Product UI shots. Confirmed 14 Nov.";

type T = Extract<Prim, { k: "text" }>;
const texts = (prims: Prim[]) => prims.filter((p): p is T => p.k === "text");
function inside(scene: { w: number; h: number; prims: Prim[] }) {
  for (const t of texts(scene.prims)) {
    const f = { face: t.face, weight: t.weight }, wd = textWidth(t.text, t.size, f), left = t.anchor === "end" ? t.x - wd : t.x;
    expect(left, t.text).toBeGreaterThanOrEqual(0); expect(left + wd, t.text).toBeLessThanOrEqual(scene.w - 47);
    expect(t.y, t.text).toBeLessThanOrEqual(scene.h);
  }
}
/** Every drawn line is made of whole words of the source (a trailing "…" marks where it stopped). */
function wholeWords(lines: string[], source: string) {
  const words = new Set(source.toUpperCase().split(/\s+/)), lower = new Set(source.split(/\s+/));
  for (const l of lines) for (const w of l.replace(/…$/, "").split(/\s+/).filter(Boolean)) expect(words.has(w) || lower.has(w), `"${w}" in "${l}"`).toBe(true);
}

describe("share cards", () => {
  for (const [name, title] of [["longest headline", LONGEST_HEADLINE], ["longest stored title", LONGEST_ANY], ["longest brand", LONGEST_BRAND]] as const)
    it(`${name}: nothing overflows and nothing is cut mid-word`, () => {
      const s = shareScene({ kicker: "Move · Layout · Consumer tech · 16 Nov 2026", title, deck: LONG_DECK, figure: { value: "26%", label: "of tracked homepages show it, all sectors, latest forecast" }, path: `/brands/${LONGEST_BRAND}` });
      expect({ w: s.w, h: s.h }).toEqual(SHARE_SIZE);
      inside(s);
      const t = texts(s.prims);
      wholeWords(t.filter(x => x.size === 44).map(x => x.text), title);
      wholeWords(t.filter(x => x.size === 28 && x.face === "text" && !x.text.includes("tracked")).map(x => x.text), LONG_DECK);
    });
  it("the existing Digest and audit drawers hold the longest title and brand", () => {
    inside(auditOgScene([LONGEST_BRAND, "businessinsider.com", "teenage.engineering", "a.co", "b.co", "c.co"], "2026-11-16"));
    const issue = { cover: { headline: LONGEST_HEADLINE, lead: null, card: null }, name: "The Digest", number: 1, dates: { label: "9–15 Nov 2026" }, dataThrough: "15 Nov 2026" };
    const scene = issueOgScene(issue as never);
    inside(scene);
    wholeWords(texts(scene.prims).filter(x => x.size === 44).map(x => x.text), LONGEST_HEADLINE);
  });
  it("parses share paths and refuses unknown kinds", () => {
    expect(parseSharePath("brand/neon.com.png")).toEqual({ kind: "brand", id: "neon.com", format: "png" });
    expect(parseSharePath("pattern/imagery%3Acollage.svg")).toEqual({ kind: "pattern", id: "imagery:collage", format: "svg" });
    expect(parseSharePath("nope/x.png")).toBeNull(); expect(parseSharePath("brand/x.gif")).toBeNull();
    expect(sharePath("story", "move:1")).toBe("/share/story/move%3A1.png");
  });
  it("head tags carry one absolute 1200×630 image on og and twitter", () => {
    const m = withShare("/share/brand/neon.com.png", [{ title: "t" }, { name: "twitter:card", content: "summary" }]);
    expect(m.filter(x => x.name === "twitter:card")).toEqual([{ name: "twitter:card", content: "summary_large_image" }]);
    const og = m.find(x => x.property === "og:image")!.content!, tw = m.find(x => x.name === "twitter:image")!.content!;
    expect(og).toBe(tw); expect(og).toMatch(/^https:\/\/slug\.global\/share\/brand\/neon\.com\.png$/);
  });
});
