// Phase E2b · the writer's check, fallback order and limits. The twelve approved texts pass when given their facts; each listed failure fails.
import { describe, expect, it } from "vitest";
import { seededNames } from "../brand-names";
import { AI_MODELS } from "../ai-models";
import { APPROVED_EXAMPLES, APPROVED_STORIES, checkText, howWeKnow, parseWritten, writeWithFallback, WRITER_PER_DAY, type WriterChange, type WriterFacts, type WrittenText } from "./writer";

const known = { names: seededNames() };
const ch = (brand: string, what: string, from: string, to: string, date: string, basis: "measured" | "ai" = "measured"): WriterChange => ({ brand, what, from, to, date, page: "home", basis });
const F = (o: Partial<WriterFacts>): WriterFacts => ({ type: "move", kind: "Move", sector: null, brands: [], changes: [], copy: [], headline_call: null, numbers: [], lines: [], dates: [], rebrand: false, ...o });
const subj = (...names: string[]) => names.map(name => ({ name, role: "subject" as const }));

/** The facts each approved text was written from (as the engine hands them to the writer). */
export const APPROVED_FACTS: WriterFacts[] = [
  F({ brands: subj("DocuSign"), sector: "Enterprise SaaS", changes: [ch("DocuSign", "headline", "AI-powered agreement management", "Everything you need to agree", "2026-11-14"), { ...ch("DocuSign", "accent", "deep indigo", "electric violet", "2026-11-14"), hex: { from: "#4C00FF", to: "#7B2FF7" } }],
    copy: ["AI-powered agreement management", "Everything you need to agree"], headline_call: { call: "position", reason: "The brand stopped calling itself AI-powered." },
    numbers: [{ text: "AI as the product is on 29.2% of tracked homepages (Steady); AI as one feature on 14.6% (Rising)", basis: "ai" }], dates: ["2026-11-11", "2026-11-14"] }),
  F({ brands: subj("HubSpot"), changes: [ch("HubSpot", "headline", "Build demand, win deals, and delight customers — all on one platform", "HubSpot: The Customer Relationship Harness", "2026-11-14")], copy: ["HubSpot: The Customer Relationship Harness"], headline_call: { call: "position", reason: "A new claim about what HubSpot is." }, dates: ["2026-11-14"] }),
  F({ brands: subj("Dropbox"), changes: [ch("Dropbox", "palette", "Dropbox blue", "off-white and lime", "2026-11-11"), ch("Dropbox", "hero", "none", "still", "2026-11-11"), ch("Dropbox", "headline alignment", "center", "left", "2026-11-11"), ch("Dropbox", "headline", "Dropbox", "Freedom to work your way. Peace of mind built in.", "2026-11-14")], dates: ["2026-11-11", "2026-11-14"] }),
  F({ brands: subj("Miro"), changes: [ch("Miro", "headline font", "Roobert PRO", "Apris", "2026-11-13"), ch("Miro", "body font", "Noto Sans", "Roobert PRO", "2026-11-13")], dates: ["2026-11-13"] }),
  F({ brands: subj("The Light Phone"), changes: [ch("The Light Phone", "headline font", "Futura", "Akkurat LL", "2026-11-14"), ch("The Light Phone", "headline alignment", "right", "center", "2026-11-14")], lines: [{ text: "The homepage now leads with the developer program", basis: "measured" }], dates: ["2026-11-14"] }),
  F({ type: "roundup", kind: "Roundup", brands: subj("Brooklinen", "Lucid", "Peloton", "GoPro"), changes: [ch("Brooklinen", "headline", "The Gift Guide's Here!", "25% Off Sitewide Black Friday Sale", "2026-11-20"), ch("Lucid", "headline", "Lucid Gravity", "Black Friday Exclusive Offers", "2026-11-19"), ch("Peloton", "headline", "Movement that takes you far", "Up to $1,300 off Peloton equipment", "2026-11-18"), ch("GoPro", "headline", "GoPro", "Up to $200 off top cameras", "2026-11-20")],
    copy: ["48-Hours Only Singles' Day Sale", "The Gift Guide's Here!", "25% Off Sitewide Black Friday Sale", "Lucid Gravity", "Black Friday Exclusive Offers", "Movement that takes you far", "Up to $1,300 off Peloton equipment", "Up to $200 off top cameras"], dates: ["2026-11-11", "2026-11-14", "2026-11-20"] }),
  F({ type: "roundup", kind: "Roundup", brands: [...subj("Studio Dumbar", "Affirm", "Frog", "Meta"), { name: "Rivian", role: "cited" }, { name: "Vuori", role: "cited" }], changes: ["Studio Dumbar", "Affirm", "Frog", "Meta"].map(b => ch(b, "hero", "still", "video", "2026-11-14")),
    numbers: [{ text: "Video hero is on 21.0% of tracked homepages", basis: "measured" }], lines: [{ text: "Going the other way: Rivian · hero, video to still · 11 Nov; Vuori · hero, video to still · 14 Nov", basis: "measured" }], dates: ["2026-11-11", "2026-11-14"] }),
  F({ type: "white_space", kind: "White space", sector: "Dev tools", numbers: [{ text: "1 of 30 tracked dev tools homepages use lifestyle photography; 49% of homepages in every other sector do", basis: "ai" }], dates: ["2026-11-16"] }),
  F({ type: "shift", kind: "Shift", numbers: [{ text: "AI as the product: 29.2% of tracked homepages, Steady (was Rising)", basis: "ai" }, { text: "AI as one feature: 14.6% of tracked homepages, Rising", basis: "ai" }], dates: ["2026-11-15"] }),
  F({ type: "crossover", kind: "Crossover", sector: "Studios", numbers: [{ text: "Swiss grid style on 23.1% of tracked studio homepages, up from 8.7%; media leads at 70.8%", basis: "ai" }], dates: ["2026-11-15"] }),
  F({ type: "breakout", kind: "Breakout", sector: "Dev tools", numbers: [{ text: "Charts and data visuals on 30.0% of tracked dev tools homepages, momentum 1.2 points a quarter", basis: "ai" }], dates: ["2026-11-15"] }),
  F({ type: "roundup", kind: "Roundup", brands: subj("Wired", "Resend", "Bun"), changes: [ch("Wired", "imagery", "photography", "type-only visuals", "2026-11-14", "ai"), ch("Resend", "imagery", "product UI shots", "none", "2026-11-14", "ai"), ch("Bun", "imagery", "none", "flat illustration", "2026-11-14", "ai")], dates: ["2026-11-14"] }),
];
const STORY_FACTS: Record<string, WriterFacts> = { docusign: APPROVED_FACTS[0]!, "black-friday": APPROVED_FACTS[5]! };

