// U2 · RECEIPTS IN PLACE — a receipt link on a Read page opens a drawer over the page (`?receipt=<type>:<id>`), showing the record behind
// the number in the Data look. Each receipt type has a small pure model builder; the server only loads rows and calls these. Pure.
import { brandDataPath, dataHref, type ObjectRef } from "../ia";
import { BASIS_WORD, label, type Basis } from "../labels";
import { brandName } from "../brand-names";
import { betweenDates, tapeDate } from "../tape";
import type { Json } from "@/integrations/supabase/types";

export const RECEIPT_TYPES = ["share", "change", "story", "census", "forecast", "figure"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];
export type ReceiptRef = { type: ReceiptType; id: string };
/** `?receipt=` value → its type and id (ids keep their own colons: "share:css:subgrid", "figure:who-went-big-first:adoption"). */
export function parseReceipt(v: unknown): ReceiptRef | null {
  if (typeof v !== "string" || v.length > 240) return null;
  const i = v.indexOf(":"); if (i < 1) return null;
  const type = v.slice(0, i), id = v.slice(i + 1);
  if (!(RECEIPT_TYPES as readonly string[]).includes(type) || !id || /[\s<>"]/.test(id)) return null;
  if (type === "change" && !/^\d{1,12}$/.test(id)) return null;
  if ((type === "share" || type === "forecast") && !/^[a-z0-9_]+:\S{1,100}$/i.test(id)) return null;
  if (type === "figure" && !/^[a-z0-9-]+:[a-z0-9_-]+$/i.test(id)) return null;
  return { type: type as ReceiptType, id };
}
export const receiptParam = (r: ReceiptRef) => `${r.type}:${r.id}`;

/** What a receipt link on a Read page opens, from its href and where it sits: a story's fact (its single source change, else the story's
 *  changes), a signal's share, a forecast call. Null: the link navigates as it does today (to the one-address Data view where one exists). */
export type ReceiptCtx = { story?: { id: string; census: boolean; eventIds: number[] } | undefined; study?: string | undefined };
export function receiptFor(href: string, ctx: ReceiptCtx = {}): ReceiptRef | null {
  if (!href.startsWith("/")) return null;
  const u = new URL(href, "http://x"), seg = u.pathname.split("/").filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch { return x; } });
  if (ctx.story && (seg[0] === "library" || seg[0] === "brands") && seg[1]) {
    if (ctx.story.census) return { type: "census", id: ctx.story.id };
    return ctx.story.eventIds.length === 1 ? { type: "change", id: String(ctx.story.eventIds[0]) } : { type: "story", id: ctx.story.id };
  }
  if (seg[0] === "terminal" && u.searchParams.get("panel") === "brief" && u.searchParams.get("trait")) return { type: "forecast", id: u.searchParams.get("trait")! };
  if ((seg[0] === "signals" || seg[0] === "trait" || seg[0] === "patterns") && seg[1] && seg.length === 2 && seg[1] !== "leading" && /:/.test(seg[1])) return { type: "share", id: seg[1] };
  if (seg[0] === "stories" && seg[1] && seg.length === 2 && seg[1] !== "no") return { type: seg[1].startsWith("census:") ? "census" : "story", id: seg[1] };
  return null;
}

