// Phase E3 · the front page and the navigation, with the three corrections that open it (sale wording, exact quotations, how a census
// is read). Concrete values come from the owner's brief.
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderInRouter } from "@/test/router-harness";
import { promoSignal, saleSignal } from "@/lib/promo";
import { saleCensus, CENSUS_HOW, type CensusCapture, type CensusPair } from "@/lib/census";
import { noDollar } from "@/lib/stories/candidates";
import { storyHowWeKnow } from "@/lib/stories/texts";
import { MORE_MENU, READ_BAR, SECTIONS } from "@/lib/ia";
import { barAt } from "@/lib/shell";
import { frontModel, exploreSide } from "@/lib/front/front";
import { frontTape, FRONT_TAPE_MAX } from "@/lib/front/tape-block";
import type { Check } from "@/lib/integrity";
import { D, H, NOW, input, iso, st } from "@/lib/front/fixtures";
import { ReadShell } from "./ReadShell";
import { AlsoCards, FrontView } from "./FrontView";

const cap = (id: number, domain: string, at: string, h1: string, ctas: string[] = []): CensusCapture => ({ id, domain, at, source: "h1", h1, ctas });
const pair = (domain: string, h1: string): CensusPair => ({ domain, newest: cap(2, domain, "2026-11-20T12:00:00Z", h1), older: cap(1, domain, "2026-11-20T02:00:00Z", h1) });

describe("E3 · part 0: sale mode means a sale", () => {
  it("On's “However you holiday, move.” is seasonal, not a sale: it never counts for sale mode", () => {
    expect(saleSignal("However you holiday, move.")).toBeNull();
    expect(promoSignal("However you holiday, move.")).toBe("holiday"); // the Seasonal tape mark keeps its wider meaning
    const c = saleCensus(new Map([["on.com", pair("on.com", "However you holiday, move.")]]));
    expect([c.base, c.members.map(m => m.domain)]).toEqual([1, []]);
  });
  it("a line with “% off” counts, and so does an amount off", () => {
    expect(saleSignal("Take 20% off everything")).toBe("% off");
    expect(saleSignal("Up to $1,300 off Peloton equipment*")).toBe("<currency amount> off");
    const c = saleCensus(new Map([["a.com", pair("a.com", "Take 20% off everything")], ["on.com", pair("on.com", "However you holiday, move.")]]));
    expect(c.members.map(m => m.domain)).toEqual(["a.com"]);
  });
  it("seasonal words alone are not a sale; the sale words are", () => {
    for (const t of ["Gifts for the season", "Holiday gift guide", "Happy holidays"]) expect(saleSignal(t), t).toBeNull();
    for (const t of ["Black Friday is here", "Cyber Monday deals", "The winter sale", "Save $50 today", "Save 30% on plans", "Members get a discount"]) expect(saleSignal(t), t).not.toBeNull();
  });
});

describe("E3 · part 0: a quotation is exact", () => {
  it("a quoted “$1,300” is shown unchanged", () => {
    expect(noDollar("Peloton · “Up to $1,300 off Peloton equipment*”")).toBe("Peloton · “Up to $1,300 off Peloton equipment*”");
  });
  it("our own sentence still writes currency the house way", () => {
    expect(noDollar("From $20 a month")).toBe("From USD 20 a month");
    expect(noDollar("Prices from $20, headline “Now $15”")).toBe("Prices from USD 20, headline “Now $15”");
  });
});

describe("E3 · part 0: how a census is read", () => {
  it("says the newest capture and one at least six hours older (sale mode: headline and buttons), over older written wording", () => {
    expect(CENSUS_HOW.words).toBe("Read from each homepage's headline in our newest capture and one at least six hours older.");
    expect(CENSUS_HOW.sale).toBe("Read from each homepage's headline and buttons in our newest capture and one at least six hours older.");
    const base = { type: "roundup", basis: "measured", kicker: "Census", happened_at: "2026-11-20T17:00:00Z", facts: [], written: { headline: "h", deck: "d", body: [], howWeKnow: "Read from each homepage's headline in our two most recent captures.", model: "m", version: 1, at: "2026-11-20T17:00:00Z" } };
    expect(storyHowWeKnow({ ...base, id: "census:agents:2026-W47" })).toBe(CENSUS_HOW.words);
    expect(storyHowWeKnow({ ...base, id: "census:sale:2026-W47" })).toBe(CENSUS_HOW.sale);
  });
});

