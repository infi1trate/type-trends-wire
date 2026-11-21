import { describe, expect, it } from "vitest";
import { fxInput, fxCapture } from "../data-stories/fixtures";
import { softwareStory, bigTypeStory, sectorMindsStory, mindsBrand, type Meta } from "../data-stories/stories";
import { softwareFigures } from "../data-stories/checks";
import { parseCommand } from "../taste/query";
import type { StoryModel, AdoptionFig } from "../data-stories/types";
import { figureTables } from "./figure-tables";
import { consoleHref, figureCommands, lensTable, parseStudyArgs, runStudyCommand, STUDY_VERB } from "./study-commands";

const meta = (slug: string): Meta => ({ slug, number: 9, question: "Q?", deck: "D", template: "T", collection: { label: "C", href: "/c" }, related: [] });
const i = fxInput();
const capsFor = (ds: string[]) => new Map(ds.map((d, k) => [d, [fxCapture(k * 10 + 1, "2021-02-10T00:00:00Z"), fxCapture(k * 10 + 2, "2023-02-10T00:00:00Z", { h1_size: 80 }), fxCapture(k * 10 + 3, "2026-11-14T00:00:00Z", { h1_size: 96 })]]));
const stories: StoryModel[] = [
  softwareStory(i, capsFor(softwareFigures(i).topBrands.map(b => b.domain)), meta("software")),
  bigTypeStory(i, new Map(), meta("big")),
  sectorMindsStory(i, capsFor([mindsBrand(i)!]), meta("minds")),
];
/** What the console does with a typed line: split the verb off, then run. */
const runLine = (s: StoryModel, line: string) => { const { verb, args } = parseCommand(line); expect(verb).toBe(STUDY_VERB); return runStudyCommand(s, parseStudyArgs(args)!); };

describe("U4 · every study figure table has a console command that reproduces it", () => {
  for (const s of stories) {
    const cmds = figureCommands(s);
    it(`${s.slug}: one command per figure table`, () => {
      expect(cmds.length).toBe(Object.values(s.figures).reduce((n, f) => n + figureTables(f).length, 0));
      expect(new Set(cmds.map(c => c.command)).size).toBe(cmds.length);
    });
    for (const c of cmds) it(`${s.slug}: "${c.command}" prints the figure's table exactly`, () => {
      const out = runLine(s, c.command);
      if (out.kind !== "table") throw new Error(out.kind);
      const want = figureTables(s.figures[c.figure]!)[c.n - 1]!;
      expect({ caption: out.table.caption, head: out.table.head, rows: out.table.rows }).toEqual(want);
      expect(out.table.lens).toBeNull();
    });
  }
  it("without a figure it lists the study's commands; unknown studies, figures and tables explain themselves", () => {
    const s = stories[0]!;
    const list = runLine(s, `study ${s.slug}`);
    expect(list.kind === "list" && list.commands.length).toBe(figureCommands(s).length);
    expect(runStudyCommand(null, parseStudyArgs(["nope"])!)).toEqual({ kind: "error", error: 'No live study "nope". The studies are listed at /data.' });
    expect(runLine(s, `study ${s.slug} nofig`).kind).toBe("error");
    const [id] = Object.keys(s.figures);
    expect(runLine(s, `study ${s.slug} ${id} 99`).kind).toBe("error");
  });
  it("parses the table number and the sector lens", () => {
    expect(parseStudyArgs(["big", "adoption", "2", "sector=fintech"])).toEqual({ slug: "big", figure: "adoption", n: 2, sector: "fintech" });
    expect(parseStudyArgs(["big", "sector=all"])).toEqual({ slug: "big", figure: null, n: 1, sector: null });
    expect(parseStudyArgs([])).toBeNull();
    expect(consoleHref("study big adoption 2", "fintech")).toBe("/terminal?panel=console&cmd=study%20big%20adoption%202%20sector%3Dfintech");
  });
});

describe("U4 · the sector lens on study tables", () => {
  const fig: AdoptionFig = { kind: "adoption", title: "Big type", note: "", signal: { key: "k", name: "Big type", href: "/s" }, quarters: ["2026Q3"], share: [{ x: "2026Q3", y: 0.4 }],
    adopters: [{ domain: "a.com", name: "A", sector: "fintech", first: "2026Q3", firstAt: "2026-08-01", censored: false, dropped: false, href: "/b/a" }, { domain: "b.com", name: "B", sector: "ai", first: "2026Q3", firstAt: "2026-08-01", censored: false, dropped: false, href: "/b/b" }], never: 0, total: 2 };
  const [share, adopters] = figureTables(fig);
  it("narrows the adopter rows to the sector and leaves the share table whole with a note", () => {
    const t = lensTable(fig, adopters!, 1, "fintech");
    expect(t.rows.map(r => r[0])).toEqual(["A"]);
    expect(t.lens).toMatch(/only$/);
    expect(lensTable(fig, share!, 0, "fintech")).toMatchObject({ rows: share!.rows, lens: "Not by sector: every row shown" });
  });
  it("All sectors changes nothing", () => { expect(lensTable(fig, adopters!, 1, null)).toEqual({ ...adopters, lens: null }); });
});
