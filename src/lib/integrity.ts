// MEASUREMENT INTEGRITY (E2e) — a change must be seen twice on each side. Judged per brand, page, viewport and field over the stored live
// captures, a change may become a tape line or feed a story only when all three hold:
//   1. Two before: the earlier value was seen in at least two consecutive captures, at least six hours apart.
//   2. Two after: the new value was seen in at least two consecutive captures, at least six hours apart.
//   3. One transition: the field changed value once in the 14 days before its newest capture (two or more is alternation:
//      a rotation, an experiment or a loading race).
// Headline text, font, size and alignment are comparable only between captures whose headline source is `h1`; otherwise those fields
// are not compared at all (no change, no tape line, no story). A change that fails shows only in the Data view, marked "Seen once" or
// "Alternating", and moves to the tape when later captures confirm it. Pure: same captures in, same verdicts out.
import { equalField, extractFields, normalizeFont, type Comparable, type DiffContext } from "./library-diff";

export const BEFORE_MIN = 2, AFTER_MIN = 2, MIN_SPAN_HOURS = 6, TRANSITION_DAYS = 14;
/** Fields read from the page's headline element: compared only when both captures read an h1. */
export const HEADLINE_FIELDS: ReadonlySet<string> = new Set(["headline", "h1", "h1_align", "h1_size_px"]);
export type Condition = "two_before" | "two_after" | "one_transition";
export const CONDITION_TEXT: Record<Condition, string> = {
  two_before: "the earlier value was not seen in two captures six hours apart",
  two_after: "the new value was not seen in two captures six hours apart",
  one_transition: "the value changed more than once in 14 days",
};
export type Verdict = "pass" | "seen_once" | "alternating" | "headline_element";
export const VERDICT_LABEL: Record<"seen_once" | "alternating", string> = { seen_once: "Seen once", alternating: "Alternating" };
export const INTEGRITY_RULE = `A change counts only when the earlier value was seen in two captures at least ${MIN_SPAN_HOURS} hours apart, the new value was seen in two captures at least ${MIN_SPAN_HOURS} hours apart, and the value changed once in ${TRANSITION_DAYS} days; more than once is alternation (a rotating slide, an experiment or a loading race). The headline's text, font, size and alignment are compared only when both captures read the page's h1. A change that fails stays out of the tape and the stories, listed in the Data view as "Seen once" or "Alternating" until later captures confirm it.`;

/** One stored capture of one page and viewport: its comparable fields (library-diff) and its headline source. */
export type Capture = { id: number; at: string; fields: Comparable; source: string | null };
/** E2g · `lastBefore` is the last capture that showed the old value and `firstAfter` the first that showed the new one (ISO): the change
 *  happened between them. Older stored verdicts have neither; their changes are dated by when they were confirmed until re-checked. */
export type FieldCheck = { verdict: Verdict; failed: Condition[]; before: number; after: number; beforeHours: number; afterHours: number; transitions: number; lastBefore?: string; firstAfter?: string };
export type Check = { verdict: Verdict; fields: Record<string, FieldCheck>; pass: string[] };
/** When a change happened, from its captures: the last capture with the old value and the first with the new one (E2g). */
export type Seen = { before: string; after: string };
type Ev = { id: number; type: string; before?: unknown; after?: unknown; detected_at: string; snapshot_id?: number | null; prev_snapshot_id?: number | null };

const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const H = 36e5, DAY = 864e5;
const family = (v: unknown) => (typeof v === "string" ? v : typeof o(v)["family"] === "string" ? (o(v)["family"] as string) : "");
/** The same value for this field (fonts by family, colours by distance, words by overlap: library-diff's own equality). */
export function sameValue(field: string, a: unknown, b: unknown): boolean {
  if (field === "h1" || field === "body") { const x = normalizeFont(family(a)), y = normalizeFont(family(b)); return !!x && x === y; }
  return equalField(field, a, b);
}
/** A capture's comparable fields from its stored signals (AI tags merged in, as ingestion reads them). */
export function captureOf(row: { id: number; captured_at: string; signals: Comparable; tags?: Comparable | null }, ctx: Pick<DiffContext, "page_type" | "viewport" | "sector">): Capture {
  const signals = row.tags ? { ...row.signals, ai_tags: row.tags } : row.signals;
  const src = o(o(signals)["layout"])["headline_source"];
  return { id: row.id, at: row.captured_at, fields: extractFields(signals, { ...ctx }), source: typeof src === "string" ? src : null };
}
/** A value this capture can stand behind: headline fields only from an h1, fonts never from a substituted fallback. */
function valueAt(field: string, c: Capture): unknown {
  if (HEADLINE_FIELDS.has(field) && c.source !== "h1") return null;
  const v = c.fields[field];
  if ((field === "h1" || field === "body") && o(v)["substituted"] === true) return null;
  return v ?? null;
}
const span = (xs: Capture[]) => (xs.length < 2 ? 0 : (Date.parse(xs.at(-1)!.at) - Date.parse(xs[0]!.at)) / H);
const round = (h: number) => Math.round(h * 10) / 10;

