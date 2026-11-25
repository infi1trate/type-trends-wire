// V2 + V3 · Voice guide 2: the word-list refusals, the "Our read:" rules, the change-line sentences, the voice set, and no "the tape".
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { continuityLines, ourReadFailures, voiceFailures, withoutOurRead } from "./voice-guide";
import { tapeSentence } from "../tape-sentence";
import { VOICE_SET, voiceScore, voiceSetFailures } from "../newsroom/golden/voice-set";
import { bannedFailures, unquoted } from "./writer";
import { FRONT_TAPE_TITLE } from "../front/tape-block";
import { READ_TOUR_STEPS, TOUR_STEPS } from "../tour";
import { STICKER_WORD } from "../pop/rules";

const v = (body: string[], headline = "Coinbase's homepage is now for agents", deck = "The line changed.") => voiceFailures({ headline, deck, body }, { kind: "story", brands: ["Coinbase", "Netlify"], unquote: unquoted, requireShape: true });
const long = "Coinbase's biggest line used to be a head count, set large over a video of people smiling at phones in kitchens and on trains.";

describe("V2 · the word list refuses", () => {
  const cases: [string, string][] = [
    ["tracked homepages", "Entry animations are on 33 of 299 tracked homepages, from Vercel to Netlify and beyond."],
    ["moved or shifted for a change", "Coinbase moved its headline to the left of the page."],
    ["a quarter label in prose", "The share was low in Q1 2024 and has risen since then for everyone."],
    ["the count and the percentage in one sentence", "Entry animations are on 33 of 299 homepages, 11.0% of them."],
    ["a sentence that is only a count", "Five of 30."],
  ];
  for (const [name, s] of cases) it(name, () => expect(v([long, s])).toContain(`voice: ${name}`));
  it("“appeared on N of M” as the opening clause", () => expect(v(["Entry animations appeared on 33 of 299 homepages in the latest quarter."])).toContain("voice: appeared on N of M as the opening clause"));
  it("“in the latest quarter” as the opening clause", () => expect(voiceFailures({ headline: "Coinbase changed its line", deck: "In the latest quarter the line changed." }, { kind: "story", brands: [], unquote: unquoted })).toContain("voice: in the latest quarter as the opening clause"));
  it("“(AI estimate)” in a headline", () => expect(v([long], "Retool changed its look (AI estimate)")).toContain("voice: (AI estimate) in a headline"));
  it("a jab at a named brand", () => expect(v([long, "Netlify's new typeface is lazy."])).toContain("voice: a jab at a named brand: lazy"));
  it("an opening sentence that is a count", () => expect(v(["33 of 299 homepages now animate their entrances.", "Vercel is one."])).toContain("voice: the opening sentence is a count, not something seen"));
  it("more than two numbers in the opening paragraph", () => expect(v(["Open Vercel and the page arrives. Now 33 of 299 do, 5 of 30 fintech, 2 studios and 4 shops."])).toContain("voice: 4 numbers in the opening paragraph (at most 2)"));
  it("the guide's own rewrite of No. 88 passes the word list", () => expect(v(["Coinbase's biggest line used to be a head count. Sometime between 11 and 14 November it changed.", "The millions are gone and the agents have arrived."])).toEqual([]));
});

describe("V2 · “Our read:”", () => {
  const body = (last: string) => [long + " " + long, `The video behind the headline went too, swapped for a still. ${last}`];
  it("one at the end is allowed", () => expect(ourReadFailures(body("Our read: the page now speaks to software as much as to people."), { max: 1, words: 80 })).toEqual([]));
  it("two in a story are refused", () => expect(ourReadFailures(["Our read: one.", "Our read: two."], { max: 1, words: 80, lastOnly: false })).toContain("2 “Our read:” lines (at most 1)"));
  it("not as the last sentence is refused", () => expect(ourReadFailures(["Our read: it matters. Then a fact."], { max: 1, words: 80 })).toContain("“Our read:” is not the last sentence before How we know"));
  it("with a number, a date, a quotation or a person", () => {
    const f = ourReadFailures(["Our read: 3 of them did it on 11 November because the CEO said “agents”."], { max: 1, words: 80 });
    expect(f).toEqual(expect.arrayContaining(["“Our read:” with a number", "“Our read:” with a date", "“Our read:” with a quotation", "“Our read:” names a person"]));
  });
  it("none under 60 words", () => expect(ourReadFailures(["Short. Our read: it matters."], { max: 1, words: 20 })).toContain("an “Our read:” line in a piece under 60 words"));
  it("intent words pass inside it and are refused outside it", () => {
    const text = "Coinbase changed its line. Our read: it was done quietly, ahead of a launch.";
    expect(bannedFailures(withoutOurRead(text)).filter(x => x.startsWith("claim about intent"))).toEqual([]);
    expect(bannedFailures("Coinbase quietly changed its line.")).toContain("claim about intent: quietly");
  });
  it("studies and the Digest may carry three", () => expect(ourReadFailures(["Our read: this. Our read: that. Our read: the other."], { max: 3, words: 200, lastOnly: false })).toEqual([]));
});

