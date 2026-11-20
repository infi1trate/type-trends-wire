// Phase E2a · acceptance: the golden set. 36 real items from 11–20 Nov 2026, each with the call an editor would make, checked against
// the engine run over the frozen fixture (__fixtures__/golden.json, built by scripts/build-golden-fixture.ts). A call the engine cannot meet is not
// weakened: it sits in SKIPPED with its reason and runs as it.skip.
import { describe, expect, it } from "vitest";
import { hasBareDomain } from "../../brand-names";
import { runGolden } from "./run";
import day20 from "./__fixtures__/day-2026-11-20.json";
import type { BuildInput } from "../candidates";
import { DAILY_CAP, isAiRoundup, isOurRead, isWeekly, leadAllowed, rankScores } from "../score";
import { AGAINST_NAMED_MAX } from "../editor";
import { AI_EVENTS } from "../types";
import { replanEdits, E2B_REPLAN } from "../retire";
import { tapeRows } from "../../tape";
import { brandName } from "../../brand-names";

const { plan } = runGolden();
const published = plan.filter(p => p.status === "published");
const single = (d: string) => published.filter(p => p.domains.length === 1 && p.domains[0] === d && (p.type === "move" || p.type === "rebrand" || p.type === "counter_move"));
const tells = (p: { sourceIds: string[] }, id: number) => p.sourceIds.includes(`event:${id}`);
/** Tape line only: no published story tells this change, except the weekly seasonal story gathering a seasonal change. */
const tapeOnly = (ids: number[]) => ids.every(id => !published.some(p => tells(p, id) && !p.id.startsWith("seasonal:")));
const one = <T,>(xs: T[]) => { expect(xs).toHaveLength(1); return xs[0]!; };

/** Calls the engine cannot meet on this data, each with the reason (reported to the owner; never deleted to make the suite pass). */
export const SKIPPED: Record<string, string> = {
  "9 · one story from the two AI stage notices":
    "Both stage notices come from comparing forecast runs 9 (14 Nov) and 13 (15 Nov), 39 hours apart. The standing rule compares only real runs at least six days apart, so no shift exists in this data; the engine does merge AI-positioning stage changes from one valid run pair into one story (editor.test.ts).",
  "10 · studios and Swiss-grid layouts as a crossover or breakout":
    "The crossover came from the same 39-hour run pair (retired by the six-day rule) and no breakout alert fired for Swiss grid, so the forecast data holds neither. The AI-read Swiss-grid roundup exists but is neither type.",
};
const may = (name: string) => (name in SKIPPED ? it.skip : it);

describe("golden set · must run as stories (12)", () => {
  it("1 · DocuSign: headline position with the accent change in the same story, and the AI figures", () => {
    const s = one(single("docusign.com"));
    expect(tells(s, 3387) && tells(s, 3386)).toBe(true);
    expect(s.facts.some(f => f.kind === "share" && f.text.includes("29.2%") && f.text.includes("14.6%"))).toBe(true);
  });
  it("2 · HubSpot: headline to “The Customer Relationship Harness” (position)", () => expect(tells(one(single("hubspot.com")), 3383)).toBe(true));
  it("3 · Dropbox: colour, hero, headline alignment and later headline copy are one story", () => {
    const s = one(single("dropbox.com"));
    expect([199, 200, 3405].every(id => tells(s, id))).toBe(true);
  });
  it("4 · Miro: headline typeface Roobert PRO to Apris", () => { const s = one(single("miro.com")); expect(tells(s, 1336)).toBe(true); expect(s.deck).toContain("Apris"); });
  it("5 · The Light Phone: headline typeface and its alignment change in one story", () => { const s = one(single("thelightphone.com")); expect(tells(s, 3365) && tells(s, 3366)).toBe(true); });
  it("6 · the seasonal story gathers Brooklinen, Lucid, Peloton and GoPro; none of them runs alone", () => {
    const s = one(published.filter(p => p.id.startsWith("seasonal:")));
    expect(s.domains).toEqual(expect.arrayContaining(["brooklinen.com", "lucidmotors.com", "onepeloton.com", "gopro.com"]));
    for (const d of ["brooklinen.com", "lucidmotors.com", "onepeloton.com", "gopro.com"]) expect(single(d)).toHaveLength(0);
  });
  it("7 · roundup: Studio Dumbar, Affirm, Frog and Meta moved to a video hero", () => {
    const s = one(published.filter(p => p.id.startsWith("roundup:") && p.signalKeys.includes("hero_media:video")));
    expect(s.domains).toEqual(expect.arrayContaining(["studiodumbar.com", "affirm.com", "frog.co", "meta.com"]));
  });
  it("8 · white space: almost no dev tools homepage uses lifestyle photography", () =>
    expect(published.some(p => p.type === "white_space" && p.sector === "dev-tools" && p.signalKeys.includes("imagery:photography_lifestyle"))).toBe(true));
  may("9 · one story from the two AI stage notices")("9 · one story from the two AI stage notices", () => {
    const ai = published.filter(p => p.type === "shift" && p.signalKeys.some(k => k.startsWith("ai_positioning:")));
    expect(one(ai).signalKeys).toEqual(expect.arrayContaining(["ai_positioning:ai_core", "ai_positioning:ai_feature"]));
  });
  may("10 · studios and Swiss-grid layouts as a crossover or breakout")("10 · studios and Swiss-grid layouts as a crossover or breakout", () =>
    expect(published.some(p => (p.type === "crossover" || p.type === "breakout") && p.sector === "studios" && p.signalKeys.includes("aesthetic:swiss_grid"))).toBe(true));
  it("11 · charts and data visuals breaking out in dev tools", () =>
    expect(published.some(p => p.type === "breakout" && p.sector === "dev-tools" && p.signalKeys.includes("imagery:data_viz"))).toBe(true));
  it("12 · against the grain: one weekly roundup of the held counter-moves, Wired, Resend and Bun among them", () => {
    const s = one(published.filter(p => p.id.startsWith("against:")));
    expect(s.domains).toEqual(expect.arrayContaining(["wired.com", "resend.com", "bun.sh"]));
    expect(published.filter(p => p.type === "counter_move")).toHaveLength(0);
  });
});