/** Approved texts that the code check (as the brief defines it) refuses, each with the reason (reported to the owner; never loosened). */
export const CHECK_SKIPPED: Record<number, string> = {
  9: "The approved headline “AI is moving from the headline to the feature list” has ten words; the check allows four to nine.",
};

describe("the check · the twelve approved texts pass with their facts", () => {
  APPROVED_EXAMPLES.forEach((e, i) => (CHECK_SKIPPED[i + 1] ? it.skip : it)(`${i + 1} · ${e.headline}`, () => expect(checkText(e, APPROVED_FACTS[i]!, known)).toEqual([])));
  it("approved #9 fails only on its word count", () => expect(checkText(APPROVED_EXAMPLES[8]!, APPROVED_FACTS[8]!, known)).toEqual(["headline has 10 words (four to nine)"]));
  for (const s of APPROVED_STORIES) it(`the full ${s.name} story passes with body and how we know`, () => expect(checkText(s, STORY_FACTS[s.name]!, known, { requireBody: true })).toEqual([]));
});

describe("the check · each failure fails", () => {
  const f = APPROVED_FACTS[0]!, ok = APPROVED_STORIES[0]!;
  const bad = (t: Partial<WrittenText>, facts = f) => checkText({ ...ok, ...t }, facts, known, { requireBody: true });
  it("a headline with a colon", () => expect(bad({ headline: "DocuSign: a new headline for agreements" })).toContain("headline has a colon"));
  it("a ten-word headline", () => expect(bad({ headline: "DocuSign took the words AI-powered out of its homepage headline" })).toContain("headline has 10 words (four to nine)"));
  it("a bare domain", () => expect(bad({ deck: "docusign.com now says “Everything you need to agree”." })).toContain("a bare tracked domain"));
  it("a number not in the facts", () => expect(bad({ deck: "The line changed on 31.5% of the page." })).toContain("number not in the facts: 31.5"));
  it("a misquoted headline", () => expect(bad({ deck: "The homepage line is now “Everything you need to sign”." })).toContain("quote not in the captured copy: “Everything you need to sign”"));
  it("“rebranded” on an accent-only change", () => {
    const accent = { ...f, changes: [f.changes[1]!], copy: [] };
    expect(bad({ headline: "DocuSign rebranded with an electric violet", deck: "The accent moved from deep indigo to electric violet.", body: ["DocuSign rebranded on 14 November, from a deep indigo accent to an electric violet one, and kept its type and layout exactly where they were before.", "It is the only change the captures show this week, and it stands on its own until more of the page moves with it."] }, accent)).toContain("“rebrand” without type, colour and layout changing together");
  });
  it("“worth watching”", () => expect(bad({ deck: "The homepage line is now “Everything you need to agree”, which is worth watching." })).toContain("banned phrase: worth watching"));
  it("“you should”", () => expect(bad({ deck: "You should read the homepage line, now “Everything you need to agree”." })).toContain("banned phrase: you should"));
  it("an our-read fact with a how-we-know line that says only “measured”", () => expect(bad({ how_we_know: "Measured from captures on 11 and 14 November." })).toContain("how_we_know does not say which facts are our read"));
  it("a brand the story is not about", () => expect(bad({ deck: "The homepage line is now “Everything you need to agree”, like Dropbox." })).toContain("brand not in the story: Dropbox"));
  it("a date not in the facts", () => expect(bad({ deck: "By 18 November the line read “Everything you need to agree”." })).toContain("date not in the facts: 18 nov"));
  it("a method word", () => expect(bad({ how_we_know: "Our read, an AI estimate, above the threshold." })).toContain("method word: threshold"));
  it("a short body", () => expect(bad({ body: ["Too short.", "Still short."] })).toContain("body has 4 words (60 to 140)"));
});

