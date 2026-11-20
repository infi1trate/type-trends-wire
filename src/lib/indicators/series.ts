// Leading indicators (W2), pure: the ingest payload, number wording, the honest change rule, and the page model. Numbers are shown
// as levels and directions only; nothing here claims an indicator causes or predicts anything.
import { z } from "zod";
import { TOPIC_ORDER, topicName, topicAnchor } from "./topics";

// INGEST ------------------------------------------------------------------------------------------------
export const SERIES_MAX_POINTS = 200;
export const SERIES_BODY_LIMIT = 256 * 1024;
/** Sources the page knows how to describe; other sources of valid shape are stored but not shown. */
export const KNOWN_SOURCES = ["npm", "github"] as const;
export const SOURCE_NAME: Record<(typeof KNOWN_SOURCES)[number], string> = { npm: "npm", github: "GitHub" };
export const isKnownSource = (s: string): s is (typeof KNOWN_SOURCES)[number] => (KNOWN_SOURCES as readonly string[]).includes(s);

const isDate = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s; };
export const seriesPoint = z.object({
  source: z.string().regex(/^[a-z]{2,24}$/, "must be one lowercase word of 2 to 24 letters"),
  key: z.string().min(1).max(214),
  metric: z.string().regex(/^[a-z][a-z_]{1,39}$/, "must be a lowercase word such as downloads_week or stars"),
  value: z.number().int("must be a whole number").min(0, "must be zero or more").max(Number.MAX_SAFE_INTEGER),
  period_end: z.string().refine(isDate, "must be a date (YYYY-MM-DD)"),
  label: z.string().trim().min(1).max(120),
  topic: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, "must be a lowercase word such as styling or 3d"),
}).strict();
export const seriesPayload = z.object({
  run_id: z.string().min(1).max(120),
  captured_at: z.string().datetime({ offset: true }),
  points: z.array(seriesPoint).min(1, "must hold at least one point").max(SERIES_MAX_POINTS, `holds at most ${SERIES_MAX_POINTS} points per request`),
}).strict();
export type SeriesPoint = z.infer<typeof seriesPoint>;
export type SeriesPayload = z.infer<typeof seriesPayload>;
/** One point per (source, key, metric, period_end): a repeat inside one request keeps the last value. */
export function dedupePoints(points: SeriesPoint[]): SeriesPoint[] {
  const m = new Map<string, SeriesPoint>();
  for (const p of points) { const k = `${p.source}|${p.key}|${p.metric}|${p.period_end}`; m.delete(k); m.set(k, p); }
  return [...m.values()];
}