describe("V3 · change lines as sentences, by rule", () => {
  it("example 8: Netlify's about page", () => expect(tapeSentence({ type: "type_change", before: { h1: "Figtree", body: "Instrument Sans" }, after: { h1: "Systemia", body: "Systemia" }, page_type: "about", summary: null }, "Netlify"))
    .toBe("Netlify's about page now speaks in one typeface, Systemia, where it used to use two: Figtree for headlines and Instrument Sans for text."));
  it("example 9: Rhode's buttons", () => expect(tapeSentence({ type: "layout_change", before: { cta_radius_px: "pill" }, after: { cta_radius_px: "9" }, page_type: "product", summary: null }, "Rhode"))
    .toBe("Rhode squared off its buttons a little. The pill on its product page is now a rounded rectangle."));
  it("a hero change on a homepage", () => expect(tapeSentence({ type: "layout_change", before: { hero_media: "video" }, after: { hero_media: "image" }, page_type: "home", summary: null }, "Rivian"))
    .toBe("Rivian's homepage first screen now shows a still picture, where it used to show a video."));
  it("a change type with no rule keeps the terse line", () => expect(tapeSentence({ type: "stack_change", before: {}, after: { "tech.next": true }, page_type: "home", summary: null }, "Vercel")).toBeNull());
  it("the sentence keeps every value the stored fields carry", () => {
    const s = tapeSentence({ type: "message_pivot", before: { headline: "Trusted by millions worldwide" }, after: { headline: "The trusted financial account for you and your agents" }, page_type: "home", summary: null }, "Coinbase")!;
    expect(s).toContain("Trusted by millions worldwide"); expect(s).toContain("The trusted financial account for you and your agents"); expect(s).toContain("Coinbase");
  });
});

describe("V2 · the voice set", () => {
  it("has the twelve worked examples", () => expect(VOICE_SET).toHaveLength(12));
  for (const p of VOICE_SET) it(`${p.id} · the rewrite passes`, () => expect(voiceSetFailures(p.rewrite)).toEqual([]));
  for (const p of VOICE_SET.filter(x => x.now && x.id !== "v8" && x.id !== "v9" && x.id !== "v12")) it(`${p.id} · the old text scores worse`, () => expect(voiceScore(p.now!)).toBeLessThan(voiceScore(p.rewrite)));
});

describe("V2 · continuity ledger", () => {
  const prior = [{ id: "a", number: 93, headline: "Homepages have started making an entrance", at: "2026-11-20T00:00:00Z", signal_keys: ["motion:entry"], domains: [], state: "published" },
    { id: "b", number: 12, headline: "Old", at: "2026-06-01T00:00:00Z", signal_keys: ["motion:entry"], domains: [], state: "published" }];
  it("refers back to a published story on the same signal within 90 days only", () => {
    const l = continuityLines({ id: "c", signal_keys: ["motion:entry"], domains: [] }, prior, Date.parse("2026-11-25T00:00:00Z"), d => d);
    expect(l).toHaveLength(1); expect(l[0]).toContain("No. 93");
  });
});