/** One field of one change against the captures of its page and viewport (any order; only live captures belong here). */
export function checkField(field: string, before: unknown, after: unknown, captures: Capture[], ev: Pick<Ev, "detected_at" | "snapshot_id" | "prev_snapshot_id">): FieldCheck {
  const all = [...captures].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  const none: FieldCheck = { verdict: "headline_element", failed: [], before: 0, after: 0, beforeHours: 0, afterHours: 0, transitions: 0 };
  if (HEADLINE_FIELDS.has(field)) {
    // Comparable only when both sides read the page's h1 (the change's own captures, when we have them).
    const prev = all.find(c => c.id === ev.prev_snapshot_id), cur = all.find(c => c.id === ev.snapshot_id);
    if ((prev && prev.source !== "h1") || (cur && cur.source !== "h1")) return none;
  }
  const seq = all.flatMap(c => { const v = valueAt(field, c); if (v == null) return []; const isA = sameValue(field, v, after), isB = sameValue(field, v, before); return [{ c, s: isA && !isB ? "A" : isB && !isA ? "B" : "X" }]; });
  if (HEADLINE_FIELDS.has(field) && (!seq.some(x => x.s === "A") || !seq.some(x => x.s === "B")) && all.some(c => c.source !== "h1")) return none;
  // The change's own capture (else the newest showing the new value at or before it was detected) anchors the transition.
  let k = seq.findIndex(x => x.c.id === ev.snapshot_id && x.s === "A");
  if (k < 0) for (let i = seq.length - 1; i >= 0; i--) if (seq[i]!.s === "A" && seq[i]!.c.at <= ev.detected_at) { k = i; break; }
  if (k < 0) k = seq.findIndex(x => x.s === "A");
  if (k < 0) return { verdict: "seen_once", failed: ["two_after"], before: 0, after: 0, beforeHours: 0, afterHours: 0, transitions: 0 };
  let j = k; while (j > 0 && seq[j - 1]!.s === "A") j--;
  let end = k; while (end + 1 < seq.length && seq[end + 1]!.s === "A") end++;
  let b = j; while (b > 0 && seq[b - 1]!.s === "B") b--;
  const afterRun = seq.slice(j, end + 1).map(x => x.c), beforeRun = seq.slice(b, j).map(x => x.c);
  // Transitions are counted over the 14 days before the newest capture of the field, so a value that flips back later is alternation too.
  const T = Date.parse(seq.at(-1)!.c.at), from = T - TRANSITION_DAYS * DAY;
  let transitions = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i]!.s !== seq[i - 1]!.s && Date.parse(seq[i]!.c.at) > from) transitions++;
  const failed: Condition[] = [];
  if (beforeRun.length < BEFORE_MIN || span(beforeRun) < MIN_SPAN_HOURS) failed.push("two_before");
  if (afterRun.length < AFTER_MIN || span(afterRun) < MIN_SPAN_HOURS) failed.push("two_after");
  if (transitions > 1) failed.push("one_transition");
  return { verdict: failed.includes("one_transition") ? "alternating" : failed.length ? "seen_once" : "pass", failed, before: beforeRun.length, after: afterRun.length, beforeHours: round(span(beforeRun)), afterHours: round(span(afterRun)), transitions,
    ...(beforeRun.length ? { lastBefore: beforeRun.at(-1)!.at } : {}), ...(afterRun.length ? { firstAfter: afterRun[0]!.at } : {}) };
}

