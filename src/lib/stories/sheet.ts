// U2b · one count per claim. A story's numbers for a signal and scope come from one place: the forecast run's latest-quarter sample
// (the same sample that gives the signal its stage). The writer's facts sheet and the story page's evidence list are both built here,
// so the text and the list can never carry two counts for one thing. Pure.
import { basis as basisOf, canonical, label, storySectorName as sectorName, stageName } from "../labels";
import type { Fact } from "./types";

export type ShareBase = { count: number; base: number };
/** A forecast row as far as this module needs it: its share and its latest stored quarter ({ q, n, s }). */
export type SampleRow = { current_share: number | null; stage?: string | null; momentum?: number | null; sample?: unknown };
/** The count and base behind a stored share, from a forecast row's quarters (each { q, n, s }): the latest quarter whose share is the
 *  row's current share, counted as round(s × n) of n. Null when no quarter matches. */
export function baseOf(quarters: unknown, share: number | null | undefined): ShareBase | null {
  if (share == null || !Array.isArray(quarters)) return null;
  for (const q of [...quarters].reverse()) {
    const x = q && typeof q === "object" ? (q as { n?: unknown; s?: unknown }) : {};
    if (typeof x.n !== "number" || typeof x.s !== "number" || x.n <= 0 || Math.abs(x.s - share) > 1e-9) continue;
    const count = Math.round(x.s * x.n);
    return Math.abs(count / x.n - share) < 1e-9 ? { count, base: x.n } : null;
  }
  return null;
}
/** The run's own count and base for one row: its latest-quarter sample { q, n, s } when that sample is the row's current share,
 *  counted as round(s × n) of n. Null when the row has no sample or the sample is another quarter's share. */
export function runBase(r: SampleRow | null | undefined): ShareBase | null {
  const x = r?.sample && typeof r.sample === "object" ? (r.sample as { n?: unknown; s?: unknown }) : null;
  if (!x || r?.current_share == null || typeof x.n !== "number" || typeof x.s !== "number" || x.n <= 0) return null;
  if (Math.abs(x.s - r.current_share) > 1e-6) return null;
  const count = Math.round(x.s * x.n);
  // A share stored to five decimals still names one count (steps of 1/n are far wider than the rounding).
  return Math.abs(count / x.n - x.s) < Math.min(1e-4, 0.25 / x.n) ? { count, base: x.n } : null;
}
/** The quarter a row's sample was counted in ("2026Q4"), or null. */
export const sampleQuarter = (r: SampleRow | null | undefined): string | null => {
  const s = r?.sample; return s && typeof s === "object" && typeof (s as { q?: unknown }).q === "string" ? (s as { q: string }).q : null;
};

const pct1 = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
/** One library number for the writer, its share beside its own count and base: "Technical voice: 4 of 29 tracked Health homepages with an AI read (13.8%), Rising". */
export function shareLine(o: { name: string; share: number; where: string; basis: "ai" | "measured"; base: ShareBase | null; stage?: string | null; momentum?: number | null }): string {
  const tail = `${o.stage ? `, ${o.stage}` : ""}${typeof o.momentum === "number" ? `, momentum ${o.momentum.toFixed(1)} points a quarter` : ""}`;
  if (!o.base) return `${o.name}: ${pct1(o.share)} of tracked ${o.where}homepages${tail}`;
  const read = o.basis === "ai" ? " with an AI read" : " in the latest quarter";
  return `${o.name}: ${o.base.count} of ${o.base.base} tracked ${o.where}homepages${read} (${pct1(o.base.count / o.base.base)})${tail}`;
}

/** A sheet number: the line, its basis, and the signal and scope it counts. */
export type SheetNumber = { text: string; basis: "ai" | "measured"; key: string; scope: string; /** The same line with the reader's stage word ("Rising"), for the page list. */ shown?: string };
/** Row lookup by canonical key and scope ("all" or a sector). */
export type RowOf = (key: string, scope: string) => SampleRow | null | undefined;
/** The numbers for a story's first three signals, library-wide and in its sector, each with the run's own count and base. `bases` (the
 *  older all-quarters read) only fills a row whose latest sample does not match its share. */