describe("V3 · no “the tape” in what readers see", () => {
  it("Today's section title and its link", () => {
    expect(FRONT_TAPE_TITLE).toBe("Latest changes");
    const front = readFileSync("src/components/read/FrontView.tsx", "utf8");
    expect(front).toContain("All changes →"); expect(front).not.toMatch(/The whole tape|>The tape</);
  });
  it("the tour, the sticker and the MCP descriptions", () => {
    expect(JSON.stringify([...TOUR_STEPS, ...READ_TOUR_STEPS])).not.toMatch(/\bthe tape\b/i);
    expect(STICKER_WORD.moved).toBe("Changed");
    const mcp = ["src/lib/mcp/tools/library-events.ts"].map(f => readFileSync(f, "utf8")).join("\n");
    expect(mcp.match(/description:\s*"[^"]*"/g)?.join(" ") ?? "").not.toMatch(/\bthe tape\b/i);
  });
  // Stored retirement reasons (retire.ts, withdrawn.ts) keep their words because rules match on them; the retired page rewords them.
  it("no reader-facing string literal says “the tape” anywhere in src", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync("grep -rnoiE '\"[^\"]*\\bthe tape\\b[^\"]*\"' src --include=*.ts --include=*.tsx --exclude=*.test.* || true", { encoding: "utf8" });
    const loose = out.split("\n").filter(Boolean).filter(l => !l.includes("never \\\"the tape\\\"") && !/voice-guide|stories\/writer\.ts:|stories\/retire\.ts:|digest\/withdrawn\.ts:|StoryView\.tsx:169:/.test(l));
    expect(loose).toEqual([]);
  });
});

import { rewriteFactFailures } from "./voice-guide";
import { restoreRows, V3_REASON } from "./restore";
describe("V3 · a rewrite keeps its facts, and restore brings the old text back", () => {
  const prev = { headline: "Coinbase changed its headline", deck: "Between 11 and 14 November it became “For you and your agents”.", body: ["On 11 November it read “Trusted by millions”. 16 of 162 homepages now say agents."], how_we_know: "Measured from captures on 11 and 14 November." };
  const brands = ["Coinbase", "Netlify"];
  it("the same numbers, dates and brands pass, even when fewer are written", () => expect(rewriteFactFailures(prev, { ...prev, headline: "Coinbase's homepage is now for you and your agents", body: ["Coinbase's line changed between 11 and 14 November, the same shift as No. 89."] }, brands)).toEqual([]));
  it("a changed number is refused", () => expect(rewriteFactFailures(prev, { ...prev, body: ["17 of 162 homepages now say agents."] }, brands)).toContain("rewrite changes a number: 17"));
  it("a changed date is refused", () => expect(rewriteFactFailures(prev, { ...prev, deck: "On 12 November it changed." }, brands)).toContain("rewrite changes a date: 12 Nov"));
  it("an added or dropped brand is refused", () => {
    expect(rewriteFactFailures(prev, { ...prev, body: ["Netlify did it too."] }, brands)).toContain("rewrite adds a brand: Netlify");
    expect(rewriteFactFailures(prev, { headline: "A homepage changed its line", deck: "It changed.", body: [], how_we_know: "" }, brands)).toContain("rewrite drops a brand: Coinbase");
  });
  const v = (n: number, h: string, at: string, model = "openai/gpt-6.2-astra") => ({ story_id: "s1", version: n, headline: h, deck: "d", body: ["b"], how_we_know: "h", created_at: at, model, checked: true });
  const ask = [{ story_id: "s1", at: "2026-11-25T05:00:00Z", reason: V3_REASON }];
  it("restore stores the text from before the V3 request again as the newest version", () => {
    const r = restoreRows([v(1, "Old", "2026-11-20T00:00:00Z"), v(2, "New voice", "2026-11-25T06:00:00Z")], ask);
    expect(r).toHaveLength(1); expect(r[0]).toMatchObject({ story_id: "s1", version: 3, headline: "Old", model: "restore" });
  });
  it("nothing to restore before the rewrite has happened, or after a restore", () => {
    expect(restoreRows([v(1, "Old", "2026-11-20T00:00:00Z")], ask)).toEqual([]);
    expect(restoreRows([v(1, "Old", "2026-11-20T00:00:00Z"), v(2, "New voice", "2026-11-25T06:00:00Z"), v(3, "Old", "2026-11-25T07:00:00Z", "restore")], ask)).toEqual([]);
  });
  it("a request that is not V3 is never restored", () => expect(restoreRows([v(1, "Old", "2026-11-20T00:00:00Z"), v(2, "New", "2026-11-25T06:00:00Z")], [{ ...ask[0]!, reason: "standards: fix the deck" }])).toEqual([]));
});
describe("V3 · a change seen on several pages", () => {
  it("names the pages and agrees in number", () => expect(tapeSentence({ type: "type_change", before: { h1: "Figtree", body: "Instrument Sans" }, after: { h1: "Systemia", body: "Systemia" }, page_type: "home", summary: null }, "Netlify", ["home page", "about page"]))
    .toBe("Netlify's homepage and about page now speak in one typeface, Systemia, where they used to use two: Figtree for headlines and Instrument Sans for text."));
});
