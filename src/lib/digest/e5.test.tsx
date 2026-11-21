// E5 · The Digest as one argument a week: cover choice, week membership, the five rows and the quiet line, pictures, the chart, the
// word budget, the digest writer's check and fallback, corrections names, the archive, a week with no story, the brief's event list.
import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DIGEST_WORDS, archiveLine, archiveRows, briefEventDomains, chooseText, closedWeeks, corrections, coverOf, editionParts, finishEdition, fiveRows, issueWords,
  namesList, nextIssue, pickChart, pickPictures, quietLine, trimWords, weekStories, withdrawnBrands, withdrawnBriefLine,
  type DigestTextRow, type EditionRows, type EditionStory, type Picture,
} from "./edition";
import { checkDigestText, chartNote, digestHash, digestSheet, issueOf, listsThree, namesSubject, parseDigest, type DigestSheet, type DigestWritten } from "./writer";
import { owed, planFor, writeDigests, type DigestIO, type DigestMeta } from "./writer.server";
import { withdrewChange } from "./withdrawn";
import { briefEvents } from "../forecast-brief";
import { EditionView } from "@/components/digest/EditionView";
import type { Crop } from "../crops";

const W46 = "2026-W46";
let n = 100;
const story = (o: Partial<EditionStory> = {}): EditionStory => ({ id: `move:${n}`, number: n++, type: "move", basis: "measured", score: 50, happened_at: "2026-11-12T10:00:00+00:00",
  kicker: "Move · Coinbase", headline: "Coinbase drops the video from its first screen", deck: "Hero, video to still (between 11 and 14 Nov).", body: ["Coinbase replaced its hero video with a still between 11 and 14 Nov."],
  domains: ["coinbase.com"], sector: "fintech", signal_keys: ["ai_positioning:ai_core"], facts: [{ text: "Hero, video to still (between 11 and 14 Nov)", kind: "line" }], ...o });
const crop = (d: string): Crop => ({ domain: d, section: "hero", sectionName: "Hero", captured_at: "2026-11-14T00:00:00Z", last_seen_at: "2026-11-14T00:00:00Z", hash: "abcd", src: `/crops/${d}/hero/2026-11-14-abcd1234.webp`, width: 1280, height: 800, alt: `${d} hero`, live: `https://${d}`, report: "/what-we-show#ed-w-images" } as unknown as Crop);
const series = [{ q: "2021Q1", s: 0.04, n: 120 }, { q: "2022Q1", s: 0.1, n: 130 }, { q: "2023Q1", s: 0.2, n: 140 }, { q: "2026Q4", s: 0.292, n: 280 }];
const rows = (o: Partial<EditionRows> = {}): EditionRows => ({ week: W46, stories: [], retired: [], pictures: {}, series: { "ai_positioning:ai_core": series }, numbers: { brands: 300, confirmed: 16, unconfirmed: 35, ledger: null }, texts: [], study: { href: "/data/x", headline: "Software homepages put AI up front" }, ...o });

describe("week membership", () => {
  it("keeps stories dated inside the closed week, compared as times (stored +00:00 and ISO Z alike), and never a launch", () => {
    const inside = story({ id: "a", happened_at: "2026-11-15T23:59:59+00:00" }), atEnd = story({ id: "b", happened_at: "2026-11-16T00:00:00+00:00" }), before = story({ id: "c", happened_at: "2026-11-08T23:00:00Z" }), launch = story({ id: "d", type: "launch" });
    expect(weekStories(W46, [inside, atEnd, before, launch]).map(s => s.id)).toEqual(["a"]);
  });
  it("a week with no published story has no issue", () => {
    expect(editionParts(rows({ stories: [story({ happened_at: "2026-11-20T00:00:00Z" })] }))).toBeNull();
    expect(issueOf(rows())).toBeNull();
  });
});

