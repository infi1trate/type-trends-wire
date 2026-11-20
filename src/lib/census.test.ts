// E2g · the census: the base, words in headlines (agents) on a frozen copy of 20 Nov's captures, sale mode, and the weekly cadence.
import { describe, expect, it } from "vitest";
import fx from "./__fixtures__/census-2026-11-20.json";
import type { EventRow } from "./agency/changes";
import { addedWord, censusCandidate, censusCandidates, censusDue, censusPairs, headlineBase, numberWord, saleCensus, WATCH_LIST, wordMembers, type CensusCapture } from "./census";

const NOW = "2026-11-20T17:00:00Z", AGENTS = WATCH_LIST.find(w => w.key === "agents")!;
const cap = (id: number, domain: string, at: string, h1: string | null, o: { source?: string | null; ctas?: string[] } = {}): CensusCapture => ({ id, domain, at, source: o.source === undefined ? "h1" : o.source, h1, ctas: o.ctas ?? [] });
const base = (xs: CensusCapture[]) => headlineBase(censusPairs(xs, NOW));

describe("the base", () => {
  it("a brand with two h1 captures six hours apart inside eight days and the same headline is in the base", () => {
    expect([...base([cap(1, "a.com", "2026-11-20T10:00:00Z", "Agents for everyone"), cap(2, "a.com", "2026-11-20T03:00:00Z", "Agents for everyone")]).keys()]).toEqual(["a.com"]);
  });
  it("one capture is not in the base", () => expect(base([cap(1, "a.com", "2026-11-20T10:00:00Z", "Agents for everyone")]).size).toBe(0));
  it("two newest captures under six hours apart are not in the base (an older third does not rescue it)", () => {
    expect(base([cap(1, "a.com", "2026-11-20T10:00:00Z", "Hello"), cap(2, "a.com", "2026-11-20T05:00:00Z", "Hello"), cap(3, "a.com", "2026-11-18T05:00:00Z", "Hello")]).size).toBe(0);
  });
  it("a headline read from largest_text on either side is not in the base", () => {
    expect(base([cap(1, "a.com", "2026-11-20T10:00:00Z", "Hello"), cap(2, "a.com", "2026-11-19T10:00:00Z", "Hello", { source: "largest_text" })]).size).toBe(0);
  });
  it("two different headlines are not in the base", () => {
    expect(base([cap(1, "a.com", "2026-11-20T10:00:00Z", "Let agents ship products as fast as they write code"), cap(2, "a.com", "2026-11-14T10:00:00Z", "Ship software peacefully")]).size).toBe(0);
  });
  it("a capture older than eight days does not count", () => {
    expect(base([cap(1, "a.com", "2026-11-20T10:00:00Z", "Hello"), cap(2, "a.com", "2026-11-11T10:00:00Z", "Hello")]).size).toBe(0);
  });
});

describe("census A · agents, on a frozen copy of 20 Nov's captures", () => {
  const caps = fx.captures as CensusCapture[], now = fx.now, sites = new Set(fx.sites.map(s => s.domain));
  const pairs = new Map([...censusPairs(caps, now)].filter(([d]) => sites.has(d))), b = headlineBase(pairs), members = wordMembers(AGENTS, b);
  // The brief expected 18 of 201. 201 is the brands whose newest capture reads an h1; the base rule leaves 140 (8 have one capture in
  // eight days, 29 were recaptured under six hours apart, 6 read the older headline elsewhere than an h1, 18 changed headline). Of the
  // 18 named, Attio (older capture has no h1), Databricks (3.9 h apart), Vercel (0.8 h apart) and Railway (changed headline) fall out.
  it("14 of 140 homepages whose headline we can read have agent, agents or agentic in it", () => {
    expect(b.size).toBe(140);
    expect(members.map(m => m.domain).sort()).toEqual(["1password.com", "coinbase.com", "cursor.com", "fly.io", "framer.com", "linear.app", "monday.com", "mongodb.com", "neon.com", "notion.com", "okta.com", "postman.com", "slack.com", "snowflake.com"]);
    for (const d of ["attio.com", "databricks.com", "vercel.com", "railway.com", "public.com"]) expect(members.some(m => m.domain === d), d).toBe(false);
  });
  it("headlines are quoted exactly as captured", () => {
    expect(members.find(m => m.domain === "fly.io")!.line).toBe("Computers for agents, from sandboxes to production");
    expect(members.find(m => m.domain === "mongodb.com")!.line).toBe("Every scale. Every agent. One platform");
  });
  it("Coinbase and MongoDB are newly added, each with the old line, the new line and the two capture dates", () => {
    const added = addedWord(AGENTS, members, fx.events as unknown as EventRow[], now);
    expect(added.map(e => e.domain).sort()).toEqual(["coinbase.com", "mongodb.com"]);
    const cb = added.find(e => e.domain === "coinbase.com")!;
    expect(cb.before).toEqual({ headline: "Trusted by millions worldwide" });
    expect(cb.seen!.before.slice(0, 10)).toBe("2026-11-11"); expect(cb.seen!.after.slice(0, 10)).toBe("2026-11-14");
  });
  it("the template story: count with its base, members in the lines, six named, the newly added under the changes", () => {
    const site = new Map(fx.sites.map(s => [s.domain, s]));
    const [c] = censusCandidates({ now, census: { captures: caps, history: [] }, events: fx.events as unknown as EventRow[] }, site, new Map()).filter(x => x.id.startsWith("census:agents:"));
    expect(c!.headline).toBe("Fourteen tracked homepages have ‘agents’ in the headline");
    expect(c!.deck).toMatch(/^14 of 140 tracked homepages whose headline we can read use ‘agent’, ‘agents’ or ‘agentic’ in the headline: .+ and eight more\.$/);
    expect(c!.facts.filter(f => f.kind === "line")).toHaveLength(14);
    expect(c!.facts.filter(f => f.kind === "member").map(f => f.text)).toContain("Coinbase · headline, “Trusted by millions worldwide” to “The trusted financial account for you and your agents” · between 11 and 14 Nov");
    expect(c!.id).toBe("census:agents:2026-W47");
    expect(c!.census).toMatchObject({ census_key: "agents", count: 14, base: 140 });
  });
});