describe("E3 · part 1: navigation", () => {
  const BAR = ["Today", "Signals", "Brands", "Patterns", "Studies", "Digest"], MORE = ["Tools", "Glossary", "What makes a story", "What we show and why", "RSS"];
  it("the bar's items and order; More holds Tools, Glossary, the two explainers and RSS; / is Today", () => {
    // U3: Tools joins the bar as the seventh section (from 1024 px); below that it stays under More.
    expect(READ_BAR.map(b => b.label)).toEqual([...BAR, "Tools"]);
    expect(MORE_MENU.map(m => m.label)).toEqual(MORE);
    expect(READ_BAR[0]).toEqual({ id: "today", label: "Today", href: "/" });
    expect(SECTIONS[0]!.label).toBe("Today");
  });
  it("at 1440 the bar shows the items then More; in the narrow menu the same items in the same order; Glossary is only in More", async () => {
    const r = await renderInRouter(() => createElement(ReadShell, { label: "Today", children: createElement("p", null, "x") }), "/");
    const [bar, sheet] = [...r.container.querySelectorAll('nav[aria-label="Sections"]')] as HTMLElement[];
    const items = (el: Element | null | undefined) => [...(el?.querySelectorAll(":scope > ul > li > a, :scope > ul > li > button, :scope > ul > li > div > button") ?? [])].map(x => x.textContent!.replace(/[▾▴]/g, "").trim());
    expect(bar!.className).toContain("max-lg:hidden"); expect(sheet!.className).toContain("lg:hidden");
    expect(items(bar)).toEqual([...BAR, "Tools", "More"]);
    expect([...bar!.querySelectorAll("#shell-more li")].map(x => x.textContent!.trim())).toEqual(MORE.filter(m => m !== "Tools"));
    expect([...sheet!.querySelectorAll("li")].map(x => x.textContent!.trim())).toEqual([...BAR, ...MORE]);
    expect(bar!.querySelector('a[aria-current="page"]')!.textContent).toBe("Today");
    const glossaries = [...r.container.querySelectorAll("header button")].filter(b => b.textContent === "Glossary");
    expect(glossaries.every(b => b.closest("#shell-more, #shell-sheet"))).toBe(true);
    expect(barAt(1440)).toEqual({ inline: ["sections", "switch", "lock"], menu: [], menuButton: false });
    expect(barAt(360).menu).toContain("sections");
  });
  it("every old address still answers (each bar and More address has its page)", () => {
    const file: Record<string, string> = { "/": "index.tsx", "/signals": "signals.index.tsx", "/brands": "brands.index.tsx", "/patterns": "patterns.index.tsx", "/data": "data.index.tsx", "/digest": "digest.index.tsx",
      "/tools": "tools.tsx", "/what-we-show": "what-we-show.tsx", "/morning/rss.xml": "morning.rss[.]xml.ts", "/terminal": "terminal.tsx", "/morning": "morning.index.tsx", "/digest/rss.xml": "digest.rss[.]xml.ts" };
    for (const h of [...READ_BAR.map(b => b.href), ...MORE_MENU.flatMap(m => (m.href ? [m.href.split("#")[0]!] : [])), ...SECTIONS.map(s => s.read), "/terminal", "/morning", "/digest/rss.xml"]) {
      expect(file[h], h).toBeDefined(); expect(existsSync(`src/routes/${file[h]}`), h).toBe(true);
    }
  });
});