describe("the cover", () => {
  it("is the highest-ranked measured brand move, rebrand, census or roundup, never an AI-read piece while one exists", () => {
    const ai = story({ id: "white_space:x", type: "white_space", basis: "ai", score: 95 }), breakout = story({ id: "breakout:x", type: "breakout", basis: "measured", score: 90 });
    const move = story({ id: "move:1", score: 40 }), rebrand = story({ id: "rebrand:1", type: "rebrand", score: 60 });
    expect(coverOf([ai, breakout, move, rebrand])?.id).toBe("rebrand:1");
  });
  it("ties go to the newer story, then the lower number", () => {
    const a = story({ id: "move:a", score: 50, number: 9, happened_at: "2026-11-12T00:00:00Z" }), b = story({ id: "move:b", score: 50, number: 8, happened_at: "2026-11-13T00:00:00Z" }), c = story({ id: "move:c", score: 50, number: 7, happened_at: "2026-11-13T00:00:00Z" });
    expect(coverOf([a, b, c])?.id).toBe("move:c");
  });
  it("with no measured move, a story not read by our AI; with nothing measured, an AI-read piece", () => {
    const ai = story({ id: "white_space:x", type: "white_space", basis: "ai", score: 95 }), breakout = story({ id: "breakout:x", type: "breakout", score: 20 });
    expect(coverOf([ai, breakout])?.id).toBe("breakout:x");
    expect(coverOf([ai])?.id).toBe("white_space:x");
  });
});

describe("the five rows and the quiet week", () => {
  it("the cover first, then rank, at most five", () => {
    const s = [1, 2, 3, 4, 5, 6, 7].map(i => story({ id: `breakout:${i}`, type: "breakout", score: 10 * i })), cover = story({ id: "move:cover", score: 5 });
    const r = fiveRows([...s, cover]);
    expect(r).toHaveLength(5);
    expect(r[0]!.id).toBe("move:cover");
    expect(r.slice(1).map(x => x.id)).toEqual(["breakout:7", "breakout:6", "breakout:5", "breakout:4"]);
  });
  it("fewer than three stories add the plain line", () => {
    expect(quietLine(2, 16)).toBe("A quiet week: 16 confirmed changes.");
    expect(quietLine(1, 1)).toBe("A quiet week: 1 confirmed change.");
    expect(quietLine(3, 16)).toBeNull();
  });
});

describe("pictures and the chart", () => {
  it("up to three pictures, the cover's first, a pair counting as one, each kept with its row", () => {
    const r = [1, 2, 3, 4, 5].map(i => story({ id: `move:p${i}` }));
    const pics: Record<string, Picture> = { "move:p1": { kind: "pair", before: crop("a.com"), after: crop("a.com") }, "move:p3": { kind: "one", crop: crop("c.com") }, "move:p4": { kind: "one", crop: crop("d.com") }, "move:p5": { kind: "one", crop: crop("e.com") } };
    expect([...pickPictures(r, pics).keys()]).toEqual(["move:p1", "move:p3", "move:p4"]);
  });
  it("the cover's signal first; else the next row with three well-covered quarters; else no chart", () => {
    const a = story({ id: "a", signal_keys: ["x:short"] }), b = story({ id: "b", signal_keys: ["ai_positioning:ai_core"] });
    const s = { "x:short": series.slice(0, 2), "ai_positioning:ai_core": series };
    expect(pickChart([a, b], s)?.storyId).toBe("b");
    expect(pickChart([b, a], s)?.storyId).toBe("b");
    expect(pickChart([a], s)).toBeNull();
    expect(pickChart([story({ signal_keys: [] })], s)).toBeNull();
  });
  it("the chart's note says the step into the live quarter spans years", () => {
    expect(chartNote(series)).toMatch(/Q1 2023 to Q4 2026 covers several years/);
    expect(chartNote([{ q: "2026Q1" }, { q: "2026Q2" }])).toBeNull();
  });
});

