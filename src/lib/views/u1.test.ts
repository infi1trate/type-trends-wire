// U1 + U2 · one address per thing, two views; receipts in place; every data row leads back; one name per thing.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { canonicalHref, dataHref, isDataView, modeOf, movedObjectHref, objectOf, readHref, terminalObjectHref, toggleHref, SECTIONS, READ_BAR, TABS } from "../ia";
import { parseReceipt, receiptFor, shareReceipt, changeReceipt, changedFields, storyReceipt, censusReceipt, forecastReceipt, figureReceipt, tableCsv } from "./receipts";
import { storyForRow, storyLookup } from "./story-rows";
import { dataViewHead } from "./head";
import { viewSearch, brandDataSearch } from "./search";
import { briefMovers } from "./week";
import { figureTables } from "./figure-tables";
import { VIEW_ROUTE_FILES } from "../theme/route-mode";

describe("old addresses redirect to the one address, keeping every other parameter", () => {
  it("/library/<domain> → the brand's Data view, with and without a sector", () => {
    expect(movedObjectHref("/library/coinbase.com", {})).toBe("/brands/coinbase.com?view=data");
    expect(movedObjectHref("/library/coinbase.com", { sector: "fintech", viewport: "mobile" })).toBe("/brands/coinbase.com?sector=fintech&viewport=mobile&view=data");
  });
  it("a terminal story → the story's Data view", () => {
    expect(movedObjectHref("/terminal", { panel: "today", story: "brand:coinbase.com:2026-11-20" })).toBe("/stories/brand%3Acoinbase.com%3A2026-11-20?view=data");
    expect(movedObjectHref("/terminal", { panel: "today", story: "x:1", sector: "fintech" })).toBe("/stories/x%3A1?sector=fintech&view=data");
  });
  it("a terminal signal and pattern → their Data views", () => {
    expect(movedObjectHref("/terminal", { panel: "brief", trait: "css:subgrid" })).toBe("/signals/css%3Asubgrid?view=data");
    expect(movedObjectHref("/terminal", { panel: "brief", trait: "css:subgrid", sector: "fintech" })).toBe("/signals/css%3Asubgrid?sector=fintech&view=data");
    expect(movedObjectHref("/terminal", { panel: "patterns", trait: "layout:bento" })).toBe("/patterns/layout%3Abento?view=data");
    expect(movedObjectHref("/terminal", { panel: "patterns", trait: "layout:bento", sector: "fintech" })).toBe("/patterns/layout%3Abento?sector=fintech&view=data");
  });
  it("old /?panel= object links and aliases go through to the new address", () => {
    expect(movedObjectHref("/", { panel: "forecast", trait: "css:subgrid" })).toBe("/signals/css%3Asubgrid?view=data");
    expect(terminalObjectHref({ panel: "brief", trait: "css:subgrid", q: "", sort: "domain", desc: false, page: 0 })).toBe("/signals/css%3Asubgrid?view=data");
  });
  it("section views and other addresses do not move", () => {
    expect(movedObjectHref("/terminal", { panel: "brief" })).toBeNull();
    expect(movedObjectHref("/terminal", { panel: "library" })).toBeNull();
    expect(movedObjectHref("/brands/coinbase.com", {})).toBeNull();
    expect(movedObjectHref("/", {})).toBeNull();
  });
  it("stored links render in their one-address form", () => {
    expect(canonicalHref("/library/coinbase.com")).toBe("/brands/coinbase.com?view=data");
    expect(canonicalHref("/terminal?panel=brief&trait=css:subgrid")).toBe("/signals/css%3Asubgrid?view=data");
    expect(canonicalHref("/brands/coinbase.com")).toBe("/brands/coinbase.com");
    expect(canonicalHref("https://example.com/library/x")).toBe("https://example.com/library/x");
  });
});

