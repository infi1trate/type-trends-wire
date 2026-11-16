// Pure selection of the brief's "one call to watch" and the card model built from stored forecast evidence.
import { qIdx, qLabel, type CardModel } from "./card";
import { label as traitLabel } from "../labels";
export const USABLE_N = 15, USABLE_COVERAGE = 0.25, MIN_SERIES = 2;
type Citation = { kind: string; id: string };
export type BriefLike = { headline: string; watch?: { id: string; call: string } | null; sections: { title: string; body: string; citations: Citation[] }[] };
export type ForecastLike = { dimension: string; value: string; scope: string; stage: string | null; current_share: number | null; momentum: number | null; quarters: { q: string; s: number | null; n: number; c: number }[] | null; proj_q1: number | null; proj_q1_lo: number | null; proj_q1_hi: number | null; proj_q2: number | null; proj_q2_lo: number | null; proj_q2_hi: number | null; proj_q4: number | null; proj_q4_lo: number | null; proj_q4_hi: number | null; run_id?: number | null };
export type AlertLike = { title: string; ref: string | null; url: string; tags: string[] | null; published_at: string };
export const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim().slice(0, 200);
/** The call: explicit brief.watch, else the first forecast citation of "Next wave", else of any section. Text is the brief's own sentence. */
export function briefCall(brief: BriefLike): { id: string; call: string } | null {
  if (brief.watch?.id) return { id: brief.watch.id, call: brief.watch.call };
  const sections = [...brief.sections.filter(s => s.title === "Next wave"), ...brief.sections.filter(s => s.title !== "Next wave")];
  for (const s of sections) { const c = s.citations.find(x => x.kind === "forecast"); if (c) return { id: c.id, call: firstSentence(s.body) }; }
  return null;
}
export const parseTraitId = (id: string) => { const parts = id.split(":"); const scope = parts.length >= 3 ? parts.at(-1)! : "all"; return { dimension: parts[0] ?? "", value: (parts.length >= 3 ? parts.slice(1, -1) : parts.slice(1)).join(":"), scope }; };
export function usableSeries(r: Pick<ForecastLike, "quarters">) { return (r.quarters ?? []).filter(p => p.s !== null && p.n >= USABLE_N && p.c >= USABLE_COVERAGE).map(p => ({ q: p.q, s: p.s!, n: p.n })); }
export function cardModel(args: { week: string; run_id: number; origin: "call" | "alert"; call: string; row: ForecastLike; data_through: string | null; source_ref: string }): CardModel {
  const { row } = args, series = usableSeries(row), last = series.at(-1), base = last ? qIdx(last.q) : null;
  const proj = ([[1, row.proj_q1, row.proj_q1_lo, row.proj_q1_hi], [2, row.proj_q2, row.proj_q2_lo, row.proj_q2_hi], [4, row.proj_q4, row.proj_q4_lo, row.proj_q4_hi]] as const)
    .filter(([, m, l, h]) => m != null && l != null && h != null).map(([hz, m, l, h]) => ({ q: qLabel((base ?? 0) + hz), mid: m!, lo: l!, hi: h! }));
  return { week: args.week, run_id: args.run_id, origin: args.origin, trait: `${row.dimension}:${row.value}`, scope: row.scope, label: traitLabel(`${row.dimension}:${row.value}`).name, stage: row.stage, momentum_pts_q: row.momentum, share: row.current_share, n: last?.n ?? null, call: args.call, data_through: args.data_through, series, forecast: base === null ? [] : proj, source_ref: args.source_ref, forecast_run: row.run_id ?? null };
}
/** Top breakout alert (newest first, then by excerpt order) → trait + sector scope. */
export function breakoutAlert(alerts: AlertLike[]) {
  const a = [...alerts].filter(x => x.tags?.includes("breakout") && x.ref).sort((x, y) => y.published_at.localeCompare(x.published_at))[0];
  if (!a) return null;
  const sector = /[?&]sector=([^&]+)/.exec(a.url)?.[1];
  return { trait: a.ref!, scope: sector ? decodeURIComponent(sector) : "all", title: a.title };
}
/** Picks this week's card. With a headline set (tiers.ts), only headline signals qualify; `fallback` lists headline keys (best first) used when neither the brief's call nor a breakout alert does. */
export function pickCard(args: { week: string; run_id: number; brief: BriefLike; rows: ForecastLike[]; alerts: AlertLike[]; data_through: string | null; headline?: Set<string> | null; fallback?: string[] }): CardModel | null {
  const find = (dimension: string, value: string, scope: string) => args.rows.find(r => r.dimension === dimension && r.value === value && r.scope === scope);
  const ok = (key: string) => !args.headline || args.headline.has(key);
  const call = briefCall(args.brief) && ok(`${parseTraitId(briefCall(args.brief)!.id).dimension}:${parseTraitId(briefCall(args.brief)!.id).value}`) ? briefCall(args.brief) : null;
  if (call) { const t = parseTraitId(call.id), row = find(t.dimension, t.value, t.scope); if (row && usableSeries(row).length >= MIN_SERIES) return cardModel({ week: args.week, run_id: args.run_id, origin: "call", call: call.call, row, data_through: args.data_through, source_ref: `forecast:${call.id}` }); }
  const found = breakoutAlert(args.alerts), alert = found && ok(found.trait) ? found : null;
  if (alert) { const t = parseTraitId(alert.trait), row = find(t.dimension, t.value, alert.scope) ?? find(t.dimension, t.value, "all"); if (row && usableSeries(row).length >= MIN_SERIES) return cardModel({ week: args.week, run_id: args.run_id, origin: "alert", call: alert.title, row, data_through: args.data_through, source_ref: `alert:${alert.trait}:${alert.scope}` }); }
  for (const key of args.fallback ?? []) {
    if (!ok(key)) continue;
    const t = parseTraitId(key), row = find(t.dimension, t.value, "all");
    if (row && usableSeries(row).length >= MIN_SERIES) return cardModel({ week: args.week, run_id: args.run_id, origin: "call", call: `${traitLabel(key).name}: the strongest headline next-wave score this week.`, row, data_through: args.data_through, source_ref: `forecast:${key}:all` });
  }
  return null;
}
export const WEEK_RE = /^\d{4}-W\d{2}$/;
/** "2026-W46" → 1200×675; "2026-W46-1080x1350" → portrait. */
export function parseCardParam(param: string): { week: string; size: "1200x675" | "1080x1350" } | null {
  const m = /^(\d{4}-W\d{2})(?:-(1200x675|1080x1350))?$/.exec(param);
  return m ? { week: m[1]!, size: (m[2] as "1200x675" | "1080x1350" | undefined) ?? "1200x675" } : null;
}
