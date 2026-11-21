// L1 · the gate every proposed edition passes before it can be approved: WCAG AA contrast for every text and background pair in both
// views, every setting inside its range and moved at most one step, nothing on the never-moves list touched, three to five moves,
// every cover layout drawable and every page's illustration style kept, and a screenshot comparison of the five named pages for the
// approver. Approval itself is a staff action (approveDecision); nothing here writes. Pure.
import { AA, contrast } from "../theme/contrast";
import { slugThemeOf } from "../theme/slug";
import { systemOf, type SystemView } from "../theme/system";
import { COMPOSITIONS } from "../compositions";
import { COVER_DRAWABLE, NEVER_MOVES, SETTINGS, SETTING_IDS, BASELINE, inRange, isSettingId, sameValue, stepsBetween, valueText, type LivingValues } from "./settings";
import { MOVES_PER_EDITION, applyMoves, changed, liveOf, statusOf, type Comparison, type Decision, type EditionRecord, type Move } from "./editions";
export type { Comparison };

/** The five pages the approver sees before and after, at a desktop and a phone width. */
export const COMPARE_PAGES = [
  { id: "front", name: "The front page", path: "/" },
  { id: "story", name: "A story page", path: "/stories/<newest published story>" },
  { id: "brand", name: "A brand page", path: "/brands/netlify.com" },
  { id: "study", name: "A study page", path: "/data/which-sector-changes-its-mind" },
  { id: "terminal", name: "The terminal", path: "/terminal" },
] as const;
export const COMPARE_WIDTHS = [1440, 390] as const;

/** Text and background pairs per view, as hex: text roles on page and surface, and ink on the accent and highlighter grounds. */
export function contrastPairs(values: LivingValues): { view: SystemView; fg: string; bg: string; what: string; min: number }[] {
  const theme = slugThemeOf(values), sys = systemOf(theme, values), out: { view: SystemView; fg: string; bg: string; what: string; min: number }[] = [];
  for (const [view, mode] of [["read", "light"], ["data", "dark"]] as const) {
    const c = (r: keyof typeof sys.color) => sys.color[r][view], m = theme.modes[mode];
    for (const t of ["ink", "ink-muted", "link"] as const) for (const g of ["page", "surface"] as const) out.push({ view, fg: c(t), bg: c(g), what: `${t} on ${g}`, min: AA.text });
    out.push({ view, fg: m.text.onAccent, bg: c("accent"), what: "text on accent", min: AA.text });
    out.push({ view, fg: m.highlight.fg, bg: c("highlight"), what: "text on highlight", min: AA.text });
  }
  return out;
}