describe("fallback order and limits", () => {
  const f = APPROVED_FACTS[0]!, good = APPROVED_STORIES[0]!, template: WrittenText = { headline: "DocuSign changed its headline and accent", deck: "Headline and accent (14 Nov).", body: [], how_we_know: howWeKnow({ dates: f.dates, ourRead: true, measured: true }) };
  it("writer fails twice, the text model once, then the template; the story still has text", async () => {
    const calls: string[] = [];
    const r = await writeWithFallback(f, template, known, async m => { calls.push(m); return { raw: "{}", cost: 0.01 }; }, () => true);
    expect(calls).toEqual([AI_MODELS.writer, AI_MODELS.writer, AI_MODELS.text]);
    expect(r).toMatchObject({ model: "template", checked: false, attempts: 3, text: template });
  });
  it("the second writer call is given the failures of the first", async () => {
    const seen: string[][] = [];
    const r = await writeWithFallback(f, template, known, async (_m, failures) => { seen.push(failures); return { raw: seen.length === 1 ? JSON.stringify({ ...good, headline: "DocuSign: new words" }) : JSON.stringify(good), cost: 0 }; }, () => true);
    expect(seen[1]).toContain("headline has a colon");
    expect(r).toMatchObject({ model: AI_MODELS.writer, checked: true, attempts: 2 });
  });
  it("a model error counts as a failure and falls through", async () => {
    const r = await writeWithFallback(f, template, known, async m => { if (m === AI_MODELS.writer) throw new Error("boom"); return { raw: JSON.stringify(good), cost: 0 }; }, () => true);
    expect(r).toMatchObject({ model: AI_MODELS.text, checked: true, attempts: 3 });
  });
  it("the 13th writer call of a day is not made", async () => {
    let used = WRITER_PER_DAY; const calls: string[] = [];
    const r = await writeWithFallback(f, template, known, async m => { calls.push(m); used++; return { raw: JSON.stringify(good), cost: 0 }; }, m => m !== AI_MODELS.writer || used < WRITER_PER_DAY);
    expect(calls).toEqual([AI_MODELS.text]);
    expect(used).toBe(WRITER_PER_DAY + 1);
    expect(r.model).toBe(AI_MODELS.text);
  });
  it("parses JSON text and a body given as one string", () => expect(parseWritten(JSON.stringify({ headline: "A b c d.", deck: "D", body: "One.\n\nTwo.", how_we_know: "How we know: x" }))).toEqual({ headline: "A b c d", deck: "D", body: ["One.", "Two."], how_we_know: "x" }));
});
