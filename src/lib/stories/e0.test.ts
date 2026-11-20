// Phase E0 · stop the noise: the rebrand dimension rule, seasonal skins, the outside-news subject rule, estimate-only and
// counter-move holds, the new caps, the reader-facing rule list, and the same rules applied to stories already published.
import { describe, expect, it } from "vitest";
import type { EventRow, RebrandRow } from "../agency/changes";
import { isRebrand, rebrandDimensions, REBRAND_MIN_DIMENSIONS } from "../rebrand-rule";
import { promoSignal, seasonalChange } from "../promo";
import { allCandidates, newsCandidates, newsMatcher, rebrandCandidate, type BuildInput } from "./candidates";
import { DAILY_CAP, NEWS_DAILY_CAP } from "./score";
import { COUNTER_HELD_REASON, ESTIMATE_ONLY_REASON } from "./types";
import { storyRules } from "./rules";
import { E0_RETIRE, e0Verdict, type E0Ctx, type E0Story } from "./retire";
import { noDid, readerWhy } from "./reader";

const NOW = "2026-11-16T12:00:00.000Z";
const rb = (reasons: string[], o: Partial<RebrandRow> = {}): RebrandRow => ({ domain: "lucidmotors.com", sector: "auto", name: "Lucid", confirmed_at: "2026-11-14T00:00:00Z", read: "", reasons, ...o });
const ev = (id: number, type: string, before: unknown, after: unknown, o: Partial<EventRow> = {}): EventRow => ({ id, domain: "lucidmotors.com", sector: "auto", type, before, after, detected_at: "2026-11-14T00:00:00Z", source: "live", page_type: "home", viewport: "desktop", ...o });

describe("A · a rebrand has to be earned", () => {
  it("two dimensions is a move, three is a rebrand, palette + accent count once as colour", () => {
    expect(REBRAND_MIN_DIMENSIONS).toBe(3);
    expect(isRebrand(rb(["font", "palette"]))).toBe(false);
    expect(isRebrand(rb(["font", "palette", "theme"]))).toBe(true);
    expect(rebrandDimensions(["palette", "accent"])).toEqual(["colour"]);
    expect(isRebrand(rb(["palette", "accent", "font"]))).toBe(false);
    expect(isRebrand(rb(["palette", "accent", "font", "redesign"]))).toBe(true);
    expect(isRebrand(rb(["font", "palette", "theme"], { seasonal: true }))).toBe(false);
  });
  it("anything less is an ordinary move with a plain headline and never says rebrand", () => {
    const one = rebrandCandidate(rb(["font"]), [{ c: { id: "move:1", type: "move", kicker: "Move · Type · Auto", headline: "lucidmotors.com changed its headline font", deck: "Lucid Serif → Lucid Sans. Confirmed 14 Nov.", facts: [], sector: "auto", signalKeys: [], domains: ["lucidmotors.com"], evidence: [], sourceIds: ["event:1"], basis: "measured", happenedAt: "2026-11-14T00:00:00Z", magnitude: 1 }, e: ev(1, "font_swap", {}, {}) }]);
    expect(one.type).toBe("move"); expect(one.headline).toBe("lucidmotors.com changed its headline font");
    const none = rebrandCandidate(rb(["font", "accent"]), []);
    expect(none.type).toBe("move"); expect(none.headline).toBe("lucidmotors.com changed its font and accent");
    for (const c of [one, none]) expect([c.kicker, c.headline, c.deck ?? "", ...c.facts.map(f => f.text)].join(" ")).not.toMatch(/rebrand/i);
    const real = rebrandCandidate(rb(["font", "palette", "redesign"]), []);
    expect(real.type).toBe("rebrand"); expect(real.headline).toMatch(/rebranded/);
  });
});

