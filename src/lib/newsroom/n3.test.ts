// N3 · the news, graphics and data desks' rules, each from the brief's own words: five picks a day, a 36-hour window, the earliest of a
// story's tellings, the line check, the brand tag by code (Mother Design is not Mother), THE WIRE's 24 hours and five rows, the picture
// rule (only gate-passing crops, a pair reduced to its after crop, a failed crop never usable), chart forms only where the data fits,
// the ninth checklist item on an exact brand-and-measure match, and each desk's daily limit.
import { describe, expect, it } from "vitest";
import { brandTag, enforcePicks, lineFailures, newsCandidates, pitchFor, shouldCall, wireBlock, type Candidate, type WireRow } from "./news";
import { decidePicture, formsFor, type PictureRef } from "./graphics";
import { backtest, enforceProposal, findingsOn, reconcile, scoreable, wrongWebsite } from "./datadesk";
import { DESK_LIMITS, capOf } from "./caps";
import { newsMatcher } from "../stories/candidates";
import { readFileSync } from "node:fs";
import { DESK_VERSIONS, deskGatePasses, deskScoreOf } from "./golden/versions";
import { settledValue } from "./datadesk";
import { N3_ACTORS } from "../stories/desk";

const NOW = Date.parse("2026-11-21T12:00:00Z");
const h = (hours: number) => new Date(NOW - hours * 36e5).toISOString();
const row = (id: number, title: string, hoursAgo: number, o: Partial<WireRow> = {}): WireRow => ({ id, title, url: `https://www.dezeen.com/${id}`, source: "Dezeen", source_kind: "rss", published_at: h(hoursAgo), excerpt: null, ...o });
const cand = (id: number, title: string, excerpt: string | null = null, outlet = "Dezeen"): Candidate => ({ id, title, outlet, date: "2026-11-21", excerpt, url: `https://www.dezeen.com/${id}`, seen_at: h(1) });
const m = newsMatcher([{ domain: "motherlondon.com", name: "Mother" }, { domain: "stripe.com", name: "Stripe" }], []);

describe("N3 · news desk candidates", () => {
  it("outlet items from the last 36 hours only, never picked before", () => {
    const items = [row(1, "Stripe gets a new wordmark", 2), row(2, "A chair made of cork", 40), row(3, "Show HN: a font tool", 1, { source: "Hacker News", source_kind: "hn" }), row(4, "A museum in Oslo opens", 3)];
    expect(newsCandidates(items, new Set([4]), NOW).map(c => c.id)).toEqual([1]);
  });
  it("one per story: of two tellings of the same story the earliest is kept", () => {
    const items = [row(10, "Pentagram designs new identity for the Tate Modern gallery", 5), row(11, "Pentagram designs new identity for Tate Modern gallery", 2, { source: "It's Nice That" })];
    expect(newsCandidates(items, new Set(), NOW).map(c => c.id)).toEqual([10]);
  });
  it("calls only with at least three new candidates and fewer than five picks today", () => {
    const cs = [cand(1, "a"), cand(2, "b"), cand(3, "c")];
    expect(shouldCall(cs, { lastCallAt: null, picksToday: 0 }).call).toBe(true);
    expect(shouldCall(cs.slice(0, 2), { lastCallAt: null, picksToday: 0 }).call).toBe(false);
    expect(shouldCall(cs, { lastCallAt: null, picksToday: 5 }).call).toBe(false);
  });
});

describe("N3 · the line", () => {
  const item = { title: "Stripe unveils a new wordmark drawn by Koto with a custom typeface", excerpt: "The payments company worked with studio Koto on 12 new letterforms." };
  it("passes when short, one sentence, and only the item's names and numbers", () => {
    expect(lineFailures("Koto drew Stripe a new wordmark and 12 custom letterforms.", item)).toEqual([]);
  });
  it("refuses more than 120 characters, two sentences, a number or name not in the item, and more than six words copied", () => {
    expect(lineFailures(`Stripe has a new wordmark ${"and more ".repeat(14)}.`, item).join(" ")).toContain("longer than 120");
    expect(lineFailures("Stripe has a new wordmark. Koto drew it.", item).join(" ")).toContain("more than one sentence");
    expect(lineFailures("Stripe has 14 new letterforms.", item).join(" ")).toContain("the number 14");
    expect(lineFailures("Pentagram drew Stripe a new wordmark.", item).join(" ")).toContain("Pentagram");
    expect(lineFailures("Stripe unveils a new wordmark drawn by Koto.", item).join(" ")).toContain("words in a row");
  });
});