export function sheetNumbers(row: RowOf, keys: string[], sector: string | null, bases: ReadonlyMap<string, ShareBase> = new Map()): SheetNumber[] {
  return keys.slice(0, 3).flatMap(k => {
    const ck = canonical(k), b = basisOf(k) === "ai" ? "ai" as const : "measured" as const, n = label(k).name;
    const one = (scope: string, where: string): SheetNumber[] => {
      const r = row(ck, scope); if (r?.current_share == null) return [];
      const base = runBase(r) ?? bases.get(`${ck}|${scope}`) ?? null;
      const line = (stage: string | null) => shareLine({ name: n, share: r.current_share!, where, basis: b, base, stage, momentum: r.momentum ?? null });
      // N5 · the writer reads the stage key, except "flat", which it read as a share that stands still (No. 94: "its share is flat"
      // beside momentum 1.6 points a quarter); it reads the reader's word "steady" instead, as the page's own list says.
      return [{ text: line(r.stage === "flat" ? "steady" : r.stage ?? null), basis: b, key: ck, scope, shown: line(stageName(r.stage) ?? r.stage ?? null) }];
    };
    return [...one("all", ""), ...(sector ? one(sector, `${sectorName(sector)} `) : [])];
  });
}

/** The signal and scope a stored count or share line counts, or null when it counts something a sheet number does not (another sector's
 *  share, "brands in other sectors", a line without a signal link). */
export function factCovers(f: Fact, sector: string | null): { key: string; scope: string } | null {
  if (f.kind !== "count" && f.kind !== "share") return null;
  if (/other sectors|elsewhere|leading sector/i.test(f.text) || !f.href) return null;
  const m = /^\/(?:signals|patterns)\/([^?#]+)(?:\?([^#]*))?/.exec(f.href); if (!m) return null;
  let key: string; try { key = canonical(decodeURIComponent(m[1]!)); } catch { return null; }
  const q = new URLSearchParams(m[2] ?? ""), s = q.get("sector");
  if (s) return { key, scope: s };
  // A breakout's "On 30.0% of tracked dev tools homepages" names its sector in words.
  if (sector && f.text.toLowerCase().includes(`${sectorName(sector).toLowerCase()} `)) return { key, scope: sector };
  return { key, scope: "all" };
}
/** Stored lines minus every count or share a sheet number already covers (same signal, same scope). */
export const uncovered = (facts: Fact[], numbers: SheetNumber[], sector: string | null): Fact[] => {
  const have = new Set(numbers.map(n => `${n.key}|${n.scope}`));
  return facts.filter(f => { const c = factCovers(f, sector); return !c || !have.has(`${c.key}|${c.scope}`); });
};
const signalHref = (key: string, scope: string) => `/signals/${encodeURIComponent(key)}${scope !== "all" ? `?sector=${encodeURIComponent(scope)}` : ""}`;
/** The evidence list from the sheet: the stored lines the sheet kept, then each sheet number with its receipt. */
export const sheetFacts = (facts: Fact[], numbers: SheetNumber[], sector: string | null): Fact[] => [
  ...uncovered(facts, numbers, sector),
  ...numbers.map(n => ({ text: n.shown ?? n.text, href: signalHref(n.key, n.scope), basis: n.basis, kind: "share" as const })),
];

/** White-space headline wording follows its count: "Almost no" only at most two brands or at most 5%; otherwise "Few". */
export const ALMOST_NONE_MAX_COUNT = 2;
export const ALMOST_NONE_MAX_SHARE = 0.05;
export const almostNone = (count: number, base: number) => count <= ALMOST_NONE_MAX_COUNT || (base > 0 && count / base <= ALMOST_NONE_MAX_SHARE);
export const whiteSpaceHeadline = (o: { count: number; base: number; sector: string; signal: string; stage: string }) =>
  `${almostNone(o.count, o.base) ? "Almost no" : "Few"} ${o.sector} brand${almostNone(o.count, o.base) ? "" : "s"} ${almostNone(o.count, o.base) ? "uses" : "use"} ${o.signal}; it is ${o.stage} everywhere else`;

/** The forecast run a story counts from: its own run (`run:<id>` in its sources; the latest when several), else null (the caller then
 *  uses the latest real run at the text's time). */
export const storyRunId = (sourceIds: string[]): number | null => {
  const ids = sourceIds.flatMap(x => { const m = /^run:(\d+)$/.exec(x); return m ? [Number(m[1])] : []; });
  return ids.length ? Math.max(...ids) : null;
};