describe("corrections", () => {
  it("names: the brief's cited brands plus retired stories' brands, minus every brand with a published story, in order, once", () => {
    const names = withdrawnBrands({ briefDomains: ["dropbox.com", "calendly.com", "coinbase.com"], retired: [{ domains: ["docusign.com"] }, { domains: ["dropbox.com"] }], published: [story()] });
    expect(names).toEqual(["dropbox.com", "calendly.com", "docusign.com"]);
  });
  it("at most six names, then 'and N more'", () => {
    expect(namesList(["a.com", "b.com"])).toMatch(/ and /);
    const many = ["dropbox.com", "calendly.com", "krea.ai", "docusign.com", "hubspot.com", "discord.com", "spotify.com", "box.com"];
    expect(namesList(many)).toMatch(/ and 2 more$/);
    expect(namesList(many).split(", ")).toHaveLength(6);
  });
  it("the line, dated, only when needed", () => {
    expect(corrections([], "2026-11-20")).toBeNull();
    expect(corrections(["dropbox.com"], "2026-11-20")!.text).toMatch(/^Corrections: this issue was rebuilt on 20 November 2026\. The first version reported changes at .+ that are not confirmed stories\.$/);
  });
  it("No. 1 carries the stored brief's withdrawn brands; a later issue only retirements after its week closed", () => {
    const brief = { sections: [{ citations: [{ kind: "event", id: "1" }, { kind: "forecast", id: "x" }] }], refs: { "event:1": { domain: "dropbox.com" } } };
    expect(briefEventDomains(brief)).toEqual(["dropbox.com"]);
    const p1 = editionParts(rows({ stories: [story()], briefDomains: ["dropbox.com"] }))!;
    expect(p1.base.corrections?.text).toMatch(/Dropbox/);
    expect(p1.base.briefWithdrawn).toBe(1);
    const w47 = (o: Partial<EditionRows>) => editionParts(rows({ week: "2026-W47", stories: [story({ happened_at: "2026-11-18T00:00:00Z" })], ...o }))!;
    expect(w47({ briefDomains: ["dropbox.com"] }).base.corrections).toBeNull();
    const ret = (at: string) => ({ id: "r", number: 9, domains: ["docusign.com"], happened_at: "2026-11-18T00:00:00Z", retired_at: at });
    expect(w47({ retired: [ret("2026-11-20T00:00:00+00:00")] }).base.corrections).toBeNull();
    expect(w47({ retired: [ret("2026-11-24T10:00:00+00:00")] }).base.corrections?.text).toMatch(/rebuilt on 24 November 2026.*DocuSign/);
  });
  it("only retirements that withdrew a change count (not a tape line, a fold or a desk hold)", () => {
    expect(withdrewChange({ type: "move", domains: ["a.com"], killReason: "Retired: reversed within seven days" })).toBe(true);
    expect(withdrewChange({ type: "move", domains: ["a.com"], killReason: "Retired: the headline is one slide of a carousel" })).toBe(true);
    expect(withdrewChange({ type: "move", domains: ["a.com"], killReason: "Retired: now a tape line" })).toBe(false);
    expect(withdrewChange({ type: "counter_move", domains: ["a.com"], killReason: "Retired: held for the weekly counter-move roundup" })).toBe(false);
    expect(withdrewChange({ type: "breakout", domains: ["a.com"], killReason: "Retired: reversed within seven days" })).toBe(false);
  });
  it("the terminal's brief line", () => {
    expect(withdrawnBriefLine(5)).toBe("5 changes cited here are not confirmed stories. See the Digest for the corrected week.");
    expect(withdrawnBriefLine(1)).toBe("1 change cited here is not a confirmed story. See the Digest for the corrected week.");
  });
});

describe("the archive and the calendar", () => {
  it("one row per issue, newest first: No. N · dates · written headline", () => {
    const a = archiveRows([{ week: "2026-W46", number: 1, dates: { start: "", end: "", label: "9–15 November 2026" }, headline: "Scroll-driven animation spread" }, { week: "2026-W47", number: 2, dates: { start: "", end: "", label: "16–22 November 2026" }, headline: "Coinbase drops its video" }]);
    expect(a.map(archiveLine)).toEqual(["No. 2 · 16–22 November 2026 · Coinbase drops its video", "No. 1 · 9–15 November 2026 · Scroll-driven animation spread"]);
  });
  it("only closed weeks, and the next issue appears the Monday after the following week", () => {
    expect(closedWeeks(Date.parse("2026-11-20T12:00:00Z"), W46)).toEqual([W46]);
    expect(closedWeeks(Date.parse("2026-11-23T00:00:00Z"), W46)).toEqual(["2026-W47", W46]);
    expect(nextIssue(W46)).toEqual({ number: 2, monday: "2026-11-23" });
  });
});