describe("N3 · picks", () => {
  it("the brand tag is the code's whole-name matcher: Mother Design is not Mother", () => {
    expect(brandTag(m, { title: "Mother Design bats Major League Baseball into the future with five bespoke typefaces", excerpt: "Mother Design has created a new identity for MLB.", url: "https://www.itsnicethat.com/x", outlet: "It's Nice That" })).toBeNull();
    expect(brandTag(m, { title: "Stripe gets a new wordmark", excerpt: null, url: "https://www.dezeen.com/x", outlet: "Dezeen" })).toBe("stripe.com");
  });
  it("only offered items, a line that passes, and never more than five picks a day", () => {
    const cs = [1, 2, 3, 4, 5, 6].map(i => cand(i, `Studio ${i} draws a typeface for a museum`));
    const a = { picks: [...cs.map(c => ({ id: c.id, subject: "type" as const, line: `A studio drew a typeface for a museum.` })), { id: 99, subject: "web" as const, line: "Not offered." }] };
    const r = enforcePicks(a, cs, { picksToday: 2, matcher: m });
    expect(r.picks.map(p => p.item.id)).toEqual([1, 2, 3]);
    expect(r.dropped.map(d => d.reasons[0])).toEqual(expect.arrayContaining(["not a candidate", "over the 5 picks a day"]));
  });
  it("a tagged pick beside a measured change within 14 days either side is a pitch; further away it is not", () => {
    const p = { item: cand(1, "Stripe gets a new wordmark"), subject: "brand" as const, line: "x", domain: "stripe.com" };
    expect(pitchFor(p, [{ id: 7, domain: "stripe.com", type: "typography", detected_at: "2026-11-10T00:00:00Z" }], () => "Stripe")?.ref).toBe("7");
    expect(pitchFor(p, [{ id: 7, domain: "stripe.com", type: "typography", detected_at: "2026-10-30T00:00:00Z" }], () => "Stripe")).toBeNull();
  });
  it("THE WIRE shows picks from the last 24 hours, at most five, http links only, and tags only active brands", () => {
    const pick = (i: number, hoursAgo: number, o: { domain?: string | null; url?: string } = {}) => ({ pick_id: i, at: h(hoursAgo), subject: "brand", line: `Line ${i}.`, domain: o.domain ?? null, title: "t", url: o.url ?? `https://www.dezeen.com/${i}`, source: "Dezeen", published_at: h(hoursAgo + 1) });
    const rows = wireBlock([pick(1, 1, { domain: "stripe.com" }), pick(2, 2, { domain: "gone.com" }), pick(3, 25), pick(4, 3, { url: "javascript:alert(1)" }), pick(5, 4), pick(6, 5), pick(7, 6), pick(8, 7)], NOW, { active: new Set(["stripe.com"]), name: () => "Stripe" });
    expect(rows.map(r => r.id)).toEqual([1, 2, 5, 6, 7]);
    expect(rows[0]!.brand).toEqual({ domain: "stripe.com", name: "Stripe" });
    expect(rows[1]!.brand).toBeNull();
    expect(wireBlock([], NOW, { active: new Set(), name: () => "" })).toEqual([]);
  });
});

describe("N3 · graphics desk", () => {
  const ref = (r: string, asset: string, role: PictureRef["role"] = null): PictureRef => ({ ref: r, asset, src: `/crops/${asset.slice(5)}`, domain: "a.com", section: "hero", date: "2026-11-20", role, label: r });
  const ans = (pictures: { ref: string; usable: boolean }[], overall: "keep" | "use alternate 1" | "no picture shows it") => ({ pictures: pictures.map(p => ({ ...p, problem: (p.usable ? "none" : "blank") as "none" | "blank", why: "w" })), overall, why: "because" });
  it("a crop that fails the quality gate never comes back usable, whatever the check says", () => {
    const g = { chosen: [ref("c1", "crop:bad.webp")], alternates: [], failing: ["crop:bad.webp"] };
    const d = decidePicture(ans([{ ref: "c1", usable: true }], "keep"), g);
    expect(d.kind).toBe("none");
    expect(d.assets).toEqual([]);
    expect(decidePicture(null, g, "the call failed").kind).toBe("none");
  });
  it("an alternate is used only when judged usable; a pair with an unusable before keeps its own after crop", () => {
    const alt = ref("a1", "crop:alt.webp");
    expect(decidePicture(ans([{ ref: "c1", usable: false }, { ref: "a1", usable: true }], "use alternate 1"), { chosen: [ref("c1", "crop:one.webp")], alternates: [alt] }).assets).toEqual(["crop:alt.webp"]);
    const pair = [ref("c1", "crop:before.webp", "before"), ref("c2", "crop:after.webp", "after")];
    expect(decidePicture(ans([{ ref: "c1", usable: false }, { ref: "c2", usable: true }], "keep"), { chosen: pair, alternates: [alt] }).assets).toEqual(["crop:after.webp"]);
  });
  it("with no answer (a failed call or the limit used) the rule's picture stands", () => {
    expect(decidePicture(null, { chosen: [ref("c1", "crop:one.webp")], alternates: [] }, "cap used")).toMatchObject({ kind: "rule", verdict: "fallback", assets: ["crop:one.webp"] });
  });
  it("a figure gets only forms its data fits: bars or line for panels, one form for the others", () => {
    expect(formsFor({ kind: "multiples", xs: ["Q1", "Q2", "Q3", "Q4"] })).toEqual(["line", "bars"]);
    expect(formsFor({ kind: "multiples", xs: ["Q1", "Q2"] })).toEqual(["bars"]);
    expect(formsFor({ kind: "adoption" })).toHaveLength(1);
    expect(formsFor({ kind: "unknown" })).toEqual([]);
  });
});