describe("golden set · must be tape lines only (8)", () => {
  it("Lucid headline font on its sale page (Seasonal)", () => { expect(tapeOnly([3679])).toBe(true); expect(single("lucidmotors.com")).toHaveLength(0); });
  it("Databricks hero image removed", () => { expect(tapeOnly([3673])).toBe(true); expect(single("databricks.com")).toHaveLength(0); });
  it("Everlywell headline “Lab testing, simplified.” to “Always tired?” is not a position", () => { expect(tapeOnly([3376, 3375])).toBe(true); expect(single("everlywell.com")).toHaveLength(0); });
  it("N26 hero image added", () => { expect(tapeOnly([3332, 3665])).toBe(true); expect(single("n26.com")).toHaveLength(0); });
  it("Polygon body font Montserrat to Roboto", () => { expect(tapeOnly([192])).toBe(true); expect(single("polygon.com")).toHaveLength(0); });
  it("Rivian hero video to still", () => { expect(tapeOnly([198])).toBe(true); expect(single("rivian.com")).toHaveLength(0); });
  it("Writer theme dark to light and hero image removed", () => { expect(tapeOnly([3307, 3308])).toBe(true); expect(single("writer.com")).toHaveLength(0); });
  it("Vuori headline to “The Vuori Meta™ Collection” and hero video to still", () => { expect(tapeOnly([3415, 3414])).toBe(true); expect(single("vuoriclothing.com")).toHaveLength(0); });
});

describe("golden set · must be held or killed (16)", () => {
  it("GoPro alone (seasonal, in the seasonal story)", () => expect(single("gopro.com")).toHaveLength(0));
  it("Brooklinen alone (seasonal, in the seasonal story)", () => expect(single("brooklinen.com")).toHaveLength(0));
  it("Amazon accent (merchandised, and reversed)", () => { expect(tapeOnly([1313, 3664])).toBe(true); expect(single("amazon.com")).toHaveLength(0); });
  it("no “six hardware brands changed their headline copy” roundup (product and promotion rotations)", () =>
    expect(published.some(p => p.type === "roundup" && (p.sector === "hardware" || /headline copy/.test(p.headline)))).toBe(false));
  it("TikTok theme (reversed)", () => { expect(tapeOnly([3336, 3652])).toBe(true); expect(single("tiktok.com")).toHaveLength(0); });
  it("Neon hero (reversed twice)", () => { expect(tapeOnly([190, 3317, 3651])).toBe(true); expect(single("neon.com")).toHaveLength(0); });
  it("Mistral accent (reversed)", () => { expect(tapeOnly([183, 3302])).toBe(true); expect(single("mistral.ai")).toHaveLength(0); });
  it("ElevenLabs accent (reversed)", () => { expect(tapeOnly([184, 3303])).toBe(true); expect(single("elevenlabs.io")).toHaveLength(0); });
  it("Designboom palette (editorial)", () => { expect(tapeOnly([3661, 4786])).toBe(true); expect(single("designboom.com")).toHaveLength(0); });
  it("The New Yorker hero (editorial)", () => expect(single("newyorker.com")).toHaveLength(0));
  it("It's Nice That accent (editorial: tape only)", () => { expect(tapeOnly([211])).toBe(true); expect(single("itsnicethat.com")).toHaveLength(0); });
  it("1Password “adopts corporate polish” (one brand, one AI read)", () => expect(single("1password.com")).toHaveLength(0));
  it("“almost no media brand uses product screenshots” (the gap cannot be filled)", () =>
    expect(published.some(p => p.type === "white_space" && p.sector === "media" && p.signalKeys.includes("components:product_screenshot"))).toBe(false));
  it("“first seen in enterprise SaaS: glassmorphism” (one brand)", () => expect(published.some(p => p.type === "first_seen" && p.signalKeys.includes("aesthetic:glassmorphism"))).toBe(false));
  it("“video stills moved from Fading to Emerging” (5.0% base: Brief table only)", () => expect(published.some(p => p.signalKeys.includes("imagery:video_still") && (p.type === "shift" || p.type === "breakout"))).toBe(false));
  it("outside news about a film poster and about Nike air cushioning (no design subject about a tracked brand's site)", () => {
    expect(published.some(p => p.id === "news:89411" || p.id === "news:83592" || p.id === "news:47729")).toBe(false);
  });
});

