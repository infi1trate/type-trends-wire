// Phase E2a · the editor's call: names, three tiers, grouping. Rules from the owner's brief, one test each.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EventRow } from "../agency/changes";
import type { SignalRow } from "../signals";
import { BRAND_SEED } from "../brands/seed.gen";
import { brandName, hasBareDomain, nameText, parseSeed, seedModule, siteKind, tidyDomain } from "../brand-names";
import { tapeLine } from "../tape";
import { promoSignal } from "../promo";
import { callHeadline, parseCall, ruleCall } from "./headline-call";
import { context, type BuildInput } from "./candidates";
import { brandFolds, brandGroups, brandStory, changeOf, isTypefaceChange, notApplicable, shifts, SHIFT_BRIEF_REASON, type ShownStory } from "./editor";
import { DAILY_CAP, SINGLE_BRAND_DAILY_CAP, planStories, type ScoreCtx } from "./score";
import type { Candidate } from "./types";
import { e2Plan, E2_FOLD_NOTE } from "./retire";

const D = 864e5, T0 = Date.parse("2026-11-11T12:00:00Z");
const at = (days: number) => new Date(T0 + days * D).toISOString();
const ev = (id: number, domain: string, type: string, before: Record<string, unknown>, after: Record<string, unknown>, days: number): EventRow =>
  ({ id, domain, sector: "enterprise-saas", type, before, after, detected_at: at(days), source: "live", page_type: "home", viewport: "desktop" });
const row = (key: string, scope: string, o: Partial<SignalRow> = {}): SignalRow => ({ dimension: key.split(":")[0]!, value: key.split(":")[1]!, scope, status: "ok", stage: "accelerating", momentum: 1, current_share: 0.2, next_wave_score: 1, sites: 20, ...o });
const input = (o: Partial<BuildInput> = {}): BuildInput => ({ now: at(10), events: [], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], sites: [], runs: [], ...o });
const sctx: ScoreCtx = { tierOf: () => "headline", rankOf: () => 1, tracked: () => true, covered: () => true, shareOf: () => 0.3 };
const cand = (o: Partial<Candidate>): Candidate => ({ id: "x", type: "roundup", kicker: "k", headline: "h", deck: null, facts: [], sector: null, signalKeys: [], domains: ["a.com", "b.com", "c.com"], evidence: [], sourceIds: [], basis: "measured", happenedAt: at(0), magnitude: 5, ...o });

describe("Part 1 · brand names and site kinds", () => {
  const seed = parseSeed(readFileSync("src/lib/brands/seed.tsv", "utf8"));
  it("every one of the 300 seeded domains has a name and a kind (49 merchandised, 29 editorial)", () => {
    expect(seed).toHaveLength(300);
    for (const r of seed) { expect(brandName(r.domain)).toBe(r.name); expect(siteKind(r.domain)).toBe(r.kind); }
    expect(seed.filter(r => r.kind === "merchandised")).toHaveLength(49); expect(seed.filter(r => r.kind === "editorial")).toHaveLength(29);
  });
  it("the generated seed module matches the committed seed file", () => expect(`${BRAND_SEED.length}`).toBe(`${seed.length}`) );
  it("the generated module is exactly what the generator writes", () => expect(readFileSync("src/lib/brands/seed.gen.ts", "utf8")).toBe(seedModule(seed)));
  it("a domain without a name reads as its tidy form; a stored name wins", () => {
    expect(brandName("acme-labs.io")).toBe("Acme-labs"); expect(tidyDomain("shop.example.co.uk")).toBe("Example");
    expect(brandName("docusign.com", "Docusign Inc")).toBe("Docusign Inc"); expect(brandName("docusign.com", null)).toBe("DocuSign");
  });
  it("reader text names brands; links, paths and mail addresses keep the domain", () => {
    expect(nameText("docusign.com changed its accent")).toBe("DocuSign changed its accent");
    expect(nameText("see https://docusign.com/x or hi@docusign.com")).toBe("see https://docusign.com/x or hi@docusign.com");
    expect(hasBareDomain("Rivian · hero, video to still · 11 Nov")).toBe(false);
  });
  it("a tape line is name · what changed, from and to · date · label", () =>
    expect(tapeLine(ev(1, "rivian.com", "layout_change", { hero_media: "video" }, { hero_media: "image" }, 0))).toBe("Rivian · hero, video to still · 11 Nov"));
  it("merchandised and editorial homepages count only typeface and alignment toward a story", () => {
    expect(changeOf(ev(1, "amazon.com", "palette_shift", { accent: "#000000" }, { accent: "#FF0000" }, 0), "merchandised", null).dims).toEqual([]);
    expect(changeOf(ev(2, "newyorker.com", "layout_change", { hero_media: "video" }, { hero_media: "none" }, 0), "editorial", null).dims).toEqual([]);
    expect(changeOf(ev(3, "gopro.com", "type_change", { h1: "Söhne Breit" }, { h1: "Akkurat" }, 0), "merchandised", null).typeface).toBe(true);
  });
});

