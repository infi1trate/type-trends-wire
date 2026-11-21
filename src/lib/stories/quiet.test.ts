import { describe, expect, it } from "vitest";
import { quietCandidates, mentionCheck, type QuietInput } from "./quiet";
import { newsMatcher, type WireIn } from "./candidates";
import type { EventRow } from "../agency/changes";
import { bannedFailures } from "./writer";

const NOW = "2026-11-21T12:00:00Z";
const sites = new Map([["acme.com", { domain: "acme.com", name: "Acmecorp", sector: "commerce-dtc" }], ["studio.co", { domain: "studio.co", name: "Studioname", sector: "studios" }]]);
const m = newsMatcher([...sites.values()], []);
const wire = (o: Partial<WireIn>): WireIn => ({ id: 1, title: "Something else entirely", url: "https://x", source: "The Verge", source_kind: "rss", published_at: "2026-11-18T00:00:00Z", excerpt: null, ...o });
const asset = { domain: "acme.com", kind: "icon", from: { path: "a/old.png", last_seen_at: "2026-11-15T06:00:00Z" }, to: { path: "a/new.png", first_seen_at: "2026-11-16T06:00:00Z" }, between: { old_last: "2026-11-15T06:00:00Z", new_first: "2026-11-16T06:00:00Z" }, confirmed_at: "2026-11-16T18:00:00Z" };
const ev = (o: Partial<EventRow>): EventRow => ({ id: 7, domain: "acme.com", type: "type_change", before: { h1_family: "Canela" }, after: { h1_family: "Inter" }, detected_at: "2026-11-17T06:00:00Z", page_type: "product", source: "live", viewport: "desktop", snapshot_id: 2, prev_snapshot_id: 1, ...o } as EventRow);
const input = (o: Partial<QuietInput> = {}): QuietInput => ({ assets: [], urls: { 1: "https://acme.com/products/a", 2: "https://acme.com/products/a" }, wire: [wire({ source: "The Verge" }), wire({ id: 2, source: "Dezeen" })], ...o });

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

import { leadPicture, type LeadPics } from "../lead-picture";
describe("W1b · quiet change lead picture", () => {
  it("is the old and new icon as a pair", () => {
    const none: LeadPics = { okCrop: () => true, hero: () => null, thumb: () => null, card: () => null, carousel: () => false, name: d => d, icon: () => null };
    const pic = (path: string, at: string) => ({ path, src: `/crops/${path}`, width: 64, height: 64, at });
    const pl = leadPicture({ kind: "story", story: { id: "quiet:asset:acme.com:icon:2026-11-16", type: "move", domains: ["acme.com"], happened_at: NOW, assetPair: { kind: "icon", before: pic("a/old.png", "2026-11-15T06:00:00Z"), after: pic("a/new.png", "2026-11-16T06:00:00Z") } } }, none);
    expect([pl.kind, pl.rule, pl.items.map(i => [i.role, i.asset])]).toEqual(["pair", "quiet", [["before", "icon:a/old.png"], ["after", "icon:a/new.png"]]]);
  });
});