describe("B · seasonal and promotional skins", () => {
  it("promoSignal matches sale wording and not words that merely contain it", () => {
    for (const t of ["25% OFF SITEWIDE BLACK FRIDAY SALE", "UP TO $200 OFF TOP CAMERAS", "The Gift Guide's Here!"]) expect(promoSignal(t), t).not.toBeNull();
    for (const t of ["Wholesale pricing", "Salesforce", "Reach new peaks"]) expect(promoSignal(t), t).toBeNull();
  });
  it("a change is seasonal when the after capture reads like a promotion (E0b: either capture, see e0b.test.ts)", () => {
    expect(seasonalChange(["Black Friday: 30% off"], ["Reach new peaks"])).toBe(true);
    expect(seasonalChange(["Black Friday: 30% off"], null)).toBe(true);
  });
  it("seasonal changes are held, never a rebrand, never counted in a roundup", () => {
    const input: BuildInput = { now: NOW, events: [{ ...ev(5, "palette_shift", { palette: ["#000"] }, { palette: ["#f00"] }), snapshot_id: 50, prev_snapshot_id: 49 } as EventRow], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], runs: [], sites: [], texts: { 50: ["Black Friday sale"], 49: ["Reach new peaks"] } };
    // E2a: a seasonal change is a tape line marked Seasonal; no candidate tells it (the weekly seasonal story needs three brands).
    const r = allCandidates(input);
    expect(r.candidates.some(x => x.sourceIds.includes("event:5"))).toBe(false); expect(r.tape[5]).toMatch(/· Seasonal$/);
  });
});

describe("C · outside news needs a subject", () => {
  const m = newsMatcher([{ domain: "instagram.com", name: "Instagram" }, { domain: "webflow.com", name: "Webflow" }, { domain: "dropbox.com", name: "Dropbox" }, { domain: "designboom.com", name: "designboom" }], []);
  const w = (id: number, title: string, o: Record<string, unknown> = {}) => ({ id, title, url: "https://news.example/x", source: "Example", source_kind: "rss", published_at: NOW, excerpt: null, ...o });
  it("drops Bluesky posts, bare hosts and publications naming themselves; keeps a named brand with a design subject", () => {
    const r = newsCandidates(m, [
      w(1, "New toy reveal on instagram.com — Instagram logo redesign", { source_kind: "bluesky", source: "Bluesky @did:plc:abc" }),
      w(2, "Apache HTTPd (CVE-2026-1234) exploited on webflow.sysdig.com"),
      w(3, "Dropbox unveils new brand identity"),
      w(4, "designboom website redesign", { url: "https://www.designboom.com/x", source: "designboom" }),
    ]);
    expect(r.candidates.map(c => c.id)).toEqual(["news:3"]);
    expect(r.drops.bluesky).toBe(1); expect(r.drops.no_name).toBe(2);
  });
  it("needs a design subject term", () => {
    expect(newsCandidates(m, [w(5, "Dropbox raises prices")]).drops.no_subject).toBe(1);
  });
});

describe("D · estimates and counter-moves don't run alone; caps", () => {
  it("an AI-only single-brand move is held with the stated reason", () => {
    const input: BuildInput = { now: NOW, events: [ev(7, "aesthetic_shift", { aesthetic: ["minimal"] }, { aesthetic: ["maximal"] })], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], runs: [], sites: [] };
    // E2a: an AI read of one brand is a tape line, never a story candidate.
    const r = allCandidates(input);
    expect(r.candidates.some(x => x.sourceIds.includes("event:7"))).toBe(false); expect(r.tape[7]).toBeTruthy();
    expect(ESTIMATE_ONLY_REASON).toBe("Estimate only: one brand, one AI read");
    expect(COUNTER_HELD_REASON).toBe("Held for the weekly counter-move roundup");
  });
  it("caps are 5 stories a day (E2a) and 3 news", () => { expect(DAILY_CAP).toBe(5); expect(NEWS_DAILY_CAP).toBe(3); });
  it("the reader-facing rule list states each new rule", () => {
    const text = storyRules().map(r => r.text).join(" ");
    expect(text).toMatch(/rebrand only when it covers at least 3 of 4/);
    expect(text).toMatch(/seasonal/);
    expect(text).toMatch(/names a tracked brand by name/);
    expect(text).toContain(ESTIMATE_ONLY_REASON); expect(text).toContain(COUNTER_HELD_REASON);
    expect(text).toMatch(/At most 5 stories run per UTC day, at most 3 of them about a single brand and 3 of them news/);
  });
});