describe("toggleHref and modeOf: an object's other mode is the same path with view=data added or removed", () => {
  const cases = [["/stories/x%3A1", "story"], ["/brands/coinbase.com", "brand"], ["/signals/css%3Asubgrid", "signal"], ["/patterns/layout%3Abento", "pattern"], ["/data/who-went-big-first", "study"], ["/digest/2026-W46", "week"]] as const;
  for (const [path, type] of cases) it(type, () => {
    expect(objectOf(path)?.type).toBe(type);
    expect(modeOf(path, {})).toBe("read");
    expect(modeOf(path, { view: "data" })).toBe("terminal");
    expect(isDataView(path, { view: "data" })).toBe(true);
    expect(toggleHref(path, {})).toBe(`${path}?view=data`);
    expect(toggleHref(path, { sector: "fintech" })).toBe(`${path}?sector=fintech&view=data`);
    expect(toggleHref(path, { view: "data" })).toBe(path);
    expect(toggleHref(path, { view: "data", sector: "fintech" })).toBe(`${path}?sector=fintech`);
  });
  it("Data-only params and an open receipt drop on the way back to Read", () => {
    expect(readHref({ type: "brand", id: "coinbase.com" }, { view: "data", a: "1", b: "2", viewport: "mobile", sector: "fintech" })).toBe("/brands/coinbase.com?sector=fintech");
    expect(dataHref({ type: "signal", id: "css:subgrid" }, { receipt: "share:css:subgrid" })).toBe("/signals/css%3Asubgrid?view=data");
  });
  it("section pages keep today's mapping", () => {
    expect(toggleHref("/signals", {})).toBe("/terminal?panel=overview");
    expect(toggleHref("/brands", { tab: "moves" })).toBe("/terminal?panel=rebrands");
    expect(objectOf("/signals/leading")).toBeNull();
    expect(objectOf("/digest/archive")).toBeNull();
    expect(objectOf("/stories/no/88")).toBeNull();
  });
});