describe("census B · sale mode", () => {
  it("a promotional h1 in both captures counts", () => {
    const s = saleCensus(censusPairs([cap(1, "a.com", "2026-11-20T10:00:00Z", "25% Off Sitewide Black Friday Sale"), cap(2, "a.com", "2026-11-19T10:00:00Z", "25% Off Sitewide Black Friday Sale")], NOW));
    expect(s.members).toEqual([{ domain: "a.com", line: "25% Off Sitewide Black Friday Sale", via: "headline" }]);
  });
  it("a promotional line in only one capture does not count", () => {
    expect(saleCensus(censusPairs([cap(1, "a.com", "2026-11-20T10:00:00Z", "25% Off Sitewide Black Friday Sale"), cap(2, "a.com", "2026-11-14T10:00:00Z", "The Gift of Better Sleep")], NOW)).members).toEqual([]);
  });
  it("the same promotional button label in both captures counts, even when the headline is not from an h1", () => {
    const s = saleCensus(censusPairs([cap(1, "a.com", "2026-11-20T10:00:00Z", "Mattresses", { source: "largest_text", ctas: ["Shop sale", "Find a store"] }), cap(2, "a.com", "2026-11-19T10:00:00Z", "Pillows", { source: "largest_text", ctas: ["shop  sale"] })], NOW));
    expect(s).toEqual({ base: 1, members: [{ domain: "a.com", line: "Shop sale", via: "button" }] });
  });
  it("on 20 Nov's captures: 8 of 190 homepages whose headline or buttons we can read", () => {
    const s = saleCensus(new Map([...censusPairs(fx.captures as CensusCapture[], fx.now)].filter(([d]) => fx.sites.some(x => x.domain === d))));
    expect(s.base).toBe(190);
    expect(s.members.map(m => m.domain).sort()).toEqual(["brooklinen.com", "casper.com", "drinkolipop.com", "equinox.com", "fromourplace.com", "gopro.com", "onepeloton.com", "parachutehome.com"]);
  });
});

describe("cadence", () => {
  const ran = [{ census_key: "agents", day: "2026-11-20", count: 18, base: 201 }];
  it("needs eight members", () => expect(censusDue(7, [], "agents", NOW).run).toBe(false));
  it("the first run always runs", () => expect(censusDue(8, [], "agents", NOW)).toMatchObject({ run: true, earlier: null }));
  it("a second run in the same week does nothing", () => expect(censusDue(30, ran, "agents", "2026-11-22T10:00:00Z").run).toBe(false));
  it("a later week with the count moved by one does nothing", () => expect(censusDue(19, ran, "agents", "2026-11-27T10:00:00Z").run).toBe(false));
  it("moved by two publishes and states the earlier count", () => {
    const due = censusDue(20, ran, "agents", "2026-11-27T10:00:00Z");
    expect(due).toMatchObject({ run: true, earlier: { count: 18, day: "2026-11-20" } });
    const c = censusCandidate({ key: "agents", title: "Headlines", now: "2026-11-27T10:00:00Z", base: 205, earlier: due.earlier, sites: new Map(), rank: new Map(),
      members: Array.from({ length: 20 }, (_, i) => ({ domain: `b${i}.com`, line: "Agents", via: "headline" as const })) });
    expect(c.headline).toBe("Twenty tracked homepages have ‘agents’ in the headline");
    expect(c.deck).toMatch(/, up from 18 on 20 Nov: /);
  });
  it("counts read as words", () => { expect(numberWord(18)).toBe("Eighteen"); expect(numberWord(23)).toBe("Twenty-three"); });
});