describe("the fallback and the word budget", () => {
  const cover = story({ deck: "Hero, video to still (between 11 and 14 Nov); headline, “Trusted by millions worldwide” to “The trusted financial account for you and your agents” (between 11 and 14 Nov)." });
  it("trims a deck to 28 words at a sentence or clause end", () => {
    expect(trimWords(cover.deck!)).toBe("Hero, video to still (between 11 and 14 Nov).");
    expect(trimWords("11 of 229 tracked homepages whose headline or buttons we can read show a sale in two captures at least six hours apart: Allbirds, Headspace, Ilia, Equinox, Brooklinen, Vuori.")).toBe("11 of 229 tracked homepages whose headline or buttons we can read show a sale in two captures at least six hours apart.");
    expect(trimWords("Short deck.")).toBe("Short deck.");
  });
  it("is complete with no model call: the cover's headline and deck, its opening, one sentence per row, no use", () => {
    const e = finishEdition(editionParts(rows({ stories: [cover, story({ id: "move:2", domains: ["netlify.com"] })] }))!, "h", []);
    expect(e.text.source).toBe("fallback");
    expect(e.text.headline).toBe(cover.headline);
    expect(e.text.argument).toEqual(cover.body.slice(0, 1));
    expect(e.rows.every(r => r.sentence.length > 0)).toBe(true);
    expect(e.text.use).toBeNull();
    expect(e.words).toBeLessThanOrEqual(DIGEST_WORDS);
  });
  it("counts every reader-visible field in parts 1 to 8", () => {
    expect(issueWords({ headline: "a b", deck: "c", argument: ["d e f"], changes: ["g"], chart_caption: "h i", use: "j" }, { numbers: "k l", corrections: "m", quiet: null })).toBe(13);
  });
  it("renders a finished page on the fallback", async () => {
    const e = finishEdition(editionParts(rows({ stories: [cover, story({ id: "move:2" })], pictures: { [cover.id]: { kind: "one", crop: crop("coinbase.com") } } }))!, "h", []);
    const html = await page(() => createElement(EditionView, { issue: e, latest: true }));
    expect(html).toContain(cover.headline);
    expect(html).toContain("Report this image");
    expect(html).toContain("Next issue: No. 2");
    expect(html).toContain("Keep reading");
    for (const gone of ["In this issue", "Why it matters", "The Movers", "Seen in the wild", "Rebrands of the week", "Explainer"]) expect(html).not.toContain(gone);
  });
  it("serves the newest passed text for this sheet, else an older passed one dated, else the fallback", () => {
    const p = editionParts(rows({ stories: [cover] }))!, t = (o: Partial<DigestTextRow>): DigestTextRow => ({ week: W46, facts_hash: "now", headline: "Coinbase drops the video", deck: "d", argument: ["a"], changes: ["c"], chart_caption: null, use_text: "u", model: "m", passed: true, checked_at: "2026-11-21T00:00:00Z", created_at: "2026-11-21T00:00:00Z", ...o });
    expect(chooseText([t({ facts_hash: "old", headline: "Old" }), t({ created_at: "2026-11-20T00:00:00Z" })], "now", 1, p.fallback).headline).toBe("Coinbase drops the video");
    const stale = chooseText([t({ facts_hash: "old", headline: "Old" })], "now", 1, p.fallback);
    expect([stale.headline, stale.stale]).toEqual(["Old", true]);
    expect(chooseText([t({ passed: false, checked_at: null })], "now", 1, p.fallback).source).toBe("fallback");
    expect(chooseText([t({ changes: ["a", "b"] })], "now", 1, p.fallback).source).toBe("fallback");
  });
});

async function page(el: () => ReactElement) {
  const router = createRouter({ routeTree: createRootRoute({ component: el }), history: createMemoryHistory({ initialEntries: ["/digest"] }) });
  await router.load();
  return renderToString(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(RouterProvider, { router } as never)));
}

