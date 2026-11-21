import { describe, expect, it } from "vitest";
import { quietCandidates, mentionCheck, withFollowFacts, type QuietInput } from "./quiet";
import { newsMatcher, type WireIn } from "./candidates";
import type { EventRow } from "../agency/changes";
import { bannedFailures } from "./writer";

const NOW = "2026-11-21T12:00:00Z";
const sites = new Map([["acme.com", { domain: "acme.com", name: "Acmecorp", sector: "commerce-dtc" }], ["studio.co", { domain: "studio.co", name: "Studioname", sector: "studios" }]]);
const m = newsMatcher([...sites.values()], []);
const wire = (o: Partial<WireIn>): WireIn => ({ id: 1, title: "Something else entirely", url: "https://x", source: "designboom", source_kind: "rss", published_at: "2026-11-18T00:00:00Z", excerpt: null, ...o });
const asset = { domain: "acme.com", kind: "icon", from: { path: "a/old.png", last_seen_at: "2026-11-15T06:00:00Z" }, to: { path: "a/new.png", first_seen_at: "2026-11-16T06:00:00Z" }, between: { old_last: "2026-11-15T06:00:00Z", new_first: "2026-11-16T06:00:00Z" }, confirmed_at: "2026-11-16T18:00:00Z" };
const ev = (o: Partial<EventRow>): EventRow => ({ id: 7, domain: "acme.com", type: "type_change", before: { h1_family: "Canela" }, after: { h1_family: "Inter" }, detected_at: "2026-11-17T06:00:00Z", page_type: "product", source: "live", viewport: "desktop", snapshot_id: 2, prev_snapshot_id: 1, ...o } as EventRow);
const input = (o: Partial<QuietInput> = {}): QuietInput => ({ assets: [], urls: { 1: "https://acme.com/products/a", 2: "https://acme.com/products/a" }, wire: [wire({ source: "designboom" }), wire({ id: 2, source: "Dezeen" })], ...o });

describe("W1b · the quiet change", () => {
  it("a confirmed new icon nobody we read mentioned is a candidate, counting the outlets read", () => {
    const r = quietCandidates({ now: NOW, events: [], quiet: input({ assets: [asset] }), matcher: m, sites });
    expect(r.candidates.map(c => [c.id, c.type, c.kicker])).toEqual([["quiet:asset:acme.com:icon:2026-11-16", "move", "Quiet change · Commerce & DTC"]]);
    expect(r.candidates[0]!.deck).toContain("We found no mention of the brand in the 2 outlets we read between 2 Nov 2026 and 21 Nov 2026");
  });
  it("a wire item naming the brand within 14 days either side drops it; one from 15 days before does not", () => {
    const named = quietCandidates({ now: NOW, events: [], quiet: input({ assets: [asset], wire: [wire({ title: "Acmecorp unveils a new look" })] }), matcher: m, sites });
    expect([named.candidates.length, named.verdicts[0]!.outcome]).toEqual([0, "mentioned"]);
    expect(mentionCheck(m, [wire({ title: "Acmecorp unveils a new look", published_at: "2026-11-01T00:00:00Z" })], "acme.com", asset.between.new_first, NOW).mention).toBeNull();
  });
  it("a non-home change counts only when both captures are of the same address", () => {
    expect(quietCandidates({ now: NOW, events: [ev({})], quiet: input(), matcher: m, sites }).candidates[0]?.id).toBe("quiet:event:7");
    const moved = quietCandidates({ now: NOW, events: [ev({})], quiet: input({ urls: { 1: "https://acme.com/products/a", 2: "https://acme.com/products/b" } }), matcher: m, sites });
    expect([moved.candidates.length, moved.verdicts[0]!.outcome]).toEqual([0, "different address"]);
  });
  it("homepage changes, unconfirmed assets and studio colours are not quiet changes", () => {
    const accent = { before: { accent: "#FB2180" }, after: { accent: "#130281" } };
    const r = quietCandidates({ now: NOW, events: [ev({ page_type: "home" }), ev({ id: 8, domain: "studio.co", type: "palette_shift", page_type: "about", ...accent }), ev({ id: 9, type: "palette_shift", ...accent }),
      ev({ id: 10, type: "palette_shift", page_type: "about", before: { palette: ["#151B1C"] }, after: { palette: ["#67707B"] } })], quiet: input({ assets: [{ ...asset, confirmed_at: null }], urls: { 1: "u", 2: "u" } }), matcher: m, sites });
    expect([r.candidates.length, r.verdicts.map(v => v.outcome)]).toEqual([0, ["colour follows content", "colour follows content", "colour follows content"]]);
    const ok = quietCandidates({ now: NOW, events: [ev({ id: 11, domain: "acme.com", type: "palette_shift", page_type: "about", ...accent })], quiet: input({ urls: { 1: "u", 2: "u" } }), matcher: m, sites: new Map([["acme.com", { domain: "acme.com", name: "Acmecorp", sector: "dev-tools", kind: "standard" }]]) });
    expect(ok.candidates.map(c => c.headline)).toEqual(["Acmecorp has a new accent colour on its about page"]);
  });
  it("claims about intent are refused in written text; the no-mention sentence is allowed", () => {
    for (const t of ["Acmecorp secretly changed its icon.", "It quietly dropped the serif.", "They did it without telling anyone.", "No one announced it.", "The change was unannounced."]) expect(bannedFailures(t).some(f => f.startsWith("claim about intent"))).toBe(true);
    expect(bannedFailures("We found no mention in the 2 outlets we read.")).toEqual([]);
  });
});

