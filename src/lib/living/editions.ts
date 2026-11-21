// L1 · editions: the design changes ship together once a month as a numbered edition of three to five small moves. This file holds
// the editions whose values the code carries (the site draws the newest of them) and the pure rules over a list of edition records:
// which edition is live, what an approval or a roll-back does. The database keeps the record (living_editions, living_moves and the
// insert-only living_edition_status); going live means shipping that edition's values here, so a page never reads the database for
// its look. Pure.
import { BASELINE, SETTING_IDS, SETTINGS, inRange, isSettingId, sameValue, stepsBetween, type LivingValues, type SettingId, type Value } from "./settings";

export const EDITION_STATUSES = ["baseline", "proposed", "approved", "live", "rolled back"] as const;
export type EditionStatus = (typeof EDITION_STATUSES)[number];
/** One move: a setting, its old and new value, and the measured signal and rule that fired (null for a setting set by hand). */
export type Move = { setting: string; from: Value; to: Value; signal: string | null; share: number | null; count: number | null; base: number | null; rule: string | null };
export type Edition = { number: number; dated: string; status: EditionStatus; values: LivingValues; moves: readonly Move[] };

/** Edition 0, the baseline: today's value of every setting, no moves. */
export const EDITION_0: Edition = { number: 0, dated: "2026-11-21", status: "baseline", values: BASELINE, moves: [] };
/** Editions the code carries, oldest first. The site draws the last one. A new edition is appended here once the owner approves it. */
export const SHIPPED: readonly Edition[] = [EDITION_0];
export const LIVE_EDITION: Edition = SHIPPED[SHIPPED.length - 1]!;
/** The values every token reads. */
export const LIVE_VALUES: LivingValues = LIVE_EDITION.values;

/** The first three real editions need the owner's yes (every approval is a staff action anyway). */
export const OWNER_YES_EDITIONS = 3;
export const MOVES_PER_EDITION = { min: 3, max: 5 } as const;

/** A values object with the moves applied (moves naming anything but a setting are ignored here; the gate refuses them). */
export function applyMoves(values: LivingValues, moves: readonly Move[]): LivingValues {
  const out: Record<string, unknown> = { ...values };
  for (const m of moves) if (isSettingId(m.setting)) out[m.setting] = m.to;
  return out as LivingValues;
}
/** The settings whose value differs between two value sets. */
export const changed = (a: LivingValues, b: LivingValues): SettingId[] => SETTING_IDS.filter(id => !sameValue(id, a[id], b[id]));

/** Problems with a sequence of editions' values: a value outside its range, or a move of more than one step between neighbours. */
export function sequenceProblems(editions: readonly Pick<Edition, "number" | "values">[]): string[] {
  const out: string[] = [];
  editions.forEach((e, i) => {
    for (const id of SETTING_IDS) {
      if (!inRange(id, e.values[id])) out.push(`Edition ${e.number}: ${SETTINGS[id].name} is outside its range`);
      const prev = editions[i - 1];
      if (prev && stepsBetween(id, prev.values[id], e.values[id]) > 1) out.push(`Edition ${e.number}: ${SETTINGS[id].name} moved more than one step`);
    }
  });
  return out;
}

// RECORDS (as stored) ----------------------------------------------------------------------------------------------------------
/** An edition as the database holds it: its values, its moves and every status it has had, oldest first. */
/** The comparison an approver reads: for each named page and width, the share of pixels that differ and where the pictures are. */
export type Comparison = { made_at: string; pages: { page: string; width: number; share: number; before: string; after: string }[] };
export type EditionRecord = { number: number; dated: string; values: LivingValues; moves: readonly Move[]; statuses: readonly { status: EditionStatus; at: string }[]; comparison: Comparison | null };
export const statusOf = (r: Pick<EditionRecord, "statuses">): EditionStatus | null => r.statuses[r.statuses.length - 1]?.status ?? null;
/** The edition the site should be drawing: the newest one whose status is live (or the baseline when none is). */
export function liveOf(records: readonly EditionRecord[]): EditionRecord | null {
  const ok = [...records].filter(r => { const s = statusOf(r); return s === "live" || s === "baseline"; }).sort((a, b) => b.number - a.number);
  return ok[0] ?? null;
}
/** Records newest first, as the colophon lists them. */
export const newestFirst = (records: readonly EditionRecord[]) => [...records].sort((a, b) => b.number - a.number);

export type Decision = { ok: true; status: EditionStatus; restores?: LivingValues } | { ok: false; reasons: string[] };
/** Rolling back an approved or live edition: it is marked rolled back and the values become the previous live edition's, exactly. */
export function rollbackDecision(records: readonly EditionRecord[], n: number): Decision {
  const r = records.find(x => x.number === n);
  if (!r) return { ok: false, reasons: [`There is no Edition ${n}.`] };
  const s = statusOf(r);
  if (s !== "live" && s !== "approved") return { ok: false, reasons: [`Edition ${n} is ${s ?? "without a status"}; only an approved or live edition can be rolled back.`] };
  const prev = liveOf(records.filter(x => x.number < n));
  if (!prev) return { ok: false, reasons: ["There is no earlier edition to go back to."] };
  return { ok: true, status: "rolled back", restores: prev.values };
}