describe("the digest writer's check", () => {
  const stories = [story({ id: "move:c1", number: 88 }), story({ id: "move:c2", number: 85, domains: ["netlify.com"], kicker: "Rebrand · Netlify", type: "rebrand", deck: "Headline font, Figtree to Systemia (between 14 and 20 Nov).", facts: [] }), story({ id: "move:c3", number: 87, type: "roundup", domains: ["venmo.com", "cohere.com"], kicker: "Roundup · Against the grain", deck: "Venmo and Cohere, between 11 and 20 Nov.", facts: [] })];
  const p = editionParts(rows({ stories }))!, sheet: DigestSheet = digestSheet(p), subject = p.base.cover.terms, known = { names: ["Coinbase", "Netlify", "Venmo", "Cohere", "Stripe"] };
  const para = "Coinbase replaced its hero video with a still between 11 and 14 Nov. Netlify changed its headline font from Figtree to Systemia between 14 and 20 Nov. Venmo and Cohere moved the other way between 11 and 20 Nov. ";
  const good: DigestWritten = { headline: "Netlify resets its type as Coinbase drops video", deck: "Coinbase swapped motion for a still image between 11 and 14 Nov, as Netlify reset its type.",
    argument: [para.repeat(2).trim(), para.repeat(2).trim()], changes: ["Coinbase replaced its hero video with a still between 11 and 14 Nov.", "Netlify changed its headline font from Figtree to Systemia between 14 and 20 Nov.", "Venmo and Cohere moved the other way between 11 and 20 Nov."],
    chart_caption: "AI as the product: 4.0% of tracked homepages in Q1 2021, 29.2% in Q4 2026.", use: "A fintech team weighing hero video can treat a still as the safer choice if its own pages already carry motion elsewhere." };
  const f = (t: Partial<DigestWritten>) => checkDigestText({ ...good, ...t }, sheet, subject, known);
  it("accepts a correct text", () => expect(f({}), JSON.stringify(f({}))).toEqual([]));
  it("the headline names the cover's subject", () => { expect(namesSubject("Coinbase trades its video", ["Coinbase"])).toBe(true); expect(f({ headline: "Fintech homepages trade video for stills" }).join()).toMatch(/does not name the cover/); });
  it("a sector is named only when a story on the sheet is in it", () => expect(f({ use: "Health brands weighing hero video can treat a still as the safer choice." }).join()).toMatch(/sector not on the sheet/));
  it("never lists three things joined by commas and 'and'", () => { expect(listsThree("Coinbase, Netlify, and the end of motion")).toBe(true); expect(listsThree("Coinbase and Netlify reset")).toBe(false); expect(f({ headline: "Netlify type, Coinbase stills and Venmo" }).join()).toMatch(/lists three things/); });
  it("no claim about a signal's future without a forecast call", () => expect(f({ use: "Hero video will fade from fintech homepages if Coinbase holds." }).join()).toMatch(/future without a forecast call: will/));
  it("rejects a number, a brand or a quarter not on the sheet", () => {
    expect(f({ deck: "Coinbase swapped motion for a still on 41% of its pages." }).join()).toMatch(/number not on the sheet: 41/);
    expect(f({ deck: "Coinbase swapped motion for a still, as Stripe did." }).join()).toMatch(/brand not on the sheet: Stripe/);
    expect(f({ chart_caption: "AI as the product: 4.0% in Q2 2021, 29.2% in Q4 2026." }).join()).toMatch(/quarter not on the sheet/);
  });
  it("rejects a cause the sheet does not mark measured and an unranked superlative", () => {
    expect(f({ deck: "Coinbase swapped motion for a still because video slowed the page." }).join()).toMatch(/causal claim: because/);
    expect(f({ deck: "Coinbase made the biggest change of the week." }).join()).toMatch(/superlative the sheet does not carry: biggest/);
  });
  it("rejects each length bound and a question", () => {
    expect(f({ headline: "Netlify resets" }).join()).toMatch(/headline has 2 words/);
    expect(f({ argument: [para] }).join()).toMatch(/argument has 1 paragraphs/);
    expect(f({ changes: good.changes.slice(0, 2) }).join()).toMatch(/changes has 2 sentences/);
    expect(f({ use: "x ".repeat(46).trim() + "." }).join()).toMatch(/use has 46 words/);
    expect(f({ deck: "Did Coinbase drop its video between 11 and 14 Nov?" }).join()).toMatch(/question/);
  });
  it("rejects a text that would push the issue past 600 words", () => expect(checkDigestText(good, { ...sheet, fixed_words: 560 }, subject, known).join()).toMatch(/at most 600/));
  it("parses the model's JSON and strips markdown", () => expect(parseDigest(JSON.stringify({ ...good, headline: "**Coinbase** trades its hero video for a still." }))?.headline).toBe("Coinbase trades its hero video for a still"));
  it("the fingerprint ignores the numbers line, so settling counts never ask for a new text", () => expect(digestHash({ ...sheet, numbers: "other" })).toBe(digestHash(sheet)));
});

