import { describe, expect, it, vi, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { Wordmark, Monogram } from "./Wordmark";
import { MARK_PATHS } from "./mark.gen";
import { MARK_FILES, parseMarkSvg } from "./mark-files";
import { MARK_INK, SLAB, cutFor, markSvg, slabPad, CUT_MIN_PX } from "./mark";
import { Ledger } from "./Ledger";
import { BRAND_KIT } from "@/lib/theme";
import { frontModel } from "@/lib/front/front";
import { input, quietInput, st, iso, NOW, H } from "@/lib/front/fixtures";
import { renderInRouter } from "@/test/router-harness";
import { DENSITY, DENSITIES, densityOf, densityOfFile, routeKeyOf } from "@/lib/ia";

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("the mark", () => {
  it("the inlined module matches the kit's outlined files exactly", () => {
    for (const [cut, file] of Object.entries(MARK_FILES)) expect(MARK_PATHS[cut as keyof typeof MARK_PATHS], cut).toEqual(parseMarkSvg(readFileSync(`brand/logo/svg/${file}`, "utf8")));
    expect(MARK_INK).toBe(BRAND_KIT.mark.colour);
    expect(SLAB).toEqual({ ink: BRAND_KIT.color.pink, image: BRAND_KIT.color.paper });
  });
  it("picks the cut by rendered height: 96 and up display, 32 to under 96 standard, under 32 micro", () => {
    expect(CUT_MIN_PX).toEqual({ display: BRAND_KIT.mark.cuts.display["min-height-px"], standard: BRAND_KIT.mark.cuts.standard["min-height-px"], micro: 0 });
    expect([cutFor(200), cutFor(96), cutFor(95.9), cutFor(32), cutFor(31.9), cutFor(12)]).toEqual(["display", "display", "standard", "standard", "micro", "micro"]);
    for (const [h, cut] of [[120, "display"], [48, "standard"], [20, "micro"]] as const) {
      const { container } = render(<Wordmark height={h} />);
      expect(container.querySelector("[data-wordmark]")!.getAttribute("data-cut")).toBe(cut);
      expect(container.querySelector("path")!.getAttribute("d")).toBe(MARK_PATHS[cut].d);
      expect(container.querySelector("svg")!.getAttribute("height")).toBe(String(h));
    }
  });
  it("is never recoloured: the fill is brand ink on every ground, with no other colour, filter or shadow", () => {
    for (const ground of ["paper", "pink", "yellow", "green", "ink", "image", "auto"] as const) {
      const { container } = render(<Wordmark height={40} ground={ground} />);
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(1);
      expect(paths[0]!.getAttribute("fill")).toBe(MARK_INK);
      expect(container.innerHTML).not.toMatch(/filter|shadow|currentColor/);
    }
    const src = readFileSync("src/components/brand/Wordmark.tsx", "utf8");
    expect(src).not.toMatch(/fill=\{(?!MARK_INK)/);
    expect(readFileSync("src/styles.css", "utf8")).not.toMatch(/\.wordmark[^{]*\{[^}]*(?:fill|color):/);
  });
  it("sits directly on paper, pink, yellow and green; on ink a pink slab, over an image a paper slab, padded half the x-height", () => {
    for (const g of ["paper", "pink", "yellow", "green"] as const) expect((render(<Wordmark height={40} ground={g} />).container.querySelector("[data-wordmark]") as HTMLElement).style.background).toBe("");
    const ink = render(<Wordmark height={40} ground="ink" />).container.querySelector("[data-wordmark]") as HTMLElement;
    expect(ink.style.background).toBe("rgb(255, 143, 196)");
    expect(ink.style.padding).toBe(`${slabPad(40)}px`);
    expect(slabPad(40)).toBe(8);
    const img = render(<Wordmark height={40} ground="image" />).container.querySelector("[data-wordmark]") as HTMLElement;
    expect(img.style.background).toBe("rgb(241, 236, 224)");
    expect(markSvg(40, "ink")).toContain(`fill="${SLAB.ink}"`);
    expect(markSvg(40, "paper")).not.toContain("<rect");
  });
  it("the shell, the footer and the terminal draw the mark on its ink slab; the s monogram comes from the kit's s", () => {
    // The Read shell's mark is the arriving mark: the same Wordmark on its ink slab, drawn letter by letter.
    expect(readFileSync("src/components/read/ReadShell.tsx", "utf8")).toMatch(/<ArrivingMark height=\{\d+\}/);
    expect(readFileSync("src/components/brand/Motion.tsx", "utf8")).toMatch(/<Wordmark height=\{height\} ground="ink"/);
    expect(readFileSync("src/components/digest/Editorial.tsx", "utf8")).toMatch(/<Wordmark height=\{\d+\} ground="ink"/);
    expect(readFileSync("src/components/terminal/Chrome.tsx", "utf8")).toMatch(/<Wordmark height=\{\d+\} ground="ink"/);
    const { container } = render(<Monogram height={30} />);
    expect(container.querySelector("path")!.getAttribute("d")).toBe(MARK_PATHS.s.d);
  });
  it("the gate page, embeds and share images draw the mark (never the name in a font)", async () => {
    const { renderGatePage } = await import("@/lib/gate");
    const gateHtml = renderGatePage("/");
    expect(gateHtml).toContain(MARK_PATHS.display.d.slice(0, 40));
    expect(gateHtml).not.toMatch(/class="wordmark"/);
    expect(gateHtml.match(/<button/g)!.length).toBe(1);
    const { dataStoryOgScene } = await import("@/lib/data-stories/og");
    const scene = dataStoryOgScene({ number: 2, slug: "x", question: "Q?", key: { n: "75", label: "l" }, template: "T" });
    expect(scene.prims.some(p => p.k === "mark")).toBe(true);
    expect(scene.prims.some(p => p.k === "text" && /\bslug\b(?!\.)/.test(p.text))).toBe(false);
    expect(readFileSync("public/favicon.svg", "utf8")).toBe(readFileSync("brand/logo/svg/slug-favicon.svg", "utf8"));
  });
});

describe("containers", () => {
  it("no component other than Raised and Sticker uses a shadow token", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /--tk-shadow-(raised|sticker|pressed)/.test(m[2]!));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r[1]!.trim(), r[1]).toMatch(/^\.c-(raised|sticker)\b/);
    const code = walk("src").filter(f => /\.(tsx?|css)$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx") && !f.includes("/theme/") && !f.endsWith("styles.css"));
    expect(code.filter(f => /--tk-shadow-(raised|sticker|pressed)|shadow\.(raised|sticker)/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
  it("square is print, round is object: only the sticker and the live dot take the round radius", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const round = [...css.matchAll(/([^{}]+)\{([^{}]*--tk-radius-sticker[^{}]*)\}/g)].map(m => m[1]!.trim());
    expect(round.sort()).toEqual([".c-sticker", ".shell-dot"]);
  });
  it("the front page renders exactly one Plate (the lead) in every state, and none when there is no lead", async () => {
    const { FrontView } = await import("@/components/read/FrontView");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 304 })));
    const busy = frontModel(input({ stories: [0, 1, 2, 3].map(i => st(`b${i}`, { happened_at: iso(NOW - (i + 1) * H) })) }));
    const steady = frontModel(input({ stories: [st("a", { happened_at: iso(NOW - 2 * H) })] }));
    const quiet = frontModel(quietInput());
    const none = frontModel(input({ stories: [] }));
    for (const [name, m] of [["busy", busy], ["steady", steady], ["quiet", quiet], ["none", none]] as const) {
      const { container, unmount } = await renderInRouter(() => <FrontView m={m} />);
      expect(container.querySelectorAll('[data-container="plate"]').length, name).toBe(m.lead ? 1 : 0);
      if (m.lead) expect(container.querySelector('[data-container="plate"] [data-container="raised"]')?.textContent, name).toContain("Receipts");
      expect(container.querySelectorAll('[data-container="slab"]').length, name).toBeGreaterThanOrEqual(3);
      unmount();
    }
    expect([busy.state, steady.state, quiet.state]).toEqual(["busy", "steady", "quiet"]);
    vi.unstubAllGlobals();
  });
});