export type Check = { id: "never" | "range" | "count" | "contrast" | "drawable" | "comparison"; name: string; ok: boolean; problems: string[] };
const fingerprint = (v: LivingValues) => { const t = slugThemeOf(v); return JSON.stringify({ fonts: t.shared.fonts, families: Object.values(t.modes).map(m => Object.fromEntries(Object.entries(m.type).map(([k, r]) => [k, r.family]))), wordmark: Object.values(t.modes).map(m => m.type.wordmark), name: t.name }); };
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** Run the gate on a proposed set of moves over the previous edition's values. */
export function gate(prev: LivingValues, moves: readonly Move[], comparison: unknown): { ok: boolean; values: LivingValues; checks: Check[] } {
  const next = applyMoves(prev, moves), checks: Check[] = [];
  const never = new Set<string>(NEVER_MOVES.map(n => n.id));
  const nv = moves.filter(m => never.has(m.setting) || !isSettingId(m.setting)).map(m => `${m.setting} is not a setting that may move (${NEVER_MOVES.find(n => n.id === m.setting)?.what ?? "not on the register"}).`);
  if (fingerprint(next) !== fingerprint(BASELINE)) nv.push("The type families, the wordmark or the name would change.");
  checks.push({ id: "never", name: "Nothing on the never-moves list is touched", ok: !nv.length, problems: nv });
  const rg: string[] = [], seen = new Set<string>();
  for (const m of moves) {
    if (!isSettingId(m.setting)) continue;
    if (seen.has(m.setting)) rg.push(`${SETTINGS[m.setting].name} is moved twice.`); seen.add(m.setting);
    if (!sameValue(m.setting, m.from, prev[m.setting])) rg.push(`${SETTINGS[m.setting].name}: the move starts from ${valueText(m.setting, m.from)}, but the edition before is ${valueText(m.setting, prev[m.setting])}.`);
    if (sameValue(m.setting, m.from, m.to)) rg.push(`${SETTINGS[m.setting].name}: the move changes nothing.`);
  }
  for (const id of SETTING_IDS) {
    if (!inRange(id, next[id])) rg.push(`${SETTINGS[id].name} would be ${valueText(id, next[id])}, outside its range.`);
    else if (stepsBetween(id, prev[id], next[id]) > 1) rg.push(`${SETTINGS[id].name} would move more than one step.`);
  }
  checks.push({ id: "range", name: "Every setting inside its range, moved at most one step", ok: !rg.length, problems: rg });
  const n = changed(prev, next).length;
  checks.push({ id: "count", name: `Between ${MOVES_PER_EDITION.min} and ${MOVES_PER_EDITION.max} moves`, ok: moves.length >= MOVES_PER_EDITION.min && moves.length <= MOVES_PER_EDITION.max && n === moves.length, problems: moves.length < MOVES_PER_EDITION.min || moves.length > MOVES_PER_EDITION.max ? [`This edition has ${moves.length} moves.`] : n !== moves.length ? ["Some moves change nothing or repeat a setting."] : [] });
  const ct = contrastPairs(next).filter(p => contrast(p.fg, p.bg) < p.min).map(p => `${p.view === "read" ? "Read" : "Data"}: ${p.what} is ${contrast(p.fg, p.bg).toFixed(2)}, below ${p.min}.`);
  checks.push({ id: "contrast", name: "Every text and background pair meets WCAG AA in both views", ok: !ct.length, problems: ct });
  const dr = [...next.covers.filter(c => !COVER_DRAWABLE.includes(c)).map(c => `The cover layout "${c}" cannot be drawn for a Digest or study cover yet.`),
    ...Object.entries(COMPOSITIONS).flatMap(([k, c]) => (c.illustration && !next.motifs.includes(c.illustration) ? [`The ${k} page's illustration style "${c.illustration}" would be removed.`] : []))];
  checks.push({ id: "drawable", name: "Every cover layout can be drawn and every page keeps its illustration style", ok: !dr.length, problems: dr });
  checks.push({ id: "comparison", name: "A screenshot comparison of the five named pages is ready for the approver", ok: comparisonProblems(comparison).length === 0, problems: comparisonProblems(comparison) });
  return { ok: checks.every(c => c.ok), values: next, checks };
}
/** What is missing from a comparison: each of the five pages at both widths, with a share of pixels that differ. */
export function comparisonProblems(c: unknown): string[] {
  const pages = c && typeof c === "object" && Array.isArray((c as Comparison).pages) ? (c as Comparison).pages : null;
  if (!pages) return ["No screenshot comparison has been made."];
  const out: string[] = [];
  for (const p of COMPARE_PAGES) for (const w of COMPARE_WIDTHS) {
    const hit = pages.find(x => x && x.page === p.id && x.width === w);
    if (!hit || typeof hit.share !== "number" || !Number.isFinite(hit.share) || !hit.before || !hit.after) out.push(`${p.name} at ${w} px is missing.`);
  }
  return out;
}
export const comparisonLine = (c: Comparison) => c.pages.map(p => `${p.page} ${p.width}: ${pct(p.share)}`).join(" · ");

/** Approving a proposed edition (staff, behind the editor key): it must be proposed, its values must be its moves over the live
 *  edition before it, and it must pass the gate. Never automatic. */
export function approveDecision(records: readonly EditionRecord[], n: number): Decision & { gate?: ReturnType<typeof gate> } {
  const r = records.find(x => x.number === n);
  if (!r) return { ok: false, reasons: [`There is no Edition ${n}.`] };
  if (statusOf(r) !== "proposed") return { ok: false, reasons: [`Edition ${n} is ${statusOf(r) ?? "without a status"}; only a proposed edition can be approved.`] };
  const prev = liveOf(records.filter(x => x.number < n));
  if (!prev) return { ok: false, reasons: ["There is no live edition before it."] };
  const g = gate(prev.values, r.moves, r.comparison);
  const sameValues = changed(applyMoves(prev.values, r.moves), r.values).length === 0;
  const reasons = [...g.checks.flatMap(c => c.problems), ...(sameValues ? [] : ["The stored values are not the moves applied to the edition before."])];
  return reasons.length ? { ok: false, reasons, gate: g } : { ok: true, status: "approved", gate: g };
}