// WORDING -----------------------------------------------------------------------------------------------
const trim1 = (x: number) => { const r = Math.round(x * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const scaled = (n: number, unit: number, word: string) => { const x = n / unit; return `${x < 10 ? trim1(x) : String(Math.round(x))} ${word}`; };
/** For reading: 190424610 → "190 million", 1234567 → "1.2 million", 858908 → "859 thousand", 950 → "950". */
export function readable(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  const units: [number, string][] = [[1e3, "thousand"], [1e6, "million"], [1e9, "billion"]];
  let i = -1; for (let j = 0; j < units.length; j++) if (a >= units[j]![0]) i = j;
  if (i < 0) return sign + String(Math.round(a));
  // Round first so 999,999 reads "1 million", not "1000 thousand".
  const rounded = (u: number) => { const x = a / u; return x < 10 ? Math.round(x * 10) / 10 : Math.round(x); };
  if (rounded(units[i]![0]) >= 1000 && i < units.length - 1) i++;
  return sign + scaled(a, units[i]![0], units[i]![1]);
}
/** Exact value with thousands separators (Data view, figure titles). */
export const exact = (n: number): string => Math.round(n).toLocaleString("en-US");
/** "+12%", "−3.4%", "0%". */
export function pctText(p: number): string {
  const a = Math.abs(p), t = a < 10 ? trim1(a) : String(Math.round(a));
  return t === "0" ? "0%" : `${p > 0 ? "+" : "−"}${t}%`;
}

// CHANGE RULE -------------------------------------------------------------------------------------------
/** A change needs two points at least this many days apart. */
export const CHANGE_MIN_DAYS = 21;
/** The change compares the latest point with the one closest to this many days earlier. */
export const CHANGE_TARGET_DAYS = 28;
/** Small lines appear once a row has at least this many weekly values. */
export const SPARK_MIN = 4;
/** Weekly values shown in the small line (the newest). */
export const SPARK_MAX = 26;
export type Pt = { period_end: string; value: number };
const dayOf = (s: string) => Date.parse(`${s}T00:00:00Z`) / 864e5;
/** Change against about four weeks earlier, or null (a quiet dash) when no point lies at least 21 days before the latest, or the
 *  earlier value is zero (no percentage of nothing). */
export function changeOver(points: Pt[]): { pct: number; from: Pt; to: Pt } | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.period_end.localeCompare(b.period_end)), to = sorted[sorted.length - 1]!, end = dayOf(to.period_end);
  const earlier = sorted.filter(p => end - dayOf(p.period_end) >= CHANGE_MIN_DAYS);
  if (!earlier.length) return null;
  const from = earlier.reduce((best, p) => Math.abs(end - dayOf(p.period_end) - CHANGE_TARGET_DAYS) < Math.abs(end - dayOf(best.period_end) - CHANGE_TARGET_DAYS) ? p : best);
  if (from.value <= 0) return null;
  return { pct: ((to.value - from.value) / from.value) * 100, from, to };
}

// PAGE MODEL --------------------------------------------------------------------------------------------
export type SeriesRow = Pt & { source: string; key: string; metric: string; label: string; topic: string; captured_at?: string };
export type IndicatorRow = {
  label: string; topic: string;
  npm: { key: string; href: string; installs: Pt | null; change: { pct: number; text: string; from: Pt; to: Pt } | null; weekly: Pt[] } | null;
  github: { key: string; href: string; stars: Pt | null; forks: Pt | null; issues: Pt | null } | null;
};
export type TopicTable = { topic: string; name: string; anchor: string; rows: IndicatorRow[] };
const latest = (pts: Pt[]) => pts.reduce<Pt | null>((b, p) => (!b || p.period_end > b.period_end ? p : b), null);
export const npmHref = (key: string) => `https://www.npmjs.com/package/${key.split("/").map(encodeURIComponent).join("/")}`;
export const githubHref = (key: string) => `https://github.com/${key.split("/").map(encodeURIComponent).join("/")}`;

/** Rows joined by label (one npm key and one GitHub key share it), only known sources, grouped into topic tables in page order
 *  (unknown topics after, alphabetically), each sorted by installs. `rows` are the stored (weekly-sampled) points. */