describe("golden set · reader text and caps", () => {
  it("no published headline or deck contains a bare tracked domain", () => {
    for (const p of published) { expect(hasBareDomain(p.headline), p.headline).toBe(false); expect(hasBareDomain(p.deck ?? ""), p.deck ?? "").toBe(false); }
  });
  it("at most five stories a day (the weekly pieces sit outside the five), at most three of them about a single brand", () => {
    const days = new Map<string, typeof published>(); for (const p of published.filter(x => x.type !== "launch" && !isWeekly(x))) days.set(p.happenedAt.slice(0, 10), [...(days.get(p.happenedAt.slice(0, 10)) ?? []), p]);
    for (const [, ps] of days) { expect(ps.length).toBeLessThanOrEqual(5); expect(ps.filter(p => p.domains.length === 1 && (p.type === "move" || p.type === "rebrand")).length).toBeLessThanOrEqual(3); }
  });
});

// E2b Part 0 · what the live site showed on 20 Nov, as rules, on the live data of that day (__fixtures__/day-2026-11-20.json, 14:00 UTC).
describe("E2b Part 0 · 20 Nov", () => {
  const input = day20 as unknown as BuildInput, { plan: p20 } = runGolden(input);
  const today = p20.filter(p => p.happenedAt.startsWith("2026-11-20") && p.type !== "launch");
  const ran = today.filter(p => p.status === "published");
  const asRow = (p: (typeof p20)[number]) => ({ id: p.id, type: p.type, basis: p.basis, score: p.score, happened_at: p.happenedAt });
  it("1 · measured goes first: Netlify runs, no our-read story takes a place a held measured story wanted, at most one AI-read roundup", () => {
    expect(ran.some(p => p.id === "brand:netlify.com:2026-11-20")).toBe(true);
    const heldMeasured = today.filter(p => p.status === "held" && !isOurRead(p) && /over the daily cap/.test(p.reason));
    if (heldMeasured.length) expect(ran.filter(p => !isWeekly(p) && isOurRead(p))).toHaveLength(0);
    expect(ran.filter(p => isAiRoundup(p)).length).toBeLessThanOrEqual(1);
    for (const r of today.filter(p => p.status === "held" && isAiRoundup(p))) expect(r.reason).toMatch(/over the daily cap|one AI-read roundup/);
  });
  it("1 · an AI-read roundup never ranks above a measured story of its day", () => {
    const rows = [...ran, ...today.filter(p => isAiRoundup(p))].map(asRow), rank = rankScores(rows);
    const lowMeasured = Math.min(...rows.filter(r => r.basis === "measured" && !isWeekly(r)).map(r => rank.get(r.id)!));
    for (const r of rows.filter(r => isAiRoundup(r))) expect(rank.get(r.id)!).toBeLessThan(lowMeasured);
  });
  it("2 · the weekly pieces run outside the daily five and neither leads on a day with a measured story", () => {
    const weekly = ran.filter(p => isWeekly(p));
    expect(weekly.map(p => p.id.split(":")[0]).sort()).toEqual(["against", "seasonal"]);
    expect(ran.filter(p => !isWeekly(p)).length).toBeLessThanOrEqual(DAILY_CAP);
    const rows = ran.map(asRow);
    for (const w of weekly) expect(leadAllowed(asRow(w), rows)).toBe(false);
  });
  // E2c restores the approved membership (E2a): a held counter-move, not reversed, with a stored stage and share behind its signal.
  // Brands with a measured change on the tape that week come first, then by trendsetter rank; at most six named, the rest counted.
  const all20 = runGolden(input).all, ctx20 = all20.ctx;
  it("3 · against the grain (E2c): members are held counter-moves with a stage and share behind their signal; measured-backed brands first", () => {
    const g = one(ran.filter(p => p.id.startsWith("against:")));
    const counters = all20.candidates.filter(c => c.type === "counter_move");
    for (const id of g.members ?? []) {
      const c = counters.find(x => x.id === id)!;
      expect(c, id).toBeTruthy();
      for (const k of c.signalKeys) { const st = ctx20.stageFor(k, c.sector); expect(!!st.stage && ctx20.row(ctx20.cur, k, st.scope)?.current_share != null, `${id} ${k}`).toBe(true); }
    }
    const since = Date.parse("2026-11-20T14:00:00Z") - 7 * 864e5;
    const rev = new Set(all20.reversed);
    const measured = new Set(input.events.filter(e => !AI_EVENTS.has(e.type) && !rev.has(e.id) && Date.parse(e.detected_at) >= since).map(e => e.domain));
    const backed = g.domains.map(d => measured.has(d));
    expect(backed.indexOf(false) === -1 || backed.slice(backed.indexOf(false)).every(b => !b)).toBe(true);
    expect(g.domains.some(d => !measured.has(d))).toBe(true);
    const names = new Map(input.sites.map(x => [x.domain, x.name]));
    const named = g.domains.filter(d => (g.deck ?? "").includes(brandName(d, names.get(d))));
    expect(named.length).toBeLessThanOrEqual(AGAINST_NAMED_MAX);
    if (g.domains.length > AGAINST_NAMED_MAX) expect(g.deck).toMatch(/more moved against the grain too/);
  });
  it("3 · fewer than three qualifying brands: the piece does not run that week", () => {
    const counters = all20.candidates.filter(c => c.type === "counter_move"), keep = new Set([...new Set(counters.map(c => c.domains[0]!))].slice(0, 2));
    const thin = { ...input, events: input.events.filter(e => keep.has(e.domain) || !counters.some(c => c.domains[0] === e.domain)) } as BuildInput;
    expect(runGolden(thin).plan.some(p => p.id.startsWith("against:") && p.status === "published")).toBe(false);
  });
  it("4 · the tape keeps one line per brand, change and day; a change seen on two pages ends with the pages", () => {
    const ev = input.events.filter(e => e.detected_at.startsWith("2026-11-20")), names = new Map(input.sites.map(x => [x.domain, x.name]));
    const rows = tapeRows(ev, () => ({}), d => names.get(d));
    const lines = rows.map(r => r.tape);
    expect(new Set(lines).size).toBe(lines.length);
    const sofi = lines.filter(l => l.startsWith("SoFi · headline font"));
    expect(sofi).toHaveLength(1);
    const multi = rows.filter(r => r.pages.length > 1);
    for (const r of multi) expect(r.tape.endsWith(r.pages.join(", "))).toBe(true);
  });
  it("5 · the re-plan: a published story that lost its place is retired “Held: over the daily cap”; Netlify is restored; nothing is deleted", () => {
    const stored = [
      { id: "against:2026-W47", type: "roundup", state: "published" as const, happened_at: "2026-11-20T13:50:00Z" },
      { id: "roundup:all:aesthetic:minimal:2026-11-13", type: "roundup", state: "published" as const, happened_at: "2026-11-20T13:37:00Z" },
      { id: "roundup:dev-tools:aesthetic:editorial:2026-11-14", type: "roundup", state: "published" as const, happened_at: "2026-11-20T13:39:00Z" },
      { id: "brand:sofi.com:2026-11-20", type: "move", state: "published" as const, happened_at: "2026-11-20T10:52:00Z" },
      { id: "brand:netlify.com:2026-11-20", type: "rebrand", state: "held" as const, happened_at: "2026-11-20T09:29:00Z" },
    ];
    const r = replanEdits(stored, p20.map(p => ({ id: p.id, status: p.status, reason: p.reason })), "2026-11-20");
    expect(r.restores.map(x => x.id)).toEqual(["brand:netlify.com:2026-11-20"]);
    expect(r.kills).toEqual(expect.arrayContaining([{ id: "roundup:all:aesthetic:minimal:2026-11-13", note: E2B_REPLAN.cap }, { id: "roundup:dev-tools:aesthetic:editorial:2026-11-14", note: E2B_REPLAN.cap }]));
    // E2c: the approved against-the-grain reading is back, so today's plan produces that piece again and a re-plan would no longer retire it.
    expect(r.kills.some(k => k.id === "against:2026-W47")).toBe(false);
    expect(r.kills.some(k => k.id === "brand:sofi.com:2026-11-20")).toBe(false);
  });
});