describe("W1c · a page that follows its own homepage is not a quiet change", () => {
  const typeEv = (o: Partial<EventRow> = {}) => ev({ id: 20, page_type: "changelog", before: { h1: "Figtree" }, after: { h1: "Systemia", body: "Systemia" }, detected_at: "2026-11-21T06:00:00Z", ...o });
  const homeType = { id: 4756, domain: "acme.com", type: "type_change", at: "2026-11-20T09:00:00Z", after: { h1: "Systemia", body: "Systemia" } };
  it("a typeface change on another page within 30 days of a confirmed homepage typeface change is not a candidate", () => {
    const r = quietCandidates({ now: NOW, events: [typeEv()], quiet: input({ home: [homeType] }), matcher: m, sites });
    expect([r.candidates.length, r.verdicts[0]!.outcome]).toEqual([0, "follows homepage"]);
    expect(r.follows[0]!.fact.text).toBe("The changelog page now uses Systemia too, 21 Nov");
  });
  it("30 days either side counts; 31 days does not; a homepage change of another kind does not", () => {
    expect(quietCandidates({ now: NOW, events: [typeEv()], quiet: input({ home: [{ ...homeType, at: "2026-10-22T06:00:00Z" }] }), matcher: m, sites }).verdicts[0]!.outcome).toBe("follows homepage");
    expect(quietCandidates({ now: NOW, events: [typeEv()], quiet: input({ home: [{ ...homeType, at: "2026-10-21T05:00:00Z" }] }), matcher: m, sites }).verdicts[0]!.outcome).toBe("candidate");
    expect(quietCandidates({ now: NOW, events: [typeEv()], quiet: input({ home: [{ ...homeType, type: "palette_shift", after: { accent: "#130281" } }] }), matcher: m, sites }).verdicts[0]!.outcome).toBe("candidate");
  });
  it("an icon or card change follows any confirmed homepage identity change or rebrand in the window", () => {
    for (const h of [{ ...homeType, type: "theme_flip" }, { id: null, domain: "acme.com", type: "rebrand", at: "2026-11-10T00:00:00Z" }]) {
      const r = quietCandidates({ now: NOW, events: [], quiet: input({ assets: [asset], home: [h] }), matcher: m, sites });
      expect([r.candidates.length, r.verdicts[0]!.outcome, r.follows[0]!.fact.text]).toEqual([0, "follows homepage", "The site icon changed too, between 15 and 16 Nov"]);
    }
  });
  it("the follow becomes one fact on the brand's own story, before its confirmation line, once", () => {
    const r = quietCandidates({ now: NOW, events: [typeEv()], quiet: input({ home: [homeType] }), matcher: m, sites });
    const story = { id: "brand:acme.com:2026-11-20", type: "rebrand" as const, kicker: "Rebrand", headline: "Acmecorp rebranded", deck: null, sector: null, signalKeys: [], domains: ["acme.com"], evidence: [], sourceIds: ["event:4756"], basis: "measured" as const, happenedAt: "2026-11-20T09:00:00Z", magnitude: 3,
      facts: [{ text: "Headline font, Figtree to Systemia · 20 Nov", href: null, basis: "measured" as const, kind: "member" as const }, { text: "Confirmed on a second capture, 20 Nov", href: null, basis: "measured" as const, kind: "date" as const }] };
    const [out] = withFollowFacts([story], [...r.follows, ...r.follows]);
    expect(out!.facts.map(f => f.text)).toEqual(["Headline font, Figtree to Systemia · 20 Nov", r.follows[0]!.fact.text, "Confirmed on a second capture, 20 Nov"]);
    expect(story.facts).toHaveLength(2);
  });
});