export function indicatorTables(rows: SeriesRow[]): TopicTable[] {
  const by = new Map<string, SeriesRow[]>();
  for (const r of rows) { if (!isKnownSource(r.source)) continue; const a = by.get(r.label) ?? []; a.push(r); by.set(r.label, a); }
  const out: IndicatorRow[] = [];
  for (const [label, rs] of by) {
    const newest = rs.reduce((b, r) => (r.period_end > b.period_end ? r : b));
    const pts = (source: string, metric: string) => rs.filter(r => r.source === source && r.metric === metric).map(r => ({ period_end: r.period_end, value: r.value }));
    const keyOf = (source: string) => rs.filter(r => r.source === source).reduce<SeriesRow | null>((b, r) => (!b || r.period_end > b.period_end ? r : b), null)?.key ?? null;
    const nk = keyOf("npm"), gk = keyOf("github");
    const dl = pts("npm", "downloads_week").sort((a, b) => a.period_end.localeCompare(b.period_end)), ch = changeOver(dl);
    out.push({
      label, topic: newest.topic,
      npm: nk ? { key: nk, href: npmHref(nk), installs: latest(dl), change: ch ? { ...ch, text: pctText(ch.pct) } : null, weekly: dl.length >= SPARK_MIN ? dl.slice(-SPARK_MAX) : [] } : null,
      github: gk ? { key: gk, href: githubHref(gk), stars: latest(pts("github", "stars")), forks: latest(pts("github", "forks")), issues: latest(pts("github", "open_issues")) } : null,
    });
  }
  const order = (t: string) => { const i = (TOPIC_ORDER as readonly string[]).indexOf(t); return i < 0 ? TOPIC_ORDER.length : i; };
  const topics = [...new Set(out.map(r => r.topic))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return topics.map(t => ({ topic: t, name: topicName(t), anchor: topicAnchor(t), rows: out.filter(r => r.topic === t).sort(byInstalls) }));
}
export const byInstalls = (a: IndicatorRow, b: IndicatorRow) => (b.npm?.installs?.value ?? -1) - (a.npm?.installs?.value ?? -1) || a.label.localeCompare(b.label);
/** Every known topic table in page order, empty ones included (the page always shows its tables). */
export function allTables(tables: TopicTable[]): TopicTable[] {
  const have = new Map(tables.map(t => [t.topic, t]));
  return [...TOPIC_ORDER.map(t => have.get(t) ?? { topic: t, name: topicName(t), anchor: topicAnchor(t), rows: [] }), ...tables.filter(t => !(TOPIC_ORDER as readonly string[]).includes(t.topic))];
}

// GOOGLE FONTS ------------------------------------------------------------------------------------------
/** Risers are ranked among families now inside this popularity rank, so a jump deep in the long tail does not lead the list. */
export const FONT_RISER_POOL = 500;
export const FONT_RISERS = 10;
export type FontRank = { family: string; rank: number };
export type FontRisers =
  | { mode: "risers"; now: string; then: string; since: string; items: { family: string; now: number; then: number }[] }
  | { mode: "top"; now: string; since: string; items: { family: string; now: number }[] }
  | { mode: "none" };
/** Ten fastest risers by positions gained between `now` and the stored day about four weeks earlier; without such a day, the current
 *  top ten and the day ranks were first kept. */
export function fontRisers(nowDay: string | null, nowRanks: FontRank[], thenDay: string | null, thenRanks: FontRank[], since: string | null): FontRisers {
  if (!nowDay || !nowRanks.length) return { mode: "none" };
  const first = since ?? nowDay;
  if (!thenDay || dayOf(nowDay) - dayOf(thenDay) < CHANGE_MIN_DAYS) return { mode: "top", now: nowDay, since: first, items: [...nowRanks].sort((a, b) => a.rank - b.rank).slice(0, FONT_RISERS).map(r => ({ family: r.family, now: r.rank })) };
  const then = new Map(thenRanks.map(r => [r.family, r.rank]));
  const items = nowRanks.filter(r => r.rank <= FONT_RISER_POOL && then.has(r.family) && then.get(r.family)! > r.rank)
    .map(r => ({ family: r.family, now: r.rank, then: then.get(r.family)! }))
    .sort((a, b) => (b.then - b.now) - (a.then - a.now) || a.now - b.now || a.family.localeCompare(b.family)).slice(0, FONT_RISERS);
  return { mode: "risers", now: nowDay, then: thenDay, since: first, items };
}

// CSV ---------------------------------------------------------------------------------------------------
const cell = (v: string | number | null | undefined) => { if (v === null || v === undefined) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const CSV_HEAD = ["library", "topic", "npm_package", "installs_week", "installs_period_end", "change_4w_pct", "github_repo", "stars", "forks", "open_issues"] as const;
/** Exactly the Data view's rows, in its order, exact values. */
export function toCsv(rows: IndicatorRow[]): string {
  const lines = [CSV_HEAD.join(",")];
  for (const r of rows) lines.push([r.label, r.topic, r.npm?.key, r.npm?.installs?.value, r.npm?.installs?.period_end, r.npm?.change ? Math.round(r.npm.change.pct * 10) / 10 : null,
    r.github?.key, r.github?.stars?.value, r.github?.forks?.value, r.github?.issues?.value].map(cell).join(","));
  return lines.join("\n") + "\n";
}
