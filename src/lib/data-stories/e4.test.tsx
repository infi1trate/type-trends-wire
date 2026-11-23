// E4 · studies: series, the shelf, scenes, the study writer's check and fallback, the truth rules and the naming sweep.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { fxInput } from "./fixtures";
import { BUILDERS, buildStory } from "./build";
import { DATA_STORIES, entryOf, relatedFor, seriesOf, templateName } from "./registry";
import { sceneFromParam, paramOfScene, sceneOfStep } from "./scenes";
import { CANDIDATE_CAP, candidateRows, changedAt, draftRow, earliestQuarter, frontStudies, leadOf, studiesHome, type HomeStudy } from "./shelf";
import { checkStudyText, chooseText, parseStudy, plain, factsHash, factsSheet, fallbackText, type FactsSheet, type StudyWritten } from "./writer";
import { truthEvents, type RawEvent } from "./truth";
import { DataIndexView } from "@/components/data/DataIndexView";
import { DataStoryView } from "@/components/data/DataStoryView";
import type { StoryModel, StudyPage } from "./types";
import type { Check } from "../integrity";

async function page(el: () => ReactElement) {
  const router = createRouter({ routeTree: createRootRoute({ component: el }), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(createElement(RouterProvider, { router } as never));
}
const NOV_20 = Date.parse("2026-11-20T12:00:00Z");
const metaFor = (slug: string) => { const e = entryOf(slug)!; return { slug, number: e.number, question: e.question, deck: e.deck, template: templateName(e), collection: e.collection, related: relatedFor(slug), series: e.series, seriesTitle: seriesOf(e.series)!.title }; };
const built = (): StoryModel[] => Object.keys(BUILDERS).flatMap(slug => { const m = buildStory(slug, fxInput(), new Map()); return m ? [m] : []; });

describe("scenes", () => {
  const models = built();
  it("the fixture builds at least one study", () => expect(models.length).toBeGreaterThan(0));
  it("every step sits in exactly one scene; three to five scenes; each shows its last step's view", () => {
    for (const m of models) {
      expect(m.scenes.length, m.slug).toBeGreaterThanOrEqual(3);
      expect(m.scenes.length, m.slug).toBeLessThanOrEqual(5);
      for (const st of m.steps) expect(m.scenes.filter(sc => sc.steps.includes(st.id)).length, `${m.slug}:${st.id}`).toBe(1);
      for (const sc of m.scenes) expect(sc.view).toEqual(m.steps.find(s => s.id === sc.steps.at(-1))!.view);
      for (const sc of m.scenes) { expect(sc.lead.split(/\s+/).length).toBeLessThanOrEqual(8); expect(sc.lead).not.toMatch(/\d/); }
    }
  });
  it("?step= (old 1-based step numbers) opens the scene that holds that step; junk opens the first", () => {
    for (const m of models) {
      m.steps.forEach((st, k) => { const j = sceneFromParam(m, k + 1); expect(m.scenes[j]!.steps).toContain(st.id); expect(sceneFromParam(m, String(k + 1))).toBe(j); });
      expect(sceneFromParam(m, undefined)).toBe(0);
      expect(sceneFromParam(m, "nope")).toBe(0);
      m.scenes.forEach((_, j) => expect(sceneOfStep(m, paramOfScene(m, j) - 1)).toBe(j));
    }
  });
  it("every step's fact is on the facts sheet of the scene that holds it", () => {
    for (const m of models) { const f = factsSheet(m); m.scenes.forEach((sc, j) => expect(f.scenes[j]!.facts.length).toBe(sc.steps.length)); }
  });
});

describe("the shelf", () => {
  it("the earliest date: one new well-covered quarter per calendar quarter (5 of 8 in Q4 2026 → Q3 2027)", () => {
    expect(earliestQuarter({ have: 5, need: 8, now: NOV_20 })).toBe("2027Q3");
    expect(earliestQuarter({ have: 7, need: 8, now: Date.parse("2027-01-05T00:00:00Z") })).toBe("2027Q2");
    expect(earliestQuarter({ have: 9, need: 8, now: NOV_20 })).toBe("2026Q4");
    const r = draftRow({ slug: "where-did-fintechs-colour-go", question: "Where did fintech's colour go?", series: "long-view" }, { have: 5, need: 8, text: "Has 5 well-covered quarters of fintech palettes, needs 8.", perQuarter: true }, NOV_20);
    expect(r).toMatchObject({ series: "The long view", wait: "Has 5 well-covered quarters of fintech palettes, needs 8.", earliest: "Earliest: Q3 2027" });
  });
  it("candidates: closest to passing first, at most three, a passing one is ready to write", () => {
    const rows = candidateRows([{ key: "a", name: "Serif headlines", entries: 4 }, { key: "b", name: "Dark mode", entries: 31 }, { key: "c", name: "Grain", entries: 12 }, { key: "d", name: "Pill buttons", entries: 19 }], 25);
    expect(rows).toHaveLength(CANDIDATE_CAP);
    expect(rows.map(r => r.question)).toEqual(["Who moved first: Dark mode", "Who moved first: Pill buttons", "Who moved first: Grain"]);
    expect(rows.map(r => r.wait)).toEqual(["Ready to write.", "Has 19 dated adopters, needs 25.", "Has 12 dated adopters, needs 25."]);
  });
  const study = (o: Partial<HomeStudy>): HomeStudy => ({ slug: "s", number: 1, label: "Study No. 1", series: "long-view", seriesTitle: "The long view", headline: "H", deck: "D", question: "Q?", dataThrough: null, href: "/data/s", key: { n: "1", label: "x" }, cover: null, changedAt: "2026-11-01T00:00:00Z", ...o });
  it("the lead is the study whose facts changed last (ties: lowest number); the front page takes it first, three at most", () => {
    const a = study({ slug: "a", number: 1, changedAt: "2026-11-10T00:00:00Z" }), b = study({ slug: "b", number: 2, series: "first-movers", changedAt: "2026-11-18T00:00:00Z" }), c = study({ slug: "c", number: 4, series: "sector-v-sector", changedAt: "2026-11-18T00:00:00Z" });
    expect(leadOf([a, b, c])?.slug).toBe("b");
    const h = studiesHome([c, a, b], []);
    // W3d-c · Beyond the homepage is listed now that No. 8 is switched on (empty here: no study of it in this list).
    expect(h.series.map(s => s.studies.map(x => x.slug))).toEqual([["b"], ["a"], ["c"], []]);
    expect(frontStudies(h).map(x => x.slug)).toEqual(["b", "a", "c"]);
    expect(frontStudies(studiesHome([a, b, c, study({ slug: "d", number: 6 })], [])).length).toBe(3);
  });
  it("a study with checked written text leads before one on fallback text, then the latest facts change, then the lowest number", () => {
    const one = study({ slug: "one", number: 1, written: true, changedAt: "2026-11-12" }), two = study({ slug: "two", number: 2, written: true, changedAt: "2026-11-12" }),
      four = study({ slug: "four", number: 4, written: false, changedAt: "2026-11-20" });
    expect(leadOf([four, two, one])?.slug).toBe("one");
    expect(leadOf([four, one, study({ slug: "two", number: 2, written: true, changedAt: "2026-11-14" })])?.slug).toBe("two");
    expect(leadOf([four, study({ slug: "five", number: 5, written: false, changedAt: "2026-11-21" })])?.slug).toBe("five");
    expect(leadOf([{ ...four, written: true }, one, two])?.slug).toBe("four");
  });
  it("facts that changed the same day tie (the lowest number leads); a sheet with nothing written from it changed today", () => {
    const rows = [{ slug: "a", facts_hash: "h1", created_at: "2026-11-20T22:46:41Z" }, { slug: "b", facts_hash: "h2", created_at: "2026-11-20T22:47:07Z" }, { slug: "a", facts_hash: "old", created_at: "2026-10-01T00:00:00Z" }];
    expect(changedAt(rows, "a", "h1", NOV_20)).toBe("2026-11-20");
    expect(changedAt(rows, "b", "h2", NOV_20)).toBe(changedAt(rows, "a", "h1", NOV_20));
    expect(changedAt(rows, "c", "h3", NOV_20)).toBe("2026-11-20");
  });
  it("an empty shelf draws nothing; a series with no live study says its first is in the works", async () => {
    const html = await page(() => <DataIndexView home={studiesHome([study({ slug: "a", series: "long-view" })], [])} />);
    expect(html).not.toContain("data-studies-shelf");
    expect(html).not.toContain("In the works</h2>");
    expect(html).toContain("First study in the works.");
    expect(html).toContain("Longer answers, built from five years of captures");
    expect(html).not.toMatch(/SMALL MULTIPLES|DRAFT/);
    const withShelf = await page(() => <DataIndexView home={studiesHome([], [{ key: "x", question: "Q?", series: "The long view", wait: "Has 5, needs 8.", earliest: "Earliest: Q3 2027", ready: false }])} />);
    expect(withShelf).toContain("data-studies-shelf");
    expect(withShelf).toContain("Earliest: Q3 2027");
  });
});

// A sheet written by hand, so the check is tested on known facts.
const sheet: FactsSheet = {
  slug: "who-went-big-first", number: 2, series: "Who moved first", question: "Who went big first?", key: { n: "27.7%", label: "of tracked homepages show big type" }, templates: "Adoption timeline",
  scenes: [
    { id: "a", lead: "Where it stands", facts: ["Big type is on 27.7% of tracked homepages, up from 14.3% in Q1 2021."], numbers: [{ text: "27.7%", value: 27.7, href: "/r/1" }, { text: "14.3%", value: 14.3, href: "/r/2" }], names: [] },
    { id: "b", lead: "Who it can date", facts: ["43 brands already had it in their first capture; the first three dated are Netlify and Headspace in Q1 2022."], numbers: [{ text: "43", value: 43, href: "/r/3" }], names: [{ name: "Netlify", kind: "brand", href: "/brands/netlify.com" }, { name: "Headspace", kind: "brand", href: "/brands/headspace.com" }] },
    { id: "c", lead: "Who left again", facts: ["42 adopters have dropped it again."], numbers: [{ text: "42", value: 42, href: "/r/4" }], names: [] },
  ],
  limits: ["Archive captures are about yearly."], rankings: ["first"], links: [], phrasings: [],
};
const known = { names: ["Netlify", "Headspace", "Stripe", "Mother"] };
const fill = (n: number) => Array.from({ length: n }, (_, i) => ["The", "chart", "reads", "each", "tracked", "homepage", "quarter", "by", "quarter", "from", "stored", "captures"][i % 12]).join(" ") + ".";
const good: StudyWritten = {
  headline: "Big type spread and receded at the same time",
  deck: "Brands arrived and left together, so one rising line hides two movements.",
  opening: `Big type is on 27.7% of tracked homepages, up from 14.3% in Q1 2021. Forty-three brands already had it in their first stored capture. ${fill(110)}`,
  scenes: [
    { lead: "Where it stands", body: `The line ends at 27.7% of tracked homepages. ${fill(50)}` },
    { lead: "Who it can date", body: `Netlify and Headspace are among the first it can date, both in Q1 2022. ${fill(45)}` },
    { lead: "Who left again", body: `Since then 42 adopters have dropped it again. ${fill(50)}` },
  ],
  use: `A design lead weighing big type for a homepage can read this as a common choice rather than a new one, provided the brand's sector shows the same rise. ${fill(20)}`,
};
describe("the study writer's check", () => {
  it("accepts a correct text", () => expect(checkStudyText(good, sheet, known)).toEqual([]));
  const fails = (t: Partial<StudyWritten>) => checkStudyText({ ...good, ...t }, sheet, known);
  it("rejects a number not on the sheet", () => expect(fails({ opening: good.opening.replace("27.7%", "31.2%") })).toContain("number not on the sheet: 31.2"));
  it("rejects a brand not on the sheet", () => expect(fails({ scenes: [good.scenes[0]!, { ...good.scenes[1]!, body: good.scenes[1]!.body.replace("Headspace", "Stripe") }, good.scenes[2]!] })).toContain("brand not on the sheet: Stripe"));
  it("a sector the sheet links may be named, even when its facts name it bare (“AI logs …”); another may not", () => {
    const sec: FactsSheet = { ...sheet, scenes: [sheet.scenes[0]!, { ...sheet.scenes[1]!, facts: [...sheet.scenes[1]!.facts, "AI logs 43 changes."], names: [...sheet.scenes[1]!.names, { name: "AI", kind: "sector", href: "/sectors/ai" }] }, sheet.scenes[2]!] };
    const t = { ...good, scenes: [good.scenes[0]!, { ...good.scenes[1]!, body: `${good.scenes[1]!.body} The AI sector sits apart.` }, good.scenes[2]!] };
    expect(checkStudyText(t, sec, known)).toEqual([]);
    expect(checkStudyText({ ...t, use: good.use.replace("the brand's sector", "the media sector") }, sec, known)).toContain("sector not on the sheet: Media");
  });
  it("rejects a causal claim", () => expect(fails({ use: good.use.replace("provided", "because") })).toContain("a causal claim: because"));
  it("rejects a superlative the sheet does not carry", () => expect(fails({ headline: "Big type is the biggest homepage change in years" })).toContain("a superlative the sheet does not carry: biggest"));
  it("rejects a question-mark headline and one that repeats the question", () => {
    expect(fails({ headline: "Did big type spread across every sector now?" })).toContain("headline is a question");
    expect(fails({ headline: "Who went big first? Brands in tech" })).toContain("headline repeats the question");
  });
  it("rejects each length bound", () => {
    expect(fails({ headline: "Big type spread" }).some(f => f.startsWith("headline has 3 words"))).toBe(true);
    expect(fails({ headline: "Big type spread and receded at the same time across all the sectors" }).some(f => f.startsWith("headline has"))).toBe(true);
    expect(fails({ deck: fill(31) }).some(f => f.startsWith("deck has 31 words"))).toBe(true);
    expect(fails({ opening: fill(80) }).some(f => f.startsWith("opening has 80 words"))).toBe(true);
    expect(fails({ opening: fill(160) }).some(f => f.startsWith("opening has 160 words"))).toBe(true);
    expect(fails({ scenes: [{ ...good.scenes[0]!, lead: "Where the line stands now at the very end" }, good.scenes[1]!, good.scenes[2]!] }).some(f => f.startsWith("scene 1 lead has 9 words"))).toBe(true);
    expect(fails({ scenes: [{ ...good.scenes[0]!, lead: "In Q4" }, good.scenes[1]!, good.scenes[2]!] })).toContain("scene 1 lead has a digit");
    expect(fails({ scenes: [{ ...good.scenes[0]!, body: fill(30) }, good.scenes[1]!, good.scenes[2]!] }).some(f => f.startsWith("scene 1 body has 30 words"))).toBe(true);
    expect(fails({ scenes: [{ ...good.scenes[0]!, body: fill(95) }, good.scenes[1]!, good.scenes[2]!] }).some(f => f.startsWith("scene 1 body has 95 words"))).toBe(true);
    expect(fails({ scenes: good.scenes.slice(0, 2) })).toContain("2 scenes (the sheet has 3)");
    expect(fails({ use: fill(20) }).some(f => f.startsWith("use has 20 words"))).toBe(true);
    expect(fails({ use: fill(75) }).some(f => f.startsWith("use has 75 words"))).toBe(true);
  });
});

describe("model text is plain text", () => {
  it("markdown emphasis is removed when a reply is parsed and when a stored version is read", () => {
    expect(plain("**The share rose**")).toBe("The share rose");
    expect(plain("A *very* plain   line_")).toBe("A very plain line");
    expect(parseStudy({ headline: "H h h h h", deck: "D", opening: "O", scenes: [{ lead: "**Some starts are missing**", body: "B" }], use: "U" })?.scenes[0]?.lead).toBe("Some starts are missing");
    const m = built()[0]!;
    const row = { slug: m.slug, facts_hash: "x", headline: "H", deck: "d", opening: "o", scenes: m.scenes.map(() => ({ lead: "**Lead in**", body: "Body." })), use_text: null, model: "openai/gpt-6.2-astra", checked_at: "2026-11-20T00:00:00Z", created_at: "2026-11-20T00:00:00Z" };
    expect(chooseText([row], "x", m).scenes.every(x => x.lead === "Lead in")).toBe(true);
  });
});
describe("fallback", () => {
  it("renders a complete study page with no model call: headline, opening, every scene, limits, evidence, related; no use paragraph", async () => {
    const m = built().find(x => x.slug === "who-went-big-first") ?? built()[0]!;
    const text = chooseText([], factsHash(factsSheet(m)), m);
    expect(text).toEqual(fallbackText(m));
    expect(text.source).toBe("fallback");
    const sp: StudyPage = { ...m, text, hash: factsHash(factsSheet(m)), v: 4 };
    const html = await page(() => <DataStoryView s={sp} scene={0} onScene={() => {}} related={<p>related</p>} />);
    expect(html).toContain(text.headline.replace(/&/g, "&amp;"));
    expect(html).toContain("data-study-opening");
    expect((html.match(/data-scene="/g) ?? []).length).toBe(m.scenes.length);
    for (const sc of text.scenes) expect(sc.body.length).toBeGreaterThan(20);
    expect(html).toContain("Evidence</h2>");
    expect(html).toContain("Related</h2>");
    expect(html).toContain("The data behind the charts");
    expect(html).not.toContain("What to do with it");
    expect(html).not.toMatch(/\d+ of \d+<\/span>/);
    expect(html).toContain(`${m.seriesTitle} · Study No. ${m.number}`);
  });
  it("a checked stored text from an older sheet is shown with its date; a failed one never", () => {
    const m = built()[0]!, hash = factsHash(factsSheet(m));
    const row = { slug: m.slug, headline: "Stored headline for this study here", deck: "d", opening: "o", scenes: m.scenes.map(() => ({ lead: "L", body: "B" })), use_text: "u", model: "openai/gpt-6.2-astra" };
    expect(chooseText([{ ...row, facts_hash: "old", checked_at: "2026-11-02T00:00:00Z", created_at: "2026-11-02T00:00:00Z" }], hash, m)).toMatchObject({ headline: row.headline, stale: true, source: "model", at: "2026-11-02T00:00:00Z" });
    expect(chooseText([{ ...row, facts_hash: hash, checked_at: null, created_at: "2026-11-03T00:00:00Z" }], hash, m).source).toBe("fallback");
  });
});

describe("truth rules (study inputs)", () => {
  const ev = (o: Partial<RawEvent> & { id: number }): RawEvent => ({ domain: "acme.com", type: "palette_shift", source: "wayback", at: "2024-03-01T00:00:00Z", snapshot_id: o.id * 10, prev_snapshot_id: o.id * 10 - 1, ...o });
  const sectors: Record<string, string> = { "acme.com": "enterprise-saas", "studio.com": "studios", "slides.com": "fintech" };
  const events = [
    ev({ id: 1, domain: "slides.com", type: "message_pivot", before: { headline: "Old" }, after: { headline: "New" } }),
    ev({ id: 2, domain: "studio.com", type: "palette_shift", before: { palette: ["#111111"], accent: "#222222" }, after: { palette: ["#333333"], accent: "#444444" } }),
    ev({ id: 3, domain: "acme.com", type: "palette_shift", before: { palette: ["#111111"] }, after: { palette: ["#333333"] } }),
    ev({ id: 4, domain: "studio.com", type: "type_change", before: { font: "A" }, after: { font: "B" } }),
  ];
  const out = truthEvents(events, { carousel: new Set([10]), checks: new Map(), sectorOf: d => sectors[d] ?? null });
  it("a headline change on a rotating first screen is not counted", () => expect(out.some(e => e.id === 1)).toBe(false));
  it("a studios palette change is not counted; a studio's own type change is", () => { expect(out.some(e => e.id === 2)).toBe(false); expect(out.some(e => e.id === 4)).toBe(true); });
  it("an ordinary palette change is counted", () => expect(out.some(e => e.id === 3)).toBe(true));
  it("live changes count only when confirmed, and none when verdicts can't be read", () => {
    const live = ev({ id: 5, source: "live", type: "type_change", before: { font: "A" }, after: { font: "B" } });
    const pass: Check = { verdict: "pass", fields: {}, pass: ["font"] } as unknown as Check;
    expect(truthEvents([live], { carousel: new Set(), checks: null, sectorOf: () => "fintech" })).toEqual([]);
    expect(truthEvents([live], { carousel: new Set(), checks: new Map(), sectorOf: () => "fintech" })).toEqual([]);
    expect(truthEvents([live], { carousel: new Set(), checks: new Map([[5, pass]]), sectorOf: () => "fintech" }).map(e => e.id)).toEqual([5]);
  });
  it("the sector study counts the filtered events: fewer changes once the rules apply", () => {
    const sec = DATA_STORIES.find(e => e.series === "sector-v-sector")!;
    expect(sec.number).toBe(4);
  });
});

describe("naming", () => {
  const files = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (p.includes("integrations") ? [] : files(p)) : /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []; });
  it("no reader-facing “Data story”, “Data stories” or “DATA STORY” string remains", () => {
    const hits: string[] = [];
    for (const p of files("src")) {
      const code = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
      for (const m of code.matchAll(/(["'`>])[^"'`<\n]*\b(Data stor(?:y|ies)|DATA STOR(?:Y|IES)|a data story|data stories)\b[^"'`<\n]*/g)) hits.push(`${p}: ${m[0].slice(0, 80)}`);
    }
    expect(hits).toEqual([]);
  });
});
