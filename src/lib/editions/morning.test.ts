import { describe, expect, it } from "vitest";
import type { EditRow, StoredStory } from "../stories/edits";
import { MORNING_BASELINE, MORNING_FIRST_DAY, isEditionDay, morningArchive, morningEdition, morningHead, openingChain, type MorningRaw } from "./morning";
import { morningRss } from "./morning-rss";

let n = 0;
const story = (o: Partial<StoredStory> & { happened_at: string }): StoredStory => ({
  id: o.id ?? `s${++n}`, type: "move", status: "published", reason: "ran", score: 50, components: {}, why_ran: "", kicker: "Move", headline: o.id ?? `Story ${n}`, deck: null,
  facts: [], why_line: null, why_model: null, why_at: null, sector: "fintech", signal_keys: [], domains: [], evidence: [], source_ids: [], basis: "measured", created_at: o.created_at ?? o.happened_at, ...o,
});
const moving = { pair: null, items: [] };
const opts = { moving, charts: [] };
const NOW = Date.parse("2026-11-20T09:00:00Z");

describe("Morning Line", () => {
  it("ranks the day's published stories by score: lead plus up to five more; launches, held and folded stories never rank", () => {
    const day = "2026-11-18", at = (h: number) => `${day}T${String(h).padStart(2, "0")}:00:00Z`;
    const raw: MorningRaw = { edits: [], lines: [], stories: [
      ...[40, 90, 70, 60, 55, 80, 65].map((score, i) => story({ id: `m${i}`, score, happened_at: at(i + 1) })),
      story({ id: "launch", type: "launch", score: 99, happened_at: at(9) }),
      story({ id: "held", status: "held", reason: "below threshold", score: 98, happened_at: at(10) }),
      story({ id: "yesterday", score: 97, happened_at: "2026-11-17T23:00:00Z" }),
    ] };
    const e = morningEdition(raw, day, NOW, opts);
    expect(e.lead?.id).toBe("m1");
    expect(e.more.map(s => s.id)).toEqual(["m5", "m2", "m6", "m3", "m4"]);
    expect(e.count).toBe(7);
    expect(e.thin).toBe(false);
    expect(e.desk).toEqual([expect.objectContaining({ id: "held", reason: "below threshold" })]);
    expect(e.final).toBe(true);
  });
  it("fewer than three stories: says so and shows the last full edition", () => {
    const raw: MorningRaw = { edits: [], lines: [], stories: [
      ...[1, 2, 3].map(i => story({ id: `full${i}`, score: 50 + i, happened_at: `2026-11-16T0${i}:00:00Z` })),
      story({ id: "only", happened_at: "2026-11-18T08:00:00Z" }),
    ] };
    const e = morningEdition(raw, "2026-11-18", NOW, opts);
    expect(e.thin).toBe(true);
    expect(e.count).toBe(1);
    expect(e.lastFull?.day).toBe("2026-11-16");
    expect(e.lastFull?.lead.id).toBe("full3");
  });
  it("never changes after its UTC day ends: later stories, late why-lines and later edits do not reach it", () => {
    const day = "2026-11-18";
    const base: MorningRaw = { edits: [], lines: [], stories: [story({ id: "a", score: 60, happened_at: `${day}T08:00:00Z` }), story({ id: "b", score: 50, happened_at: `${day}T09:00:00Z` })] };
    const before = morningEdition(base, day, NOW, opts);
    const kill: EditRow = { id: 1, story_id: "a", action: "kill", payload: { reason: "wrong" }, note: null, at: "2026-11-19T10:00:00Z" };
    const later: MorningRaw = {
      stories: [...base.stories, story({ id: "late", score: 99, happened_at: `${day}T10:00:00Z`, created_at: "2026-11-19T02:00:00Z" })],
      edits: [kill], lines: [{ story_id: "b", why_line: "Late line.", why_model: "m", why_at: "2026-11-19T03:00:00Z" }],
    };
    expect(morningEdition(later, day, NOW, opts)).toEqual(before);
    // While the day is still running, the same edit does apply.
    expect(morningEdition(later, "2026-11-20", Date.parse("2026-11-20T09:00:00Z"), opts).day).toBe("2026-11-20");
    expect(Date.parse(MORNING_BASELINE)).toBeLessThan(Date.parse(`${day}T00:00:00Z`));
  });
  it("the opening rotates: the best white-space story not used in the previous three editions", () => {
    const ws = (id: string, score: number) => story({ id, type: "white_space", kicker: "White space", score, happened_at: "2026-11-10T23:00:00Z", created_at: "2026-11-01T00:00:00Z" });
    const raw: MorningRaw = { edits: [], lines: [], stories: [ws("w1", 90), ws("w2", 80), ws("w3", 70), ws("w4", 60)] };
    const chain = openingChain(raw, "2026-11-16", NOW);
    // Days 11–14: w1..w4 in score order; day 15: w1 is free again (used four editions ago); day 16: w2. The 7-day window is still open.
    expect([...chain.values()]).toEqual(["w1", "w2", "w3", "w4", "w1", "w2"]);
  });
  it("only edition days are valid: real dates between the first edition and today", () => {
    expect(isEditionDay("2026-11-18", NOW)).toBe(true);
    expect(isEditionDay("2026-11-21", NOW)).toBe(false);
    expect(isEditionDay("2026-02-30", NOW)).toBe(false);
    expect(isEditionDay("2026-11-01", NOW)).toBe(false);
  });
  it("RSS lists finished editions only, newest first, with permalinks", () => {
    const raw: MorningRaw = { edits: [], lines: [], stories: [story({ id: "x", headline: "Fintech goes <serif>", happened_at: "2026-11-18T08:00:00Z" }), story({ id: "today", happened_at: "2026-11-20T08:00:00Z" })] };
    const xml = morningRss(morningArchive(raw, NOW));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<link>https://slug.global/morning/2026-11-18</link>");
    expect(xml).toContain("Fintech goes &lt;serif&gt;");
    expect(xml).not.toContain("/morning/2026-11-20<");
    expect(xml).toContain("<pubDate>Thu, 19 Nov 2026 00:00:00 GMT</pubDate>");
    expect((xml.match(/<item>/g) ?? []).length).toBe(1);
  });
  it("C1 · the edition head equals the full edition's head fields, and a limited archive is the same newest prefix", () => {
    const raw: MorningRaw = { edits: [], lines: [], stories: [
      ...[1, 2, 3].map(i => story({ id: `h${i}`, score: 50 + i, happened_at: `2026-11-16T0${i}:00:00Z` })),
      ...[1, 2, 3, 4].map(i => story({ id: `t${i}`, score: 60 + i, happened_at: `2026-11-18T0${i}:00:00Z` })),
      story({ id: "only", happened_at: "2026-11-17T08:00:00Z" }),
    ] };
    for (const day of ["2026-11-16", "2026-11-17", "2026-11-18"]) {
      const e = morningEdition(raw, day, NOW, opts);
      expect(morningHead(raw, day, NOW)).toEqual({ title: e.title, href: e.href, lead: e.lead, count: e.count, thin: e.thin });
    }
    const all = morningArchive(raw, NOW);
    expect(all.length).toBe(3);
    expect(morningArchive(raw, NOW, 2)).toEqual(all.slice(0, 2));
  });
});