describe("Data views are noindex with a canonical to the Read address", () => {
  it("dataViewHead", () => {
    const h = dataViewHead({ type: "brand", id: "coinbase.com" }, "Coinbase");
    expect(h.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(h.links).toEqual([{ rel: "canonical", href: "https://slug.global/brands/coinbase.com" }]);
    expect(h.meta.some(m => "property" in m && m.property === "og:image")).toBe(false);
  });
  it("every object route renders its Data view through dataViewHead and declares views", () => {
    for (const f of VIEW_ROUTE_FILES) { const src = readFileSync(`src/routes/${f}`, "utf8"); expect(src, f).toMatch(/dataViewHead\(/); expect(src, f).toMatch(/views: true/); expect(src, f).toMatch(/DATA_VIEW_HEADERS/); }
  });
  it("search keeps view and receipt; brand compare params only in the Data view", () => {
    expect(viewSearch({ view: "data", receipt: "share:css:subgrid", x: 1 })).toEqual({ view: "data", receipt: "share:css:subgrid" });
    expect(viewSearch({ view: "read" })).toEqual({});
    expect(brandDataSearch({ viewport: "mobile", a: 12, b: "x".repeat(80) })).toEqual({ viewport: "mobile", a: "12" });
  });
});

describe("receipts", () => {
  it("parseReceipt accepts the six types and refuses junk", () => {
    expect(parseReceipt("share:css:subgrid")).toEqual({ type: "share", id: "css:subgrid" });
    expect(parseReceipt("change:4811")).toEqual({ type: "change", id: "4811" });
    expect(parseReceipt("figure:who-went-big-first:adoption")).toEqual({ type: "figure", id: "who-went-big-first:adoption" });
    expect(parseReceipt("change:abc")).toBeNull();
    expect(parseReceipt("nope:1")).toBeNull();
    expect(parseReceipt(42)).toBeNull();
  });
  it("receiptFor: a story fact opens its single change, else the story's changes; census lines; signals; forecasts", () => {
    expect(receiptFor("/library/coinbase.com", { story: { id: "s", census: false, eventIds: [7] } })).toEqual({ type: "change", id: "7" });
    expect(receiptFor("/brands/coinbase.com", { story: { id: "s", census: false, eventIds: [7, 8] } })).toEqual({ type: "story", id: "s" });
    expect(receiptFor("/brands/x", { story: { id: "census:w", census: true, eventIds: [] } })).toEqual({ type: "census", id: "census:w" });
    expect(receiptFor("/signals/css%3Asubgrid")).toEqual({ type: "share", id: "css:subgrid" });
    expect(receiptFor("/terminal?panel=brief&trait=css:subgrid")).toEqual({ type: "forecast", id: "css:subgrid" });
    expect(receiptFor("/stories/census%3A2026-W47")).toEqual({ type: "census", id: "census:2026-W47" });
    expect(receiptFor("/brands")).toBeNull();
    expect(receiptFor("/signals/leading")).toBeNull();
    expect(receiptFor("https://example.com")).toBeNull();
  });
  it("share: chart and table with N, coverage and basis", () => {
    const m = shareReceipt("css:subgrid", "measured", [{ q: "2026Q3", s: 0.2, n: 10, c: 0.1 }, { q: "2026Q4", s: 0.26, n: 300, c: 1 }]);
    expect(m.basis).toBe("measured");
    expect(m.lines[0]).toBe("Latest well-covered quarter 2026Q4: 26.0% of N = 300 homepages (coverage 100%).");
    expect(m.tables[0]!.rows).toEqual([["2026Q3", "20.0%", "10", "10%", "no"], ["2026Q4", "26.0%", "300", "100%", "yes"]]);
    expect(m.chart!.points.map(p => p.usable)).toEqual([false, true]);
    expect(m.full).toBe("/signals/css%3Asubgrid?view=data");
    expect(shareReceipt("tone:x", "ai", []).lines[2]).toMatch(/estimate/);
  });
  it("change: captures either side, the fields that differ", () => {
    expect(changedFields({ a: 1, b: "x" }, { a: 1, b: "y", c: true })).toEqual([{ field: "b", before: "x", after: "y" }, { field: "c", before: "–", after: "true" }]);
    const m = changeReceipt({ id: 5, domain: "coinbase.com", type: "layout_change", before: { hero_media: "video" }, after: { hero_media: "image" }, detected_at: "2026-11-20T10:00:00Z", effective_at: "2026-11-14T00:00:00Z", page_type: "home", viewport: "desktop", snapshot_id: 2, prev_snapshot_id: 1, summary: null },
      [{ id: 1, captured_at: "2026-11-11T00:00:00Z", source: "live" }, { id: 2, captured_at: "2026-11-14T00:00:00Z", source: "live" }]);
    expect(m.tables[0]!.rows).toEqual([["Before", "2026-11-11", "live", "1"], ["After", "2026-11-14", "live", "2"]]);
    expect(m.tables[1]!.rows).toEqual([["hero_media", "video", "image"]]);
    expect(m.full).toBe("/brands/coinbase.com?view=data&page_type=home&viewport=desktop&a=2&b=1");
  });
  it("story: its changes list and facts", () => {
    const m = storyReceipt({ id: "s", number: 88, headline: "H", kicker: "Move" }, [{ id: 1, text: "Coinbase · hero", at: "2026-11-20T00:00:00Z", confirmed: true }, { id: 2, text: "x", at: null, confirmed: false }], [{ text: "Fact", basis: "ai" }]);
    expect(m.kicker).toBe("NO. 88 · MOVE · THE CHANGES");
    expect(m.lines[0]).toBe("2 changes behind this story; 1 confirmed on a second capture.");
    expect(m.tables.map(t => t.caption)).toEqual(["The changes", "The facts it states"]);
    expect(m.full).toBe("/stories/s?view=data");
  });
  it("census: its lines", () => {
    const m = censusReceipt({ id: "census:w", number: 90, headline: "Sale mode" }, ["Equinox: sale", "Netlify: sale"], []);
    expect(m.tables).toHaveLength(1);
    expect(m.tables[0]!.rows).toEqual([["Equinox: sale"], ["Netlify: sale"]]);
  });
  it("forecast: stage, momentum and the projection range", () => {
    const m = forecastReceipt("css:subgrid", { stage: "rising", momentum: 4.84, next_wave_score: 1.41, current_share: 0.26, status: "ok", model: "logistic", computed_at: "2026-11-20T00:00:00Z", run_id: 9, proj_q1: 0.3, proj_q1_lo: 0.28, proj_q1_hi: 0.32, proj_q2: null, proj_q2_lo: null, proj_q2_hi: null, proj_q4: null, proj_q4_lo: null, proj_q4_hi: null, backtest: { status: "ok", mae_pts: 24.5, hit_rate: 1 } });
    expect(m.lines[0]).toBe("Stage rising · momentum +4.84 pts a quarter · next-wave score 1.41.");
    expect(m.lines[2]).toBe("Backtest: mean error 24.5 pts, hit rate 100%.");
    expect(m.tables[0]!.rows[1]).toEqual(["+1 quarter", "30.0%", "28.0%", "32.0%"]);
  });
  it("figure: the study figure's table, linking to the study's Data view", () => {
    const tables = figureTables({ kind: "drift", title: "Palette drift", note: "", scope: "fintech", bands: [{ q: "2024Q1", brands: 15, swatches: [{ hex: "#000000" }] }] } as never);
    expect(tables[0]!.rows).toEqual([["Q1 2024", "15", "#000000"]]);
    const m = figureReceipt({ slug: "where-did-fintechs-colour-go", number: 3, headline: "H" }, "drift", tables);
    expect(m.full).toBe("/data/where-did-fintechs-colour-go?view=data#fig-drift");
  });
  it("CSV quotes commas and quotes", () => {
    expect(tableCsv({ head: ["a", "b"], rows: [["1,2", 'say "hi"']] })).toBe('a,b\r\n"1,2","say ""hi"""\r\n');
  });
});

describe("storyForRow: every data row leads back to its story", () => {
  const rows = [
    { id: "old", number: 40, happenedAt: "2026-11-01T00:00:00Z", domains: ["a.com"], mainSignal: "css:subgrid", events: [1], captures: [10, 11] },
    { id: "new", number: 88, happenedAt: "2026-11-20T00:00:00Z", domains: ["a.com"], mainSignal: "css:subgrid", events: [1, 2], captures: [11, 12] },
  ];
  const l = storyLookup(rows);
  it("a change reported by two stories points at the newest", () => expect(storyForRow(l, { event: 1 })).toEqual({ id: "new", number: 88, href: "/stories/new", text: "No. 88 →" }));
  it("a list of changes (a rebrand row) finds its story", () => expect(storyForRow(l, { events: [99, 2] })?.number).toBe(88));
  it("captures either side of a reported change", () => { expect(storyForRow(l, { domain: "a.com", capture: 10 })?.number).toBe(40); expect(storyForRow(l, { domain: "b.com", capture: 10 })).toBeNull(); });
  it("a signal or pattern row: the newest story whose main signal it is", () => { expect(storyForRow(l, { signal: "css:subgrid" })?.number).toBe(88); expect(storyForRow(l, { signal: "css:other" })).toBeNull(); });
  it("no story, no link", () => expect(storyForRow(l, { event: 3 })).toBeNull());
});

describe("a week's Data view lists every item the stored brief cites", () => {
  it("briefMovers", () => {
    const m = briefMovers({ week: "2026-W46", headline: "h", caveats: "", refs: { "event:9": { label: "Dropbox headline", domain: "dropbox.com" } }, sections: [{ title: "Rising", body: "", citations: [{ kind: "forecast", id: "css:subgrid:all" }, { kind: "event", id: "9" }] }] });
    expect(m).toEqual([{ section: "Rising", kind: "Signal", what: "Subgrid layouts", href: "/signals/css%3Asubgrid?view=data" }, { section: "Rising", kind: "Brand change", what: "Dropbox headline", href: "/brands/dropbox.com?view=data" }]);
  });
});

describe("one name per thing", () => {
  it("the Read bar and the terminal's sections use the same names", () => {
    for (const b of READ_BAR) { const s = SECTIONS.find(x => x.id === (b.id === "today" ? "live" : b.id)); if (s) expect(b.label, b.id).toBe(s.label); }
  });
  it("terminal tabs are named as their Read pages are", () => {
    const label = (id: string) => TABS.find(t => t.id === id)!.label;
    expect(label("library")).toBe("DIRECTORY"); expect(label("rebrands")).toBe("MOVES"); expect(label("lexicon")).toBe("VOICE"); expect(label("wire")).toBe("WIRE");
  });
  // Old names live on only as key aliases (ia.ts LEGACY_PANELS / VIEW_ALIASES); reader-facing text never uses them again.
  const OLD = [/["'>]\s*(?:F\d+ )?(?:LIBRARY|REBRAND DESK|EVENT TAPE|LEXICON)\b/, /["'>]\s*(?:Library|Rebrand desk|Event tape|Lexicon)\s*["'<]/, /\bdata stor(?:y|ies)\b/i];
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name) ? [`${d}/${e.name}`] : []));
  it("no reader-facing old section or object name is typed in components, routes or the glossary", () => {
    // LeadingView's "Library" is a code library on npm, not the old name for Brands.
    const files = [...walk("src/components"), ...walk("src/routes"), "src/lib/glossary.ts"].filter(f => !f.endsWith("LeadingView.tsx"));
    const hits = files.flatMap(f => readFileSync(f, "utf8").split("\n").map((l, i) => [f, i + 1, l] as const).filter(([, , l]) => !/^\s*(\/\/|\*|\/\*)/.test(l) && OLD.some(r => r.test(l))).map(([f, n, l]) => `${f}:${n}: ${l.trim().slice(0, 100)}`));
    expect(hits).toEqual([]);
  });
});
