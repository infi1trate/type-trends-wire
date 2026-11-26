// Y1 + Y2 · the evidence desk's matching and timing, and the "Why now" standards checks.
import { describe, expect, it } from "vitest";
import { PLATFORM, buildDossier, drawersFor, keywordIn, quoteHolds, type Entry } from "./dossier";
import { covered, mayCause, timing } from "./timing";
import { usableSeries } from "../chart/model";
import { checkWhyNow, shownBlock, type WhyNow } from "./whynow";

const qs = [{ q: "2021Q1", s: 0.02, n: 200 }, { q: "2023Q1", s: 0.025, n: 220 }, { q: "2024Q1", s: 0.03, n: 230 }, { q: "2025Q1", s: 0.09, n: 240 }, { q: "2026Q1", s: 0.14, n: 250 }, { q: "2026Q4", s: 0.13, n: 260 }].map(q => ({ ...q, c: q.n / 300 }));
describe("platform dates", () => {
  it("every row has a source link on MDN; unknown fields are null, never guessed", () => {
    expect(PLATFORM.length).toBe(16);
    for (const r of PLATFORM) { expect(r.source, r.trait).toMatch(/^https:\/\/developer\.mozilla\.org\//); for (const k of ["chrome", "safari", "firefox", "all_three"] as const) expect(r[k] === null || /^\d{4}-\d{2}$/.test(r[k]!)).toBe(true); }
    expect(PLATFORM.find(r => r.trait === "css:starting_style")!.all_three).toBe("2024-08");
  });
});
describe("timing test", () => {
  it("the rise begins at the first quarter clear of the noise band, and an entry after the peak is after the rise", () => {
    const t = timing(qs);
    expect(t.riseStart).toBe("2025Q1"); expect(t.riseEnd).toBe("2026Q1");
    expect(t.phaseOf("2023-06")).toBe("before"); expect(t.phaseOf("2024-08")).toBe("during"); expect(t.phaseOf("2026-08-01")).toBe("after");
    expect(mayCause("after")).toBe(false); expect(mayCause("during")).toBe(true);
  });
  it("a flat series has no rise", () => { expect(timing([{ q: "2025Q1", s: 0.1, n: 300, c: 1 }, { q: "2026Q1", s: 0.101, n: 300, c: 1 }]).phaseOf("2025-06")).toBe("no rise"); });
  it("rise start and peak ignore low coverage and unknown coverage, just like share charts", () => {
    const rows: Parameters<typeof timing>[0] = [...qs, { q: "2022Q1", s: 0.9, n: 20, c: 20 / 300 }, { q: "2026Q3", s: 1, n: 300 }];
    expect(timing(rows).riseStart).toBe("2025Q1");
    expect(timing(rows).riseEnd).toBe("2026Q1");
    expect(rows.filter(covered).map(p => p.q)).toEqual(usableSeries({ quarters: rows.map(p => ({ ...p, c: p.c ?? 0 })) }).map(p => p.q));
  });
});
describe("dossier", () => {
  const calendar = (quarters: Parameters<typeof buildDossier>[0]["quarters"]) => buildDossier({ signal: "imagery:collage", name: "Collage", quarters, wire: [], brands: [], indicators: [] }).entries.filter(e => e.drawer === "calendar");
  it("the real 2022Q1–2026Q4 collage denominators cannot support a seasonal entry", () => {
    const ns = [241, 20, 243, 19, 245, 16, 116, 15, 254, 19, 0, 18, 261, 13, 2, 17, 263, 12, 0, 300];
    const counts = [8, 1, 8, 1, 10, 0, 4, 1, 12, 0, 0, 1, 15, 0, 0, 1, 14, 0, 0, 24];
    expect(calendar(ns.map((n, j) => ({ q: `${2022 + Math.floor(j / 4)}Q${j % 4 + 1}`, n, c: n / 300, s: n ? (counts[j] ?? 0) / n : null })))).toEqual([]);
  });
  it("full-panel seasonal quarters still support a calendar entry", () => {
    const rows = Array.from({ length: 20 }, (_, j) => ({ q: `${2022 + Math.floor(j / 4)}Q${j % 4 + 1}`, n: 300, c: 1, s: j % 4 === 3 ? 0.2 : 0.05 }));
    expect(calendar(rows)).toMatchObject([{ id: "k:imagery:collage:Q4", date: "2022-10" }]);
  });
  it("two earlier season quarters and two other chart-eligible quarters are required", () => {
    expect(calendar([{ q: "2024Q4", s: .2, n: 300, c: 1 }, { q: "2025Q4", s: .2, n: 300, c: 1 }, { q: "2026Q1", s: .05, n: 300, c: 1 }, { q: "2026Q2", s: .05, n: 20, c: 20 / 300 }, { q: "2026Q4", s: .2, n: 300, c: 1 }])).toEqual([]);
  });
  const wire = [{ id: 1, title: "The return of the entry animation", excerpt: null, url: "https://x.test/1", source: "Smashing Magazine", source_kind: "rss", published_at: "2024-06-02T00:00:00Z" },
    { id: 2, title: "Acme raises Series B", excerpt: "Acme announced", url: "https://x.test/2", source: "Dezeen", source_kind: "rss", published_at: "2025-03-01T00:00:00Z" },
    { id: 3, title: "New AI assistant for designers", excerpt: null, url: "https://x.test/3", source: "Hacker News", source_kind: "hn", published_at: "2026-01-01T00:00:00Z" }];
  it("matches the platform row, keyword culture items and brand business items by rule, timed against the rise", () => {
    const d = buildDossier({ signal: "css:starting_style", name: "Entry animations", quarters: qs, wire, brands: [{ domain: "acme.com", name: "Acme" }], indicators: [] });
    expect(d.entries.find(e => e.id === "p:css:starting_style:all")).toMatchObject({ drawer: "platform", date: "2024-08", phase: "during", link: expect.stringContaining("mozilla") });
    expect(d.entries.find(e => e.id === "c:1")?.drawer).toBe("culture");
    expect(d.entries.find(e => e.id === "b:2:acme.com")?.brand).toBe("acme.com");
    expect(d.entries.every(e => e.match === "rule")).toBe(true);
  });
  it("structure signals use business and calendar only; furn:ask_ai matches AI assistant items", () => {
    expect(drawersFor("nav:pricing")).toEqual(["business", "calendar"]);
    const d = buildDossier({ signal: "furn:ask_ai", name: "Ask-AI box", quarters: qs, wire, brands: [], indicators: [] });
    expect(d.entries.map(e => e.id)).toContain("b:3:ai"); expect(d.entries.some(e => e.drawer === "culture" || e.drawer === "platform")).toBe(false);
  });
  it("a model-proposed entry is marked and kept only when its quote is in the item's own words", () => {
    const d = buildDossier({ signal: "combo:big_type", name: "Big type", quarters: qs, wire, brands: [], indicators: [], model: [{ wire: 1, drawer: "culture", quote: "entry animation" }, { wire: 2, drawer: "culture", quote: "giant letters" }] });
    expect(d.entries.filter(e => e.match === "model").map(e => [e.id, e.quote])).toEqual([["m:1", "entry animation"]]);
    expect(quoteHolds("raises", wire[1]!)).toBe(true); expect(keywordIn("Big Type is back", ["big type"])).toBe("Big Type");
  });
});

const E: Entry[] = [
  { id: "p1", drawer: "platform", date: "2024-08", sentence: "x", source: "MDN", link: "https://developer.mozilla.org/a", brand: null, match: "rule", phase: "during" },
  { id: "late", drawer: "culture", date: "2026-08-01", sentence: "x", source: "Dezeen", link: "https://x.test", brand: null, match: "rule", phase: "after" },
  { id: "nolink", drawer: "calendar", date: "2023-01", sentence: "x", source: "slug", link: null, brand: null, match: "rule", phase: "before" },
];
const F = [{ id: "share", text: "13% of homepages in Q4 2026" }];
const good: WhyNow = { known: [{ entry: "p1", sentence: "The CSS feature behind entry animations reached all three major browsers in August 2024.", date: "2024-08", link: "https://developer.mozilla.org/a", source: "MDN" }],
  likely: [{ sentence: "The rise is consistent with the feature becoming safe to use everywhere.", refs: [{ kind: "entry", id: "p1" }, { kind: "figure", id: "share" }] }],
  read: ["Our read: motion on arrival has become a sign of a page built with care."] };
describe("why now: the standards desk's checks", () => {
  it("passes a block that keeps known, likely and our read apart", () => { expect(checkWhyNow(good, E, F)).toEqual([]); });
  it("refuses a cause dated after the rise", () => { expect(checkWhyNow({ ...good, known: [{ ...good.known[0]!, entry: "late" }] }, E, F).join()).toMatch(/after the rise/); });
  it("refuses a Known with no link", () => { expect(checkWhyNow({ ...good, known: [{ ...good.known[0]!, entry: "nolink", link: "" }] }, E, F).join()).toMatch(/no link/); });
  it("refuses a Likely with no reference, or one that says because", () => {
    expect(checkWhyNow({ ...good, likely: [{ sentence: "It probably spread.", refs: [] }] }, E, F).join()).toMatch(/no reference/);
    expect(checkWhyNow({ ...good, likely: [{ sentence: "It likely rose because browsers shipped it.", refs: [{ kind: "entry", id: "p1" }] }] }, E, F).join()).toMatch(/causal/);
  });
  it("refuses an Our read with a number, a quotation or a name", () => {
    expect(checkWhyNow({ ...good, read: ["Our read: about 13 brands care."] }, E, F).join()).toMatch(/number/);
    expect(checkWhyNow({ ...good, read: ["Our read: it feels “alive”."] }, E, F).join()).toMatch(/quotation/);
    expect(checkWhyNow({ ...good, read: ["Our read: the taste of Jony Ive won."] }, E, F).join()).toMatch(/names someone/);
  });
  it("no Known, no block; a failed block is dropped whole", () => {
    expect(shownBlock({ known: [], likely: good.likely, read: good.read }, [])).toBeNull();
    expect(shownBlock(good, ["x"])).toBeNull(); expect(shownBlock(good, [])).toBe(good);
  });
  it("withdraws a stored block whose Known entry disappeared on rebuild", () => {
    const failures = checkWhyNow(good, E.filter(e => e.id !== "p1"), F);
    expect(failures.join()).toContain("maps to no dossier entry");
    expect(shownBlock(good, failures)).toBeNull();
  });
});

import set from "./__fixtures__/why-now-set.json";
describe("why now: the frozen golden set (ten examples)", () => {
  const s = set as unknown as { dossier: Entry[]; figures: { id: string; text: string }[]; cases: { id: string; block: WhyNow; expect: string | null }[] };
  it("has ten examples, including the four refusals the brief names", () => {
    expect(s.cases).toHaveLength(10);
    for (const want of ["after the rise", "no reference", "number", "no link"]) expect(s.cases.some(c => c.expect === want)).toBe(true);
  });
  for (const c of s.cases) it(`${c.id}: ${c.expect ? `refused (${c.expect})` : "passes"}`, () => {
    const f = checkWhyNow(c.block, s.dossier, s.figures);
    if (c.expect) expect(f.join(" | ")).toContain(c.expect); else expect(f).toEqual([]);
  });
});
