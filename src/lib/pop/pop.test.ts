import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isTyping, keyAction } from "./keys";
import { STICKER_USES, isNewStory, studyBand } from "./rules";

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
const css = readFileSync("src/styles.css", "utf8");

describe("A4 keys", () => {
  const base = { typing: false, mod: false, inList: false, pendingG: false, path: "/" };
  it("never fire while the reader types", () => {
    for (const key of ["j", "k", "g", "?", "ArrowDown"]) expect(keyAction({ ...base, key, typing: true })).toBeNull();
    expect(isTyping({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(isTyping({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTyping({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTyping({ tagName: "A" })).toBe(false);
  });
  it("j/k move, arrows only inside a list, g then t/s/b jump", () => {
    expect(keyAction({ ...base, key: "j" })).toEqual({ do: "next" });
    expect(keyAction({ ...base, key: "ArrowDown" })).toBeNull();
    expect(keyAction({ ...base, key: "ArrowDown", inList: true })).toEqual({ do: "next" });
    expect(keyAction({ ...base, key: "s", pendingG: true })).toEqual({ do: "go", to: "/signals" });
    expect(keyAction({ ...base, key: "j", path: "/terminal" })).toBeNull();
  });
});

describe("A3 stickers", () => {
  it("are used only in the allowed places", () => {
    expect([...STICKER_USES]).toEqual(["moved", "arrivals", "new-story", "forecast-legend"]);
    const bad = walk("src/components").filter(f => !/brand\/|kit\//.test(f)).flatMap(f => [...readFileSync(f, "utf8").matchAll(/<Sticker\b([^>]*)>([^<]*)/g)].map(m => `${f}: ${m[2]}`))
      .filter(x => !/a4\/Pop\.tsx|Covers\.tsx|BrandsIndexView\.tsx|FrontLive\.tsx: \{newStoriesText/.test(x));
    expect(bad).toEqual([]);
  });
  it("NEW lasts 24 hours", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(isNewStory("2026-11-25T00:00:00Z", now)).toBe(true);
    expect(isNewStory("2026-11-24T11:59:00Z", now)).toBe(false);
  });
  it("study bands are stable by number mod 3", () => { expect([7, 8, 9].map(studyBand)).toEqual([1, 2, 0]); });
});

describe("A3 one highlight per page", () => {
  it("each file carries at most one highlighter mark", () => {
    for (const f of walk("src/components")) expect((readFileSync(f, "utf8").match(/data-highlight=/g) ?? []).length, f).toBeLessThanOrEqual(1);
  });
});

describe("reduced motion", () => {
  it("switches off every keyframe animation and transition the stylesheet declares", () => {
    const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)].map(m => m[1]).join("\n") + css.match(/@media \(prefers-reduced-motion: reduce\)[^\n]*/g)!.join("\n");
    expect(blocks).toMatch(/view-transition-group\(\*\)[^}]*animation: none/);
    expect(blocks).toMatch(/\.digest \.brand-tile, \.digest \.moved-card, \.digest \.study-card \{ transition: none/);
    expect(blocks).toMatch(/\.ph-b::after \{ animation: none/);
  });
});

describe("focus outline", () => {
  it("is never removed on rows, cards, chips and buttons", () => {
    expect(css).toMatch(/:focus-visible \{\n\s+outline: var\(--tk-focus-width\) solid var\(--sys-color-focus\)/);
    expect(css).not.toMatch(/\.(ledger-link|brand-tile|study-card|cat-chip|c-raised|c-sticker)[^{]*:focus-visible[^{]*\{[^}]*outline: none/);
    expect(css).toMatch(/\[data-key-selected\] \{ outline: var\(--tk-focus-width\)/);
  });
});

describe("A3 · Signals and sector pages carry their one highlight", () => {
  it("on the existing count words", () => {
    expect(readFileSync("src/components/read/SignalsIndexView.tsx", "utf8")).toContain("<mark className=\"hl-mark\" data-highlight=\"\">{m[1]}</mark>");
    expect(readFileSync("src/components/read/EditionsViews.tsx", "utf8")).toMatch(/data-highlight="">\{r\.signals\.length\} headline signals<\/mark>/);
  });
});