describe("N3 · data desk", () => {
  it("the ninth checklist item matches a finding only on the exact brand and measure", () => {
    const open = [{ id: 1, kind: "contradiction", subject: "a.com", measure: "hero_media", found: "Image" }];
    expect(findingsOn(open, [{ domain: "a.com", measure: "hero_media" }])).toHaveLength(1);
    expect(findingsOn(open, [{ domain: "a.com", measure: "theme" }, { domain: "b.com", measure: "hero_media" }])).toHaveLength(0);
  });
  it("a finding a new run no longer finds is closed; a detector finding stays open until a desk closes it", () => {
    const r = reconcile([{ id: 1, key: "contradiction:a.com:theme", kind: "contradiction" }, { id: 2, key: "detector:9", kind: "detector" }], [], new Set(["contradiction", "detector"]));
    expect(r.close).toEqual([1]);
  });
  it("a brand whose title does not carry its name is a wrong-website finding unless it is allowed", () => {
    expect(wrongWebsite([{ domain: "ragged-edge.com", name: "Ragged Edge", title: "A resort", nameInTitle: false, allowed: false }, { domain: "n26.com", name: "N26", title: "Bank", nameInTitle: false, allowed: true }]).map(f => f.subject)).toEqual(["ragged-edge.com"]);
  });
  it("the backtest scores the forecast made at least 28 days earlier, once", () => {
    const runs = [{ id: 1, at: "2026-10-01T00:00:00Z" }, { id: 2, at: "2026-11-20T00:00:00Z" }];
    expect(scoreable(runs, new Set())?.then.id).toBe(1);
    expect(scoreable(runs, new Set([1]))).toBeNull();
    expect(scoreable([{ id: 1, at: "2026-11-13T00:00:00Z" }, { id: 2, at: "2026-11-16T00:00:00Z" }], new Set())).toBeNull();
    const b = backtest([{ key: "k", scope: "all", share: 0.1, proj_q1: 0.2 }], [{ key: "k", scope: "all", share: 0.15 }], 30);
    expect(b.calls).toBe(1);
    expect(b.right).toBe(1);
  });
  it("a proposal that names a measure the product does not hold is dropped", () => {
    const r = enforceProposal({ studies: [{ question: "Do banks go dark?", measure: "theme", minimum: "15 banks" }, { question: "Do logos shrink?", measure: "logo_size", minimum: "x" }], signals: [] });
    expect(r.studies.map(s => s.measure)).toEqual(["theme"]);
    expect(r.dropped[0]?.item.measure).toBe("logo_size");
  });
});

describe("N3 · limits and who may act", () => {
  it("each desk's daily limit is the brief's: news 4, graphics pictures 8 and charts 2, data 1", () => {
    expect(capOf("news", "picks")).toBe(4);
    expect(capOf("graphics", "picture")).toBe(8);
    expect(capOf("graphics", "chart")).toBe(2);
    expect(capOf("data", "proposal")).toBe(1);
    expect(DESK_LIMITS.find(l => l.desk === "standards")?.cap).toBe(12);
  });
  it("wire picks are the news desk's; drops also by standards and the editor in chief; findings are the data desk's", () => {
    expect(N3_ACTORS["wire_pick"]).toEqual(["news", "owner"]);
    expect(N3_ACTORS["wire_drop"]).toEqual(expect.arrayContaining(["news", "standards", "editor in chief"]));
    expect(N3_ACTORS["picture"]).toEqual(["graphics", "owner"]);
    expect(N3_ACTORS["finding_close"]).toEqual(expect.arrayContaining(["data", "standards", "editor in chief"]));
  });
});

describe("N3 · the tuned second reader and the settled card", () => {
  it("standards v3 passes the gate against v2 over the cases both ran (No. 43 now passes; 77, 45 and 92 still held)", () => {
    const score = (v: string) => deskScoreOf(JSON.parse(readFileSync(DESK_VERSIONS.find(x => x.desk === "standards" && x.version === v)!.score_file, "utf8")));
    const v3 = score("v3");
    expect(deskGatePasses(score("v2"), v3).ok).toBe(true);
    expect(v3.cases.filter(c => !c.right)).toEqual([]);
  });
  it("a brand card shows the newest value two consecutive captures agree on, never one unconfirmed capture", () => {
    expect(settledValue(["image", "video", "video", "image"])).toBe("video");
    expect(settledValue(["video", "video"])).toBe("video");
    expect(settledValue(["image", "video"])).toBeNull();
  });
});
