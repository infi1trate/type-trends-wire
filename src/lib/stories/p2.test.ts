// P2 · a crossover or a stage change compares like with like: the earlier run read at least 80% of the later run's homepages, and 15.
import { describe, expect, it } from "vitest";
import type { SignalRow } from "../signals";
import { context, crossoverCandidates, homepagesRead, readComparable, shiftCandidates, type BuildInput, type ReadGrowth, type SiteNow } from "./candidates";
import { allCandidates } from "./editor";
import { MORE_READ_EXAMPLES, MORE_READ_REASON, READ_GROWTH_MIN_BASE, READ_GROWTH_MIN_RATIO } from "./types";

const NOW = "2026-11-22T12:00:00.000Z", DAY = 864e5, at = (d: number) => new Date(Date.parse("2026-11-22T09:30:00Z") - d * DAY).toISOString();
const row = (key: string, scope: string, share: number, n: number, o: Partial<SignalRow> = {}): SignalRow => ({ dimension: key.slice(0, key.indexOf(":")), value: key.slice(key.indexOf(":") + 1), scope, status: "ok", stage: "accelerating", momentum: 0.3, current_share: share, next_wave_score: 1, sites: 20, sample: { q: "2026Q4", n, s: share }, ...o });
const SECTORS = ["media", "dev-tools"];
const sites = (): SiteNow[] => SECTORS.flatMap(s => Array.from({ length: 30 }, (_, i) => ({ domain: `${s}${i}.com`, name: null, sector: s, captured: "2026-11-21T00:00:00Z", traits: i < 7 ? ["hero_layout:split_left_text", "tone:calm"] : [] })));
const input = (runs: BuildInput["runs"]): BuildInput => ({ now: NOW, events: [], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], sites: sites(), runs });
// Runs 13 and 16 for the two held stories: media 1 of 12 → 7 of 28 (split, text left) and 1 of 12 → 5 of 28 (calm); dev tools lead.
const runs = (mediaRead13: number) => [
  { id: 13, at: at(7), rows: [row("hero_layout:split_left_text", "all", 0.2, 281), row("hero_layout:split_left_text", "media", 1 / 12, mediaRead13), row("hero_layout:split_left_text", "dev-tools", 0.4, 30),
    row("tone:calm", "all", 0.2, 281), row("tone:calm", "media", 1 / 12, mediaRead13), row("tone:calm", "dev-tools", 0.4, 30)] },
  { id: 16, at: at(0), rows: [row("hero_layout:split_left_text", "all", 0.238, 286), row("hero_layout:split_left_text", "media", 0.25, 28), row("hero_layout:split_left_text", "dev-tools", 0.433, 30),
    row("tone:calm", "all", 0.2, 286), row("tone:calm", "media", 5 / 28, 28), row("tone:calm", "dev-tools", 0.4, 30)] },
];

describe("P2 · more homepages read is not a change", () => {
  it("the thresholds are 80% and 15", () => { expect(READ_GROWTH_MIN_RATIO).toBe(0.8); expect(READ_GROWTH_MIN_BASE).toBe(15); });
  it("12 media homepages read in run 13 against 28 in run 16: neither crossover is built; both are recorded", () => {
    const ctx = context(input(runs(12)));
    const refused: ReadGrowth[] = [];
    expect(crossoverCandidates(ctx, refused).map(c => c.id)).toEqual([]);
    expect(refused.map(r => r.id).sort()).toEqual(MORE_READ_EXAMPLES.map(e => e.id).slice().sort());
    expect(refused[0]).toMatchObject({ reason: MORE_READ_REASON, earlier: { run: 13, read: 12 }, later: { run: 16, read: 28 } });
    // the engine as a whole records them and builds no story
    const all = allCandidates(input(runs(12)));
    expect(all.candidates.some(c => c.id.startsWith("crossover:"))).toBe(false);
    expect(all.moreRead?.map(r => r.id).sort()).toEqual(MORE_READ_EXAMPLES.map(e => e.id).slice().sort());
  });
  it("24 read against 28 is like with like (24 ≥ 22.4): built", () => {
    expect(crossoverCandidates(context(input(runs(24)))).map(c => c.id).sort()).toEqual(MORE_READ_EXAMPLES.map(e => e.id).slice().sort());
  });
  it("the earlier run must read at least 15, and an unknown count is not comparable", () => {
    expect(readComparable(row("tone:calm", "media", 0.1, 14), row("tone:calm", "media", 0.2, 15))).toBe(false);
    expect(readComparable(row("tone:calm", "media", 0.1, 15), row("tone:calm", "media", 0.2, 18))).toBe(true);
    expect(readComparable(row("tone:calm", "media", 0.1, 15), row("tone:calm", "media", 0.2, 19))).toBe(false);
    expect(readComparable(row("tone:calm", "media", 0.1, 30, { sample: null }), row("tone:calm", "media", 0.2, 30))).toBe(false);
    expect(homepagesRead(row("tone:calm", "media", 0.1, 28))).toBe(28);
  });
  it("a stage change library-wide follows the same rule", () => {
    const shift = (n13: number) => context(input([{ id: 13, at: at(7), rows: [row("tone:calm", "all", 0.2, n13, { stage: "flat" })] }, { id: 16, at: at(0), rows: [row("tone:calm", "all", 0.25, 286, { stage: "accelerating" })] }]));
    const a = shift(281); a.headline.add("tone:calm"); expect(shiftCandidates(a).map(c => c.id)).toEqual(["shift:tone:calm:16"]);
    const b = shift(120); b.headline.add("tone:calm"); const refused: ReadGrowth[] = [];
    expect(shiftCandidates(b, refused)).toEqual([]); expect(refused.map(r => r.id)).toEqual(["shift:tone:calm:16"]);
  });
});

describe("P2 · the terminal's story list is sent whole", () => {
  it("its first view carries every published row of the last seven days, newest first, and the held count", async () => {
    const { queueHead } = await import("./view");
    const row = (id: string, at: string) => ({ id, evidence: `/stories/${id}`, score: 50, number: 1, type: "move", headline: id, state: "published", reason: "", killReason: null, at, kicker: "", whyRan: null });
    const m = { published: Array.from({ length: 12 }, (_, i) => row(`s${i}`, `2026-11-22T${String(10 - (i % 10)).padStart(2, "0")}:00:00Z`)), held: [row("h", "2026-11-22T09:00:00Z")], killed: [] } as never;
    const h = queueHead(m);
    expect(h.published).toHaveLength(12);
    expect(h.held).toBe(1);
    expect(Object.keys(h.published[0]!).sort()).toEqual(["at", "evidence", "headline", "id", "killReason", "number", "reason", "score", "state", "type"]);
  });
});