describe("Part 2 · headline calls", () => {
  const never = () => { throw new Error("the model must not be called"); };
  it("the rule pass classifies a sale line and a model-number change without calling the model", async () => {
    expect((await callHeadline("Movement that takes you far", "Up to $1,300 off Peloton equipment*", never, "m")).call).toBe("promotion");
    expect((await callHeadline("iPhone 12", "iPhone 13 Pro", never, "m")).call).toBe("product_rotation");
    expect(ruleCall("Leica Cine Play 1", "Leica M11-P & M-A Hammertone")?.call).toBe("product_rotation");
    expect(ruleCall("Build demand, win deals, and delight customers", "HubSpot: The Customer Relationship Harness")).toBeNull();
  });
  it("“deals” is a promotion except after a sales-pipeline verb", () => {
    for (const t of ["Black Friday deals", "Shop deals", "Deals of the day"]) expect(promoSignal(t), t).not.toBeNull();
    for (const t of ["Build demand, win deals, and delight customers", "Close more deals faster"]) expect(promoSignal(t), t).toBeNull();
  });
  it("a headline that is only the company's name is unclear", () => expect(ruleCall("Your last next editor", "Zed Industries", "Zed")?.call).toBe("unclear"));
  it("a model failure yields unclear, never position", async () => {
    expect((await callHeadline("AI-powered agreement management", "Everything you need to agree", () => Promise.reject(new Error("down")), "m")).call).toBe("unclear");
    expect((await callHeadline("A", "B", () => Promise.resolve(null), "m")).call).toBe("unclear");
    expect(parseCall("{not json", "m").call).toBe("unclear"); expect(parseCall({ call: "position" }, "m").call).toBe("unclear");
    expect(parseCall({ call: "position", reason: "It now says it is a CRM." }, "m").call).toBe("position");
  });
  it("only a typeface family change counts: not a weight, width or fallback", () => {
    expect(isTypefaceChange("Roobert PRO", "Apris")).toBe(true); expect(isTypefaceChange("Futura PT", "Akkurat LL")).toBe(true);
    expect(isTypefaceChange("Söhne Breit Extrafett", "Söhne Schmal")).toBe(false); expect(isTypefaceChange("Sharp Grotesk DB Cyr Book 23", "Sharp Grotesk DB Cyr Book 20")).toBe(false);
    expect(isTypefaceChange("Inter", "Arial")).toBe(false);
  });
});

describe("Part 2 · caps", () => {
  it(`six qualifying candidates on one day publish ${DAILY_CAP}`, () => {
    const six = Array.from({ length: 6 }, (_, i) => cand({ id: `roundup:all:k${i}`, signalKeys: [`imagery:k${i}`], domains: [`a${i}.com`, `b${i}.com`, `c${i}.com`] }));
    expect(planStories(six, [], sctx).filter(p => p.status === "published")).toHaveLength(5);
  });
  it(`four single-brand candidates publish ${SINGLE_BRAND_DAILY_CAP}`, () => {
    const four = Array.from({ length: 4 }, (_, i) => cand({ id: `brand:b${i}.com:2026-11-11`, type: "move", domains: [`b${i}.com`], magnitude: 4 }));
    const p = planStories(four, [], sctx);
    expect(p.filter(x => x.status === "published")).toHaveLength(3); expect(p.find(x => x.status === "held")?.reason).toContain("single-brand");
  });
  it("a killed story no longer uses up the day", () => {
    const one = cand({ id: "brand:n.com:2026-11-11", type: "move", domains: ["n.com"], magnitude: 4 });
    const killed = [0, 1, 2].map(i => ({ id: `old${i}`, type: "move" as const, status: "published" as const, state: "killed" as const, score: 90, happened_at: at(0), domains: [`k${i}.com`], signal_keys: [], sector: null }));
    expect(planStories([one], killed, sctx)[0]!.status).toBe("published");
  });
});

describe("Part 3 · one brand, one story", () => {
  const calls = { 2: { call: "position", reason: "It now says what it is." } };
  const ctx = context(input());
  const story = (events: EventRow[]) => brandGroups(events.map(e => changeOf(e, "standard", (calls as Record<number, { call: string }>)[e.id]?.call as never ?? null))).filter(g => g.qualifiedAt).map(g => brandStory(ctx, g, calls));
  const first = [ev(1, "x.com", "palette_shift", { accent: "#2B0673" }, { accent: "#4C00FF" }, 0), ev(2, "x.com", "message_pivot", { headline: "Old claim" }, { headline: "New claim" }, 0)];
  const ran = story(first)[0]!;
  const shown: ShownStory = { id: ran.id, type: ran.type, state: "published", happened_at: ran.happenedAt, domains: ran.domains, headline: ran.headline, deck: ran.deck, facts: ran.facts, source_ids: ran.sourceIds };
  it("a second change inside seven days appends a correction and publishes nothing new", () => {
    const later = story([...first, ev(3, "x.com", "layout_change", { hero_media: "none" }, { hero_media: "image" }, 3)]);
    expect(later).toHaveLength(1); expect(later[0]!.id).toBe(ran.id);
    const { folds } = brandFolds(later, [shown], at(3));
    expect(folds).toHaveLength(1); expect(folds[0]!.story_id).toBe(ran.id); expect(folds[0]!.note).toMatch(/^Updated 14 Nov: added hero/);
    const stored = [{ id: ran.id, type: ran.type, status: "published" as const, score: 70, happened_at: ran.happenedAt, domains: ran.domains, signal_keys: [], sector: ran.sector }];
    expect(planStories(later, stored, sctx).filter(p => p.status === "published")).toHaveLength(0);
    expect(brandFolds(later, [{ ...shown, facts: folds[0]!.payload.facts }], at(4)).folds).toHaveLength(0);
  });
  it("a change eight days later starts a new story", () => {
    const next = story([...first, ev(4, "x.com", "type_change", { h1: "Inter" }, { h1: "Apris" }, 8)]);
    expect(next.map(c => c.id)).toEqual([ran.id, "brand:x.com:2026-11-19"]);
    const { folds, told } = brandFolds(next.slice(1), [shown], at(8));
    expect(folds).toHaveLength(0); expect(told.size).toBe(0);
    expect(planStories(next.slice(1), [], sctx)[0]!.status).toBe("published");
  });
});