describe("W1c · outlets are publications on the wire's source list", () => {
  it("social accounts and aggregators are searched but never counted as outlets", () => {
    const w = [wire({ source: "Dezeen" }), wire({ id: 2, source: "designboom" }), wire({ id: 3, source: "Dezeen" }), wire({ id: 4, source: "someone.bsky.social", source_kind: "bluesky" }), wire({ id: 5, source: "Hacker News", source_kind: "hn" }), wire({ id: 6, source: "The Verge" })];
    const c = mentionCheck(m, w, "acme.com", asset.between.new_first, NOW);
    expect([c.outlets, c.outletNames]).toEqual([2, ["designboom", "Dezeen"]]);
    const r = quietCandidates({ now: NOW, events: [], quiet: input({ assets: [asset], wire: w }), matcher: m, sites });
    expect(r.candidates[0]!.deck).toContain("in the 2 outlets we read");
    expect(r.candidates[0]!.deck).not.toMatch(/bluesky|social|account/i);
  });
  it("a social post naming the brand still drops it; with no outlet read there is no candidate", () => {
    expect(quietCandidates({ now: NOW, events: [], quiet: input({ assets: [asset], wire: [wire({ source: "x.bsky.social", source_kind: "bluesky", title: "Acmecorp has a new icon" })] }), matcher: m, sites }).verdicts[0]!.outcome).toBe("mentioned");
    expect(quietCandidates({ now: NOW, events: [], quiet: input({ assets: [asset], wire: [wire({ source: "x.bsky.social", source_kind: "bluesky" })] }), matcher: m, sites }).verdicts[0]!.outcome).toBe("no outlets read");
  });
});

import { leadPicture, type LeadPics } from "../lead-picture";
describe("W1b · quiet change lead picture", () => {
  it("is the old and new icon as a pair", () => {
    const none: LeadPics = { okCrop: () => true, hero: () => null, thumb: () => null, card: () => null, carousel: () => false, name: d => d, icon: () => null };
    const pic = (path: string, at: string) => ({ path, src: `/crops/${path}`, width: 64, height: 64, at });
    const pl = leadPicture({ kind: "story", story: { id: "quiet:asset:acme.com:icon:2026-11-16", type: "move", domains: ["acme.com"], happened_at: NOW, assetPair: { kind: "icon", before: pic("a/old.png", "2026-11-15T06:00:00Z"), after: pic("a/new.png", "2026-11-16T06:00:00Z") } } }, none);
    expect([pl.kind, pl.rule, pl.items.map(i => [i.role, i.asset])]).toEqual(["pair", "quiet", [["before", "icon:a/old.png"], ["after", "icon:a/new.png"]]]);
  });
});

import { followFolds, type ShownStory } from "./editor";
describe("W1c · the follow fact reaches the brand's stored story, published or held", () => {
  const follow = { domain: "acme.com", at: "2026-11-20T05:54:00Z", home: [{ id: 4756, domain: "acme.com", type: "type_change", at: "2026-11-20T09:29:00Z" }], fact: { text: "The changelog page now uses Systemia too, between 14 and 20 Nov", href: null, basis: "measured" as const, kind: "member" as const } };
  const stored = (o: Partial<ShownStory>): ShownStory => ({ id: "brand:acme.com:2026-11-20", type: "rebrand", state: "held", happened_at: "2026-11-20T09:29:00Z", domains: ["acme.com"], headline: "Acmecorp rebranded", deck: "D.", source_ids: ["event:4756"],
    facts: [{ text: "Headline font, Figtree to Systemia · 20 Nov", kind: "member" }, { text: "Confirmed on a second capture, 20 Nov", kind: "date" }], ...o });
  it("a held rebrand citing the homepage change gets one correct edit with the fact before its confirmation line", () => {
    const f = followFolds([follow], [stored({}), stored({ id: "move:4756", type: "move" })], [], "2026-11-21T12:00:00Z");
    expect(f.map(x => [x.story_id, x.payload.headline, x.payload.facts.map(t => t.text), x.note])).toEqual([["brand:acme.com:2026-11-20", "Acmecorp rebranded",
      ["Headline font, Figtree to Systemia · 20 Nov", "The changelog page now uses Systemia too, between 14 and 20 Nov", "Confirmed on a second capture, 20 Nov"], "Updated 21 Nov: the changelog page now uses Systemia too."]]);
  });
  it("is idempotent, skips killed and other brands' stories, and none without a story", () => {
    const told = stored({ facts: [{ text: "The changelog page now uses Systemia too, between 14 and 20 Nov", kind: "member" }] });
    expect(followFolds([follow], [told], [], "2026-11-21T12:00:00Z")).toEqual([]);
    expect(followFolds([follow], [stored({ state: "killed" }), stored({ id: "brand:other.com:2026-11-20", domains: ["other.com"] })], [], "2026-11-21T12:00:00Z")).toEqual([]);
  });
});
