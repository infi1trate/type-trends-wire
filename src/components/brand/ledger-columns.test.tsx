// S1 · Part 1: a list with no numbers has no number cell; a numbered list's column is as wide as its own longest number.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Ledger, StoryNo, numberColumn } from "./Ledger";

const rows = (ns: (string | number | undefined)[]) => ns.map((n, i) => ({ key: String(i), href: `/x/${i}`, title: `Row ${i}`, ...(n === undefined ? {} : { number: n }) }));

describe("S1 · the ledger's number column", () => {
  it("a ledger with no numbers renders no number cell and is marked plain", () => {
    const html = renderToStaticMarkup(<Ledger rows={rows([undefined, undefined, undefined])} />);
    expect(html).not.toContain("data-ledger-number");
    expect(html).toContain("ledger-plain");
    expect(html).not.toContain("ledger-ghost");
    expect(numberColumn(rows([undefined, undefined]))).toEqual({ numbered: false, digits: 0, story: false });
  });
  it("ranks 1 to 57 give a two-figure column on every row", () => {
    const r = rows(Array.from({ length: 57 }, (_, i) => i + 1));
    expect(numberColumn(r)).toEqual({ numbered: true, digits: 2, story: false });
    const html = renderToStaticMarkup(<Ledger rows={r} />);
    expect(html).toContain('data-ledger-digits="2"');
    expect(html.match(/<span aria-hidden="true" class="ledger-ghost">00<\/span>/g)).toHaveLength(57);
    expect(html.match(/data-ledger-number/g)).toHaveLength(57);
    expect(html).not.toContain("ledger-plain");
  });
  it("collections 1 to 5 give a one-figure column", () => expect(numberColumn(rows([1, 2, 3, 4, 5])).digits).toBe(1));
  it("story numbers given as text or as StoryNo size the figure for the longest: No. 94 is two figures, No. 100 three", () => {
    expect(numberColumn(rows(["No. 94", "No. 9"]))).toEqual({ numbered: true, digits: 2, story: true });
    expect(numberColumn([{ number: <StoryNo n={94} /> }, { number: <StoryNo n={100} /> }])).toEqual({ numbered: true, digits: 3, story: true });
    const html = renderToStaticMarkup(<Ledger rows={rows(["No. 94"])} />);
    expect(html).toContain('data-ledger-digits="2"');
    expect(html).toMatch(/class="ledger-ghost"><span data-story-number="" class="ledger-no">.*?00<\/span>/);
  });
  it("a lead (the Tape's favicon) sits inside the title before the chips; with inline chips they are not repeated below", () => {
    const html = renderToStaticMarkup(<Ledger inlineTags rows={[{ key: "a", href: "/a", lead: <i data-lead="" />, tags: ["Type"], title: "Figma changed its type", time: "21 Nov" }]} />);
    expect(html.indexOf("data-lead")).toBeLessThan(html.indexOf("ledger-tag"));
    expect(html.indexOf("ledger-tag")).toBeLessThan(html.indexOf("Figma changed"));
    expect(html.match(/class="ledger-tag"/g)).toHaveLength(1);
  });
});