const today = (k: number) => iso(NOW - (k + 1) * H); // NOW is 14:00 UTC: k < 13 stays on the same UTC day
describe("E3 · part 2: the front page", () => {
  it("with five stories today the lead takes one and Also today four; none of them repeats in the list below", () => {
    const stories = [0, 1, 2, 3, 4].map(k => st(`s${k}`, { score: 60 + k, happened_at: today(k), number: 80 + k })).concat([st("old", { happened_at: iso(NOW - 2 * D) })]);
    const m = frontModel(input({ stories }));
    expect(m.lead?.story.id).toBe("s4");
    expect(m.also.map(a => a.id)).toEqual(["s3", "s2", "s1", "s0"]);
    expect(m.column.items.map(i => i.id)).toEqual(["old"]);
  });
  it("with one story today Also today is not drawn", async () => {
    const m = frontModel(input({ stories: [st("only", { happened_at: today(1) }), st("old", { happened_at: iso(NOW - 2 * D) })] }));
    expect([m.also.length, m.sections.also]).toEqual([0, false]);
    const r = await renderInRouter(() => createElement(FrontView, { m }), "/");
    expect(r.container.querySelector("[data-front-also]")).toBeNull();
  });
  it("a census card shows its count large above the headline; a card without a picture has no frame", async () => {
    const census = st("census:agents:2026-W47", { type: "roundup", headline: "Sixteen tracked homepages have ‘agents’ in the headline", happened_at: today(2), score: 40,
      facts: [{ text: "16 of 162 tracked homepages whose headline we can read", href: "/brands", basis: "measured", kind: "count" }] as never });
    const m = frontModel(input({ stories: [st("lead", { score: 90, happened_at: today(1), domains: ["netlify.com"] }), census] }));
    expect(m.lead?.story.id).toBe("lead");
    const card = m.also.find(a => a.id === census.id)!;
    expect(card.count).toBe("16 of 162");
    const r = await renderInRouter(() => createElement(AlsoCards, { items: m.also, pictures: {} }), "/");
    const el = r.container.querySelector("[data-also-card]")!;
    expect(el.querySelector("[data-census-count]")!.textContent).toBe("16 of 162");
    expect(el.querySelector("[data-census-count]")!.compareDocumentPosition(el.querySelector("h3")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector("[data-also-picture], img")).toBeNull();
  });
  it("the tape shows eight confirmed lines and no unconfirmed one, and counts both", () => {
    const pass = (f: string): Check => ({ verdict: "pass", pass: [f], fields: { [f]: { verdict: "pass", failed: [], before: 2, after: 2, beforeHours: 12, afterHours: 12, transitions: 1, lastBefore: iso(NOW - 3 * D), firstAfter: iso(NOW - 2 * D) } } });
    const fail = (f: string): Check => ({ verdict: "seen_once", pass: [], fields: { [f]: { verdict: "seen_once", failed: ["two_after"], before: 2, after: 1, beforeHours: 12, afterHours: 0, transitions: 1 } } });
    const ev = (id: number, h: number) => ({ id, domain: `b${id}.com`, type: "theme_flip", before: { theme: "light" }, after: { theme: "dark" }, detected_at: iso(NOW - h * H), page_type: "home", summary: null, source: "live" });
    const events = [...Array.from({ length: 10 }, (_, i) => ev(i + 1, i + 1)), ev(50, 0.5), ev(51, 0.7)];
    const checks = new Map<number, Check>([...Array.from({ length: 10 }, (_, i) => [i + 1, pass("theme")] as const), [50, fail("theme")], [51, fail("theme")]]);
    const t = frontTape(events, checks, { now: NOW, labels: e => ({ seasonal: e.id === 1 }) });
    expect(t.lines).toHaveLength(FRONT_TAPE_MAX);
    expect(t.lines.map(l => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(t.lines.some(l => l.id === 50 || l.id === 51)).toBe(false);
    expect([t.confirmed, t.unconfirmed]).toEqual([10, 2]);
    expect(t.lines[0]).toMatchObject({ what: "theme, light to dark", when: "between 13 and 14 Nov", marks: ["Seasonal"], href: "/brands/b1.com" });
  });
  it("Moving now is absent without a week-over-week comparison and back with one", async () => {
    const stories = [st("a", { happened_at: today(1) })];
    const none = frontModel(input({ stories }));
    expect(none.moving).toBeNull();
    const r = await renderInRouter(() => createElement(FrontView, { m: none }), "/");
    expect(r.container.textContent).not.toContain("Moving now");
    const pair = { latest: { id: 9, at: iso(NOW - D) }, earlier: { id: 8, at: iso(NOW - 8 * D) }, days: 7 };
    expect(frontModel(input({ stories, moving: { items: [], pair, next: null } })).moving?.comparison).toContain("Between forecast run 8 and run 9");
  });
  it("Explore lists at most five rows, never two for one story, preferring a brand with a story of its own", () => {
    const stories = [
      st("gathered", { type: "roundup", domains: ["a.com", "b.com", "c.com"], happened_at: today(1) }),
      st("own-b", { domains: ["b.com"], happened_at: today(2) }),
      ...[3, 4, 5, 6, 7].map(k => st(`s${k}`, { domains: [`x${k}.com`, `y${k}.com`], happened_at: today(k) })),
    ];
    const rows = exploreSide(stories, NOW, new Set(), new Map());
    expect(rows.length).toBe(5);
    expect(new Set(rows.map(r => r.story)).size).toBe(rows.length);
    // The gathered story lists b.com (it has a story of its own), not its first member a.com; b.com's own story then adds no second row.
    expect(rows[0]).toMatchObject({ story: "gathered", key: "b.com" });
    expect(rows.map(r => r.story)).toEqual(["gathered", "s3", "s4", "s5", "s6"]);
    expect(new Set(rows.map(r => r.key)).size).toBe(5);
  });
  it("no Page state text on the Read side", async () => {
    const m = frontModel(input({ stories: [0, 1, 2].map(k => st(`s${k}`, { happened_at: today(k) })) }));
    expect(m.state).toBe("busy");
    const r = await renderInRouter(() => createElement(FrontView, { m }), "/");
    expect(r.container.textContent).not.toMatch(/Page state|Busy|Three or more stories in the last six hours/);
  });
});
