// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { issueModel, archiveEntries, splitSentences } from "./issue";
import { issueNumber, weekRange } from "./week";
import { label } from "../labels";
import { fixture, quietFixture, CARD } from "./__fixtures__/issue-w46";
import { IssueView } from "@/components/digest/IssueView";
import type { Issue } from "./issue";

const TICKER = /\$[A-Z][A-Z0-9-]+/;
async function render(issue: Issue) {
  const root = createRootRoute({ component: () => createElement(IssueView, { issue }) });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(createElement(RouterProvider, { router } as never));
}

describe("issue numbering and dates", () => {
  it("No. 1 is 2026-W46 (Mon 9 – Sun 15 November 2026); earlier weeks have no issue", () => {
    expect(issueNumber("2026-W46")).toBe(1);
    expect(issueNumber("2026-W47")).toBe(2);
    expect(issueNumber("2026-W53")).toBe(8); // 2026 has 53 ISO weeks
    expect(issueNumber("2027-W01")).toBe(9);
    expect(issueNumber("2026-W45")).toBeNull();
    expect(issueNumber("2026-W99")).toBeNull();
    expect(weekRange("2026-W46")).toMatchObject({ start: "2026-11-09", end: "2026-11-15", label: "9–15 November 2026" });
  });
});

describe("issueModel", () => {
  const issue = issueModel(fixture())!;
  it("assembles every section that has data, in reading order", () => {
    expect(issue.sections).toEqual(["cover", "movers", "specimens", "palette", "wild", "rebrands", "numbers"]);
    expect(issue).toMatchObject({ name: "The Digest", number: 1, dataThrough: "Q4 2026", runId: 13 });
  });
  it("omits sections without real data instead of padding", () => {
    const q = issueModel(quietFixture())!;
    expect(q.sections).toEqual(["cover", "numbers"]);
    expect([q.movers, q.specimens, q.palette, q.wild, q.rebrands]).toEqual([null, null, null, null, null]);
    expect(q.numbers.map(n => n.label)).toEqual(["Stories on the wire", "Breakout alerts"]);
  });
  it("returns no issue without a brief or before No. 1", () => {
    expect(issueModel({ ...fixture(), brief: null })).toBeNull();
    expect(issueModel({ ...fixture(), week: "2026-W40" })).toBeNull();
  });
  it("cover: brief headline, standfirst from the brief's own opening (decimals kept), lead signal named by labels.ts", () => {
    expect(issue.cover.headline).toBe("Subgrid Momentum, Dropbox Pivots, and the End of Maximalism");
    expect(issue.cover.standfirst).toBe("Subgrid usage is accelerating, gaining 4.84 momentum points per quarter. Variable fonts are also accelerating.");
    expect(issue.cover.body[0]!.body).toBe("Subgrid layouts [LAYOUT] leads the layout desk.");
    expect(issue.cover.lead).toMatchObject({ key: "css:subgrid", name: label("css:subgrid").name, dimension: "LAYOUT", stage: "Rising", href: "/signals/css%3Asubgrid" });
    expect(issue.cover.why).toBe("For page structure and component choices: at 26% of tracked homepages and gaining 4.8 points a quarter, this signal is past the experiment stage and spreading, so it belongs in briefs and templates now.");
    expect(issue.cover.body[1]!.citations).toEqual([{ text: "EVENT · dropbox.com · message_pivot", href: "/library/dropbox.com" }]);
  });
  it("uses stored standfirst and why-it-matters copy from the brief step when present", () => {
    const b = fixture(); b.brief = { ...b.brief!, standfirst: "Grids get smarter.", why_it_matters: "Layouts are where briefs start." };
    const i = issueModel(b)!;
    expect(i.cover.standfirst).toBe("Grids get smarter.");
    expect(i.cover.why).toBe("Layouts are where briefs start.");
    expect(i.cover.body[0]!.body.startsWith("Subgrid usage")).toBe(true);
  });
  it("movers: breakouts first (with sector scope), then stage changes from the previous run", () => {
    expect(issue.movers!.map(m => [m.key, m.scope, m.breakout, m.change])).toEqual([
      ["css:subgrid", "all", true, "broke out and moved from Steady to Rising"],
      ["components:bento_grid", "fintech", true, "broke out in fintech; its stage there is Steady"],
      ["aesthetic:maximalist", "all", false, "moved from Peaking to Fading"],
    ]);
    expect(issue.movers![1]!.sentence).toBe("On 21% of tracked fintech homepages, gaining 2.3 points a quarter, across 20 sites in the latest sample.");
  });
  it("specimens: only top-500 Google Fonts climbs (no barcode/icon faces); proprietary faces are named, not loaded", () => {
    expect(issue.specimens!.rising.map(s => s.family)).toEqual(["Instrument Serif"]);
    expect(issue.specimens!.fading.map(s => s.family)).toEqual(["Roboto Slab"]);
    expect(issue.specimens!.seen).toEqual([
      expect.objectContaining({ family: "Apris", google: false, note: "Proprietary face, shown by name." }),
      expect.objectContaining({ family: "Inter", google: true, note: null }),
    ]);
  });
  it("palette: named swatches with hexes, accents first", () => {
    expect(issue.palette![0]).toMatchObject({ domain: "ragged-edge.com", kind: "accent", before: [{ hex: "#1C4673" }], after: [{ hex: "#067D8C" }] });
    expect(issue.palette![0]!.before[0]!.name).not.toMatch(/^#/);
    expect(issue.palette![1]!.kind).toBe("palette");
  });
  it("seen in the wild: library sites only, typographic card when no thumbnail is stored", () => {
    expect(issue.wild!.map(w => w.domain)).toEqual(["tailwindcss.com", "vercel.com", "linear.app"]);
    expect(issue.wild!.every(w => w.thumb === null)).toBe(true);
    const withThumb = issueModel({ ...fixture(), thumbs: [{ domain: "vercel.com", captured_at: "2026-11-14T08:00:00Z", viewport: "desktop", path: "vercel.com/2026-11-14-desktop.webp", width: 1280, height: 800, bytes: 90000, variants: [{ w: 640, h: 400, bytes: 30000, path: "vercel.com/2026-11-14-desktop-640w.webp" }] }] })!;
    expect(withThumb.wild!.find(w => w.domain === "vercel.com")!.thumb).toMatchObject({ caption: "vercel.com · captured 2026-11-14", alt: "vercel.com homepage, captured 2026-11-14", src: "/thumbs/vercel.com/2026-11-14-desktop.webp" });
  });
  it("hides the corrections line while CONTACT_EMAIL is empty", () => { expect(issue.footer.contact).toBeNull(); });
  it("no $TICKER survives anywhere in the model", () => { expect(JSON.stringify(issue)).not.toMatch(TICKER); });
  it("rendered issue has no $TICKER, real article markup and the typographic fallback", async () => {
    const html = await render(issue);
    expect(html).not.toMatch(TICKER);
    expect(html).toContain("<article");
    expect(html).toContain("The Movers");
    expect(html).toContain('class="ed-typo"');
    expect(html).toContain("Subgrid layouts");
    expect(html).not.toContain("Spotted an error?");
  });
  it("splits sentences without breaking decimals", () => {
    expect(splitSentences("Up 4.84 points. Next one.")).toEqual(["Up 4.84 points.", "Next one."]);
  });
  it("archive entries list issues newest first with the lead signal name", () => {
    expect(archiveEntries([{ week: "2026-W46", headline: "A $SUBGRID week", card: CARD }, { week: "2026-W47", headline: "B", card: null }, { week: "2026-W44", headline: "too early", card: null }]))
      .toEqual([expect.objectContaining({ week: "2026-W47", number: 2, lead: null }), expect.objectContaining({ week: "2026-W46", number: 1, headline: "A Subgrid layouts [LAYOUT] week", lead: { name: "Subgrid layouts", dimension: "LAYOUT" } })]);
  });
});