describe("E · reader pages carry no machinery", () => {
  it("drops generic advice and keeps a statement about the story", () => {
    expect(readerWhy("Audit your own hero section.")).toBeNull();
    expect(readerWhy("Competitors should evaluate the shift.")).toBeNull();
    expect(readerWhy("Lucid is the third carmaker this quarter to drop its serif.")).toBe("Lucid is the third carmaker this quarter to drop its serif.");
  });
  it("never shows a Bluesky DID", () => { expect(noDid("News · Bluesky @did:plc:7wezy25y7gq5vzfmcdwunnuc")).toBe("News · Bluesky"); });
});

describe("F · the same rules on stories already published", () => {
  const story = (o: Partial<E0Story>): E0Story => ({ id: "x", type: "move", sector: "auto", signal_keys: [], domains: ["lucidmotors.com"], source_ids: [], kicker: "Move", headline: "h", deck: null, facts: [], ...o });
  const events = new Map<number, EventRow>([[1, ev(1, "font_swap", { h1: "Lucid Serif" }, { h1: "Lucid Sans" })], [2, ev(2, "aesthetic_shift", {}, {})], [3, ev(3, "palette_shift", {}, {})]]);
  const ctx = (o: Partial<E0Ctx> = {}): E0Ctx => ({ event: id => events.get(id) ?? null, seasonal: id => id === 3, rebrand: () => rb(["font"]), news: () => null, ...o });
  it("kills with the stated reasons", () => {
    expect(e0Verdict(story({ type: "counter_move" }), ctx())).toEqual({ kill: "counter" });
    expect(e0Verdict(story({ id: "move:2" }), ctx())).toEqual({ kill: "estimate" });
    expect(e0Verdict(story({ id: "move:3" }), ctx())).toEqual({ kill: "seasonal" });
    expect(e0Verdict(story({ id: "news:9", type: "news", source_ids: ["wire:9"] }), ctx({ news: () => "bluesky" }))).toEqual({ kill: "bluesky" });
    expect(e0Verdict(story({ id: "news:9", type: "news", source_ids: ["wire:9"] }), ctx({ news: () => "no_subject" }))).toEqual({ kill: "news" });
    expect(e0Verdict(story({ id: "news:9", type: "news", source_ids: ["wire:9"] }), ctx({ news: () => null }))).toBeNull();
    expect(E0_RETIRE).toMatchObject({ rebrand: "Retired: one change is not a rebrand", seasonal: "Retired: seasonal promotion on the page", news: "Retired: outside news without a design subject", bluesky: "Retired: Bluesky post", estimate: "Retired: estimate only", counter: "Retired: held for the weekly counter-move roundup" });
  });
  it("a one-dimension rebrand is re-worded as a move; a real rebrand stays", () => {
    const s = story({ id: "rebrand:lucidmotors.com:2026-11-14", type: "rebrand", source_ids: ["rebrand:lucidmotors.com:2026-11-14T00:00:00Z", "story:move:1"] });
    const v = e0Verdict(s, ctx());
    expect(v && "correct" in v && v.correct.type).toBe("move");
    expect(v && "correct" in v && v.correct.headline).not.toMatch(/rebrand/i);
    expect(e0Verdict(s, ctx({ rebrand: () => rb(["font", "palette", "redesign"]) }))).toBeNull();
    expect(e0Verdict(s, ctx({ rebrand: () => null }))).toEqual({ kill: "rebrand" });
    expect(e0Verdict({ ...s, source_ids: [...s.source_ids, "story:move:3"] }, ctx())).toEqual({ kill: "seasonal" });
  });
});