describe("when the digest writer runs", () => {
  const now = Date.parse("2026-11-21T06:00:00Z"), meta = (o: Partial<DigestMeta>): DigestMeta => ({ week: W46, facts_hash: "h", passed: false, created_at: "2026-11-20T06:00:00Z", attempts: 1, failures: [], log: [], ...o });
  it("once after the week closes, again only for a new sheet, within fourteen days", () => {
    expect(owed({ week: W46, hash: "h" }, [], now)).toBe(true);
    expect(owed({ week: "2026-W47", hash: "h" }, [], now)).toBe(false);
    expect(owed({ week: W46, hash: "h" }, [], Date.parse("2026-12-01T00:00:00Z"))).toBe(false);
    expect(owed({ week: W46, hash: "h" }, [meta({ passed: true })], now)).toBe(false);
    expect(owed({ week: W46, hash: "new" }, [meta({ passed: true })], now)).toBe(true);
    expect(owed({ week: W46, hash: "h" }, [meta({ created_at: "2026-11-21T01:00:00Z", attempts: 2 })], now)).toBe(true);
  });
  it("the shared plan carries across days for one sheet: writer, writer with failures, text model, then the fallback", () => {
    expect(planFor(0)).toHaveLength(3);
    expect(planFor(2)).toHaveLength(1);
    expect(planFor(3)).toHaveLength(0);
    expect(owed({ week: W46, hash: "h" }, [meta({ attempts: 3 })], now)).toBe(false);
  });
  it("at most two calls a day, then the fallback is stored unpassed", async () => {
    const inserted: unknown[] = [], calls: string[] = [];
    const io: DigestIO = { metas: async () => [], runs: () => true, call: async m => { calls.push(m); return { raw: "{}", cost: 0.01 }; }, insert: async r => { inserted.push(r); return true; } };
    const job = { week: W46, sheet: digestSheet(editionParts(rows({ stories: [story()] }))!), hash: "h", subject: ["Coinbase"], fallback: { headline: "H", deck: "D", argument: ["A"], changes: ["C"], chart_caption: "", use: "" } };
    const r = await writeDigests([job], io, { names: [] }, { deadline: now + 120_000, now: () => now });
    expect(r.calls).toBe(2);
    expect(calls).toHaveLength(2);
    expect((inserted[0] as { passed: boolean; model: string }).passed).toBe(false);
    expect((inserted[0] as { model: string }).model).toBe("template");
  });
});

describe("the weekly brief's changes (Part 4)", () => {
  it("only published-story sources or integrity-passed changes, never rotating ones, in order, at most twenty", () => {
    const ev = [1, 2, 3, 4, 5].map(id => ({ id }));
    expect(briefEvents(ev, { storyEvents: new Set([1]), confirmed: new Set([2, 3]), rotating: new Set([3]) }).map(e => e.id)).toEqual([1, 2]);
    expect(briefEvents(Array.from({ length: 30 }, (_, i) => ({ id: i })), { storyEvents: new Set(Array.from({ length: 30 }, (_, i) => i)), confirmed: new Set(), rotating: new Set() })).toHaveLength(20);
  });
});