// MODELS ----------------------------------------------------------------------------------------------------------------------------
export type ReceiptTable = { caption: string; head: string[]; rows: string[][] };
export type ReceiptModel = {
  type: ReceiptType; title: string; kicker: string; lines: string[]; tables: ReceiptTable[];
  /** A chart for share receipts: one point per quarter (null share = not usable). */
  chart?: { label: string; points: { q: string; share: number | null; usable: boolean }[] } | undefined;
  basis?: Basis | null | undefined;
  /** "Open the full Data view →". */
  full: string;
};
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${(v * 100).toFixed(d)}%`);
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "–");
/** The well-covered rule the forecast uses (15+ sites and 25% coverage). */
export const USABLE = { n: 15, coverage: 0.25 } as const;
export type ShareQuarter = { q: string; s: number | null; n: number; c: number };
/** A signal's share by quarter: chart, table with N and coverage, whether it is measured or an AI estimate. */
export function shareReceipt(key: string, basis: Basis, quarters: readonly ShareQuarter[]): ReceiptModel {
  const l = label(key), usable = (p: ShareQuarter) => p.s != null && p.n >= USABLE.n && p.c >= USABLE.coverage;
  const good = quarters.filter(usable), last = good.at(-1);
  return {
    type: "share", title: `${l.name}: share by quarter`, kicker: `SIGNAL · ${l.dimension} · ${BASIS_WORD[basis].toUpperCase()}`, basis,
    lines: [last ? `Latest well-covered quarter ${last.q}: ${pct(last.s)} of N = ${last.n} homepages (coverage ${pct(last.c, 0)}).` : "No quarter has enough coverage yet.",
      `${good.length} of ${quarters.length} quarters are well covered (at least ${USABLE.n} homepages and ${pct(USABLE.coverage, 0)} coverage).`,
      basis === "ai" ? "Read by our AI tagger from homepage captures: an estimate." : "Measured from each page's code and rendered styles."],
    chart: { label: l.name, points: quarters.map(p => ({ q: p.q, share: p.s, usable: usable(p) })) },
    tables: [{ caption: `${l.name}, share of tracked homepages by quarter`, head: ["Quarter", "Share", "N", "Coverage", "Used"], rows: quarters.map(p => [p.q, pct(p.s), String(p.n), pct(p.c, 0), usable(p) ? "yes" : "no"]) }],
    full: dataHref({ type: "signal", id: key }),
  };
}
export type ChangeRow = { id: number; domain: string; type: string; before: Json | null; after: Json | null; detected_at: string | null; effective_at: string | null; page_type: string; viewport: string; snapshot_id: number | null; prev_snapshot_id: number | null; summary: string | null };
export type CaptureRow = { id: number; captured_at: string; source: string };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const val = (v: unknown) => (v == null || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));
/** The fields that differ between two stored values, in key order (equal fields are left out). */
export function changedFields(before: unknown, after: unknown): { field: string; before: string; after: string }[] {
  const b = obj(before), a = obj(after), keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  return keys.filter(k => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null)).map(k => ({ field: k, before: val(b[k]), after: val(a[k]) }));
}
/** A brand change: the two captures either side with their dates, the fields that differ, before and after. */
export function changeReceipt(e: ChangeRow, captures: readonly CaptureRow[]): ReceiptModel {
  const prev = captures.find(c => c.id === e.prev_snapshot_id) ?? null, next = captures.find(c => c.id === e.snapshot_id) ?? null, fields = changedFields(e.before, e.after);
  const href = `${brandDataPath(e.domain)}&page_type=${encodeURIComponent(e.page_type)}&viewport=${encodeURIComponent(e.viewport)}${next ? `&a=${next.id}` : ""}${prev ? `&b=${prev.id}` : ""}`;
  return {
    type: "change", title: `${brandName(e.domain)}: ${e.type.replace(/_/g, " ")}`, kicker: `BRAND CHANGE · ${e.page_type.toUpperCase()} / ${e.viewport.toUpperCase()}`,
    lines: [e.summary ?? `${fields.length} field${fields.length === 1 ? "" : "s"} changed.`, `Seen ${day(e.detected_at)}${e.effective_at && e.effective_at !== e.detected_at ? ` (effective ${day(e.effective_at)})` : ""}.`],
    tables: [
      { caption: "The captures either side", head: ["Capture", "Date", "Source", "Snapshot"], rows: [["Before", day(prev?.captured_at), prev?.source ?? "–", prev ? String(prev.id) : "–"], ["After", day(next?.captured_at), next?.source ?? "–", next ? String(next.id) : "–"]] },
      { caption: "Fields that differ", head: ["Field", "Before", "After"], rows: fields.length ? fields.map(f => [f.field, f.before, f.after]) : [["–", "No stored field differs", ""]] },
    ],
    full: href,
  };
}
/** A change's dates, capture dates first (U2b): "between 11 and 14 Nov" from the captures either side, then the day it was confirmed
 *  ("confirmed 20 Nov"), so a confirmation date is never read as the day a change happened. Pure. */
export function changeDates(c: { before?: string | null | undefined; after?: string | null | undefined; at: string | null; confirmed: boolean }): { captured: string; confirmed: string } {
  const captured = c.before && c.after ? betweenDates(c.before, c.after) : c.after ? tapeDate(c.after) : "–";
  return { captured, confirmed: c.confirmed ? (c.at ? `confirmed ${tapeDate(c.at)}` : "confirmed") : "not confirmed" };
}
/** `at`: when the change was recorded (its confirmation); `seen`: the captures either side, when known. */
export type TapeRow = { id: number; text: string; at: string | null; confirmed: boolean; seen?: { before: string | null; after: string | null } | null };
/** A story's changes: the lines in the latest changes it was built from, and its stored facts. */
export function storyReceipt(s: { id: string; number: number | null; headline: string; kicker: string }, tape: readonly TapeRow[], facts: readonly { text: string; basis: Basis | null }[]): ReceiptModel {
  return {
    type: "story", title: s.headline, kicker: `${s.number != null ? `NO. ${s.number} · ` : ""}${s.kicker.toUpperCase()} · THE CHANGES`,
    lines: [tape.length ? `${tape.length} change${tape.length === 1 ? "" : "s"} behind this story; ${tape.filter(t => t.confirmed).length} confirmed on a second capture.` : "This story is not built from brand changes."],
    tables: [
      ...(tape.length ? [{ caption: "The changes", head: ["Captured", "Change", "Confirmed"], rows: tape.map(t => { const d = changeDates({ before: t.seen?.before, after: t.seen?.after, at: t.at, confirmed: t.confirmed }); return [d.captured, t.text, d.confirmed]; }) }] : []),
      ...(facts.length ? [{ caption: "The facts it states", head: ["Fact", "Basis"], rows: facts.map(f => [f.text, f.basis ? BASIS_WORD[f.basis] : "–"]) }] : []),
    ],
    full: dataHref({ type: "story", id: s.id }),
  };
}
/** A census's lines (the counts a census story states) and its members. */
export function censusReceipt(s: { id: string; number: number | null; headline: string }, lines: readonly string[], members: readonly string[]): ReceiptModel {
  return {
    type: "census", title: s.headline, kicker: `${s.number != null ? `NO. ${s.number} · ` : ""}CENSUS · THE LINES`, lines: [`${lines.length} line${lines.length === 1 ? "" : "s"}, ${members.length} member change${members.length === 1 ? "" : "s"}.`],
    tables: [{ caption: "The lines", head: ["Line"], rows: lines.map(l => [l]) }, ...(members.length ? [{ caption: "The changes that added the word", head: ["Change"], rows: members.map(m => [m]) }] : [])],
    full: dataHref({ type: "story", id: s.id }),
  };
}
export type ForecastRowIn = { stage: string | null; momentum: number | null; next_wave_score: number | null; current_share: number | null; status: string; model: string | null; computed_at: string; run_id: number;
  proj_q1: number | null; proj_q1_lo: number | null; proj_q1_hi: number | null; proj_q2: number | null; proj_q2_lo: number | null; proj_q2_hi: number | null; proj_q4: number | null; proj_q4_lo: number | null; proj_q4_hi: number | null; backtest: unknown };
/** A forecast run's call for one signal: its stage, momentum, next-wave score, projections with their 80% range, and the backtest. */
export function forecastReceipt(key: string, f: ForecastRowIn): ReceiptModel {
  const l = label(key), bt = obj(f.backtest), num = (v: number | null, d = 2) => (v == null ? "–" : v.toFixed(d));
  return {
    type: "forecast", title: `${l.name}: the forecast's call`, kicker: `FORECAST RUN ${f.run_id} · ${day(f.computed_at)}`,
    lines: [`Stage ${f.stage ?? "not staged"} · momentum ${f.momentum == null ? "not measured" : `${f.momentum > 0 ? "+" : ""}${num(f.momentum)} pts a quarter`} · next-wave score ${num(f.next_wave_score)}.`,
      f.status === "ok" ? `Fitted with ${String(f.model ?? "–").toUpperCase()}.` : "Not fitted yet: too few well-covered quarters.",
      bt["status"] === "ok" ? `Backtest: mean error ${num(bt["mae_pts"] as number | null, 1)} pts, hit rate ${pct(bt["hit_rate"] as number | null, 0)}.` : "Not enough history to backtest this signal."],
    tables: [{ caption: "Projection (share of tracked homepages)", head: ["Horizon", "Projected", "80% low", "80% high"], rows: [
      ["Now", pct(f.current_share), "", ""], ["+1 quarter", pct(f.proj_q1), pct(f.proj_q1_lo), pct(f.proj_q1_hi)], ["+2 quarters", pct(f.proj_q2), pct(f.proj_q2_lo), pct(f.proj_q2_hi)], ["+4 quarters", pct(f.proj_q4), pct(f.proj_q4_lo), pct(f.proj_q4_hi)]] }],
    full: dataHref({ type: "signal", id: key }),
  };
}
/** A study figure's table (the same rows the study's own tables show). */
export function figureReceipt(study: { slug: string; number: number; headline: string }, figureId: string, tables: readonly ReceiptTable[]): ReceiptModel {
  return { type: "figure", title: tables[0]?.caption ?? study.headline, kicker: `STUDY NO. ${study.number} · FIGURE`, lines: [study.headline], tables: [...tables], full: dataHref({ type: "study", id: study.slug } as ObjectRef) + `#fig-${figureId}` };
}
/** One table as CSV (RFC 4180 quoting). */
export function tableCsv(t: Pick<ReceiptTable, "head" | "rows">): string {
  // Neutralise spreadsheet formulas (=, +, -, @, tab, CR) unless the cell is a plain number.
  const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^[+-]?\d[\d,]*(\.\d+)?%?$/.test(v) ? `'${v}` : v);
  const cell = (raw: string) => { const v = safe(raw); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return [t.head, ...t.rows].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