describe("density", () => {
  it("every route file has a density; pages have a real one; the shell writes it to <html>", () => {
    const keys = walk("src/routes").filter(p => /\.tsx?$/.test(p) && !p.endsWith("__root.tsx")).map(p => p.replace(/^src\/routes\//, "").replace(/\.tsx?$/, ""));
    expect(keys.filter(k => densityOfFile(k) === undefined)).toEqual([]);
    const pages = walk("src/routes").filter(p => p.endsWith(".tsx") && !p.endsWith("__root.tsx")).map(p => p.replace(/^src\/routes\//, "").replace(/\.tsx$/, ""));
    for (const k of pages) expect(DENSITIES, k).toContain(DENSITY[k]);
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toMatch(/data-density=\{density\}/);
  });
  it("stories and reports are Quiet, the front page and indexes Steady, the terminal and kit Loud", () => {
    expect([densityOf("/stories/$id"), densityOf("/sectors/$sector"), densityOf("/brand/mark"), densityOf("/brand/")]).toEqual(["quiet", "quiet", "quiet", "quiet"]);
    expect([densityOf("/"), densityOf("/signals/"), densityOf("/data/")]).toEqual(["steady", "steady", "steady"]);
    expect([densityOf("/terminal"), densityOf("/kit"), densityOf("/library/$domain")]).toEqual(["loud", "loud", "loud"]);
    expect([routeKeyOf("/"), routeKeyOf("/data/"), routeKeyOf("/stories/no/$number")]).toEqual(["index", "data.index", "stories.no.$number"]);
    expect(densityOf("/front.json")).toBe("steady");
  });
});

describe("<Ledger>", () => {
  it("rows are links at least 44 px tall, with the number, the title, facts, tags and time in their columns", async () => {
    const { container } = await renderInRouter(() => <Ledger rows={[{ key: "a", href: "/stories/a", number: 48, title: "Title", line: "Line", facts: ["12%", "3 sites"], tags: ["Move"], time: "2 h ago" }]} />);
    const a = container.querySelector("a.ledger-link")!;
    expect(a.getAttribute("href")).toBe("/stories/a");
    expect(a.querySelector(".ledger-num .ledger-fit > span:first-child")!.textContent).toBe("48");
    expect(a.querySelector(".ledger-title")!.textContent).toContain("Title");
    expect([...a.querySelectorAll(".ledger-fact")].map(e => e.textContent)).toEqual(["12%", "3 sites"]);
    expect(a.querySelector(".ledger-time")!.textContent).toBe("2 h ago");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.ledger-link \{[^}]*min-height: var\(--tk-layout-tap\)/);
    expect(css).toMatch(/\.ledger-link:hover, \.ledger-link:focus-visible \{ background: var\(--sys-color-highlight\)/);
    expect(css).toMatch(/\.ledger \{ border-top: var\(--tk-border-hairline\)/);
  });
  it("keeps the number, the title and one fact beside each other on narrow screens; the rest wraps under the title", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.ledger-link \{ display: grid; grid-template-columns: max-content minmax\(0, 1fr\) auto;/); // S1: the list sizes the number column
    expect(css).toMatch(/\.ledger-rest \{ grid-column: 2 \/ -1;/);
  });
});