describe("Part 2 · pattern guards", () => {
  const runs = (a: string, b: string, share: number) => [
    { id: 1, at: at(-7), rows: [row("ai_positioning:ai_core", "all", { stage: a }), row("ai_positioning:ai_feature", "all", { stage: "flat" }), row("imagery:video_still", "all", { stage: "declining", current_share: 0.05 })] },
    { id: 2, at: at(0), rows: [row("ai_positioning:ai_core", "all", { stage: b, current_share: share }), row("ai_positioning:ai_feature", "all", { stage: "accelerating", current_share: 0.146 }), row("imagery:video_still", "all", { stage: "emerging", current_share: 0.0498 })] },
  ];
  it("stage changes of one family from one run pair are one story; under 10% of homepages goes to the Brief table only", () => {
    const ctx = context(input({ now: at(1), runs: runs("peaking", "flat", 0.292) }));
    ctx.headline.add("ai_positioning:ai_core"); ctx.headline.add("ai_positioning:ai_feature"); ctx.headline.add("imagery:video_still");
    const all = shifts(ctx);
    const merged = all.find(c => c.id === "shift:ai_positioning:2")!;
    expect(merged.signalKeys).toEqual(["ai_positioning:ai_core", "ai_positioning:ai_feature"]); expect(merged.members).toHaveLength(2);
    expect(all.find(c => c.signalKeys[0] === "imagery:video_still")?.holdReason).toBe(SHIFT_BRIEF_REASON);
  });
  it("a white space that could not be filled is refused (media × product screenshots)", () => {
    expect(notApplicable("media", "components:product_screenshot")).toBeTruthy(); expect(notApplicable("dev-tools", "imagery:photography_lifestyle")).toBeNull();
  });
});

describe("Part 5 · applying it to what is live", () => {
  const brandCand = cand({ id: "brand:x.com:2026-11-11", type: "move", domains: ["x.com"], sourceIds: ["event:1", "event:2"], deck: "Two changes.",
    facts: [{ text: "Accent, blue to red · 11 Nov", href: "/brands/x.com", basis: "measured", kind: "member" }, { text: "Headline, “a” to “b” · 12 Nov", href: "/brands/x.com", basis: "measured", kind: "member" }] });
  const st = (id: string, type: string, o: Partial<Parameters<typeof e2Plan>[0][number]> = {}) => ({ id, type, sector: null, signal_keys: [], domains: ["x.com"], source_ids: [], happened_at: at(0), headline: "h", deck: null, facts: [], ...o });
  const ctx = { candidates: [brandCand], shareOf: () => 0.05, notApplicable: () => null, shiftMinShare: 0.1 };
  it("a brand's two stories fold into the first with one correction; a lone change is now a tape line", () => {
    const p = e2Plan([st("move:1", "move", { source_ids: ["event:1"] }), st("move:2", "move", { happened_at: at(1), source_ids: ["event:2"] }), st("move:9", "move", { domains: ["y.com"], source_ids: ["event:9"] })], ctx);
    expect(p.kills).toEqual([{ id: "move:9", reason: "tape" }, { id: "move:2", reason: "folded" }]);
    expect(p.corrects).toHaveLength(1); expect(p.corrects[0]!.id).toBe("move:1"); expect(p.corrects[0]!.note).toBe(E2_FOLD_NOTE(["Accent, blue to red", "Headline, x"]));
    expect(p.corrects[0]!.note).toBe("Folded: one brand, one story. Added the accent and headline changes from the brand's other changes that week.");
  });
  it("a shift under 10% goes to the Brief table; a one-brand first sighting is retired; a corrected story is not corrected again", () => {
    const p = e2Plan([st("shift:a", "shift", { signal_keys: ["imagery:video_still"] }), st("first:a", "first_seen", { domains: ["x.com"] })], ctx);
    expect(p.kills.map(k => k.reason)).toEqual(["brief", "firstSeen"]);
    expect(e2Plan([st("move:1", "move", { source_ids: ["event:1"], facts: brandCand.facts })], ctx).corrects).toHaveLength(0);
  });
});