/** Fields the captures never carry (a new page) are not judged here. */
const JUDGED = (field: string, captures: Capture[]) => HEADLINE_FIELDS.has(field) || captures.some(c => c.fields[field] != null);
/** Every field of one change. The change passes with the fields that pass; it is "alternating" or "seen once" when none does. */
export function checkEvent(e: Ev, captures: Capture[]): Check {
  const b = o(e.before), a = o(e.after), fields: Record<string, FieldCheck> = {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => JUDGED(k, captures));
  for (const k of keys) fields[k] = checkField(k, b[k], a[k], captures, e);
  const unjudged = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => !keys.includes(k));
  const pass = [...keys.filter(k => fields[k]!.verdict === "pass"), ...unjudged];
  const vs = Object.values(fields).map(f => f.verdict);
  const verdict: Verdict = pass.length ? "pass" : vs.includes("alternating") ? "alternating" : vs.includes("seen_once") ? "seen_once" : "headline_element";
  return { verdict, fields, pass };
}

/** When the passing part of a change happened: the earliest last-old capture and the latest first-new capture over its passing fields
 *  (one field: exactly its two captures). Null when the verdict carries no capture dates (stored before E2g). */
export function seenOf(c: Check | undefined): Seen | null {
  if (!c) return null;
  const fs = c.pass.map(k => c.fields[k]).filter((f): f is FieldCheck => !!f && !!f.lastBefore && !!f.firstAfter);
  if (!fs.length) return null;
  return { before: fs.map(f => f.lastBefore!).sort()[0]!, after: fs.map(f => f.firstAfter!).sort().at(-1)! };
}
/** The part of a change that passed (failing fields removed), carrying when it happened (`seen`); null when nothing passed. */
export function confirmedPart<E extends { id: number; type: string; before?: unknown; after?: unknown }>(e: E, c: Check | undefined): (E & { seen?: Seen }) | null {
  if (!c || c.verdict !== "pass") return null;
  const keep = new Set(c.pass), strip = (v: unknown) => Object.fromEntries(Object.entries(o(v)).filter(([k]) => keep.has(k)));
  const seen = seenOf(c), dated = (x: E): E & { seen?: Seen } => (seen ? { ...x, seen } : x);
  if (Object.keys(c.fields).every(k => keep.has(k))) return dated(e);
  return dated({ ...e, before: strip(e.before), after: strip(e.after) });
}
/** The failing part of a change for the Data view list (headline-element fields are not a change at all, so never listed). */
export function unconfirmedPart<E extends { id: number; type: string; before?: unknown; after?: unknown }>(e: E, c: Check | undefined): (E & { label: string; failed: Condition[] }) | null {
  if (!c) return null;
  const bad = Object.entries(c.fields).filter(([, f]) => f.verdict === "seen_once" || f.verdict === "alternating");
  if (!bad.length) return null;
  const keep = new Set(bad.map(([k]) => k)), strip = (v: unknown) => Object.fromEntries(Object.entries(o(v)).filter(([k]) => keep.has(k)));
  const alt = bad.some(([, f]) => f.verdict === "alternating");
  return { ...e, before: strip(e.before), after: strip(e.after), label: alt ? VERDICT_LABEL.alternating : VERDICT_LABEL.seen_once, failed: [...new Set(bad.flatMap(([, f]) => f.failed))] };
}
/** Split changes into the tape (what passed) and the Data view's unconfirmed list. A live change with no check yet is neither. */
export function splitChecked<E extends { id: number; type: string; before?: unknown; after?: unknown; source?: string | null }>(events: E[], checks: ReadonlyMap<number, Check>): { tape: E[]; unconfirmed: (E & { label: string; failed: Condition[] })[] } {
  const tape: E[] = [], unconfirmed: (E & { label: string; failed: Condition[] })[] = [];
  for (const e of events) {
    if (e.source && e.source !== "live") { tape.push(e); continue; }
    const c = checks.get(e.id), p = confirmedPart(e, c), u = unconfirmedPart(e, c);
    if (p) tape.push(p); if (u) unconfirmed.push(u);
  }
  return { tape, unconfirmed };
}
/** Which of the three conditions failed, in words, for a retirement note. */
export const failedText = (failed: Condition[]) => [...new Set(failed)].map(f => CONDITION_TEXT[f]).join("; ");
