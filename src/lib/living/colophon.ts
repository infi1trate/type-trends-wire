// L1 · the colophon's words and tables, built from the register, the rules, the dry run and the edition records. Pure, so the Read
// and Data views say the same numbers.
import { NEVER_MOVES, SETTINGS, SETTING_IDS, itemName, valueText, type LivingValues, type SettingId, type Value } from "./settings";
const trimN = (x: number) => String(Number(x.toFixed(4)));
import { RULES, SIGNALS, MIN_BASE, LEADING_TOP, type DryRow, type LeadingRow } from "./rules";
import { statusOf, type EditionRecord } from "./editions";
import { longDay } from "../pictures";

export const COLOPHON_TITLE = "Colophon";
export const COLOPHON_DECK = "slug's own design changes once a month, in three to five small steps, each inside fixed limits. Where we can measure it, the leading brands we track set the direction; the rest is set by hand. Every change is listed here with its reason.";
export const NEVER_LINES = NEVER_MOVES.map(n => n.what);
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The range in plain words: "between 0 px and 4 px, 2 px at a time". */
export function rangeText(id: SettingId): string {
  const s = SETTINGS[id], v = (x: number) => valueText(id, x);
  if (s.kind === "number") return s.unit === "× today" ? `between ${trimN(s.floor)} and ${trimN(s.ceiling)} × today's weights, ${trimN(s.step)} at a time` : `between ${v(s.floor)} and ${v(s.ceiling)}, ${v(s.step)} at a time`;
  if (s.kind === "choice") return s.allowed.length === 1 ? `stays ${valueText(id, s.allowed[0] as Value)} (no other colour is proposed)` : `one of ${s.allowed.join(", ")}`;
  const same = s.floor.length === s.ceiling.length;
  return same ? `stays ${s.ceiling.map(itemName).join(", ")} (none can be added or removed)` : `always includes ${s.floor.map(itemName).join(", ")}; may also hold ${s.ceiling.filter(x => !s.floor.includes(x)).map(itemName).join(", ")}, one change at a time`;
}
/** Who moves it: the signal with today's count, or "Set by hand". */
export function driverText(id: SettingId, dry: readonly DryRow[] | null): string {
  const r = dry?.find(x => x.setting === id);
  if (!RULES.some(x => x.setting === id)) return "Set by hand at each edition.";
  return r?.signalText ? `Follows the leading brands: ${r.signalText}.` : "Follows the leading brands (not read today).";
}
/** The dry-run line for one setting, in plain words. */
export function dryLine(r: DryRow): string {
  if (r.driver === "hand" && !r.rule) return `${r.name}: set by hand, ${r.currentText} now.`;
  if (r.proposed === null) return `${r.name}: no move. ${r.signalText ?? ""}${r.signalText ? "." : ""} ${r.reason}`.replace(/\s+/g, " ").trim();
  return `${r.name}: ${r.currentText} to ${r.proposedText}. ${r.signalText}.`;
}
/** One edition in plain words. */
export function editionLine(e: EditionRecord): { title: string; when: string; status: string; what: string } {
  const s = statusOf(e) ?? "proposed";
  const status = s === "baseline" ? "The baseline" : s.charAt(0).toUpperCase() + s.slice(1);
  const what = e.moves.length ? e.moves.map(m => `${SETTINGS[m.setting as SettingId]?.name ?? m.setting} ${valueText(m.setting as SettingId, m.from)} to ${valueText(m.setting as SettingId, m.to)}`).join("; ") + "." : "Today's values of every setting, unchanged. No moves.";
  return { title: `Edition ${e.number}`, when: longDay(`${e.dated}T12:00:00Z`), status, what };
}
export const valuesText = (v: LivingValues) => SETTING_IDS.map(id => `${SETTINGS[id].name} ${valueText(id, v[id])}`).join("; ");

// DATA VIEW TABLES ------------------------------------------------------------------------------------------------------------
export function registerTable(values: LivingValues): { head: string[]; rows: string[][] } {
  return { head: ["Setting", "Value", "Floor", "Ceiling", "Largest step", "Unit", "Driver", "Range", "Controls"], rows: SETTING_IDS.map(id => {
    const s = SETTINGS[id];
    const [floor, ceiling, step] = s.kind === "number" ? [String(s.floor), String(s.ceiling), String(s.step)] : s.kind === "choice" ? [s.allowed.join(", "), s.allowed.join(", "), "1 colour"] : [s.floor.join(", "), s.ceiling.join(", "), `${s.step} item`];
    return [s.name, valueText(id, values[id]), floor, ceiling, step, s.unit, s.driver === "signal" ? "Measured signal" : "By hand", s.range === "proposed" ? "Proposed" : "Confirmed", s.tokens.join(" ")];
  }) };
}
export function rulesTable(): { head: string[]; rows: string[][] } {
  return { head: ["Setting", "Signal", "Group", "Counted among", "One step at", "One step back at", "Direction", "Minimum measured"], rows: RULES.map(r => [SETTINGS[r.setting].name, SIGNALS[r.signal].name, `Top ${LEADING_TOP} trendsetters`, SIGNALS[r.signal].base, `${pct(r.at)} or more`, `${pct(r.back)} or fewer`, r.up > 0 ? "Share up: value up" : "Share up: value down", String(MIN_BASE)]) };
}
export function dryTable(rows: readonly DryRow[]): { head: string[]; rows: string[][] } {
  return { head: ["Setting", "Current", "Signal", "Count", "Measured", "Share", "Rule", "Proposed", "Why"], rows: rows.map(r => [r.name, r.currentText, r.signal?.name ?? "–", r.signal ? String(r.signal.count) : "–", r.signal ? String(r.signal.base) : "–",
    r.signal?.share != null ? pct(r.signal.share) : "–", r.rule ?? "Set by hand", r.proposedText, r.reason]) };
}
const shapeText = (b: string | null) => (b == null ? "not measured" : b === "pill" ? "pill" : b === "0" ? "square (0 px)" : `${b} px`);
export function receiptsTable(rows: readonly LeadingRow[]): { head: string[]; rows: string[][] } {
  return { head: ["Rank", "Brand", "Captured", "Main button corners", "Headline spacing", "Whitespace"], rows: rows.map(r => [String(r.rank), r.domain, r.captured_at ? longDay(r.captured_at) : "–", shapeText(r.cta_radius_bucket),
    typeof r.h1_tracking === "number" ? `${Math.round(r.h1_tracking * 1000) / 1000} em${r.h1_tracking <= -0.02 ? " (tight)" : ""}` : "not measured",
    typeof r.whitespace_ratio === "number" ? `${Math.round(r.whitespace_ratio * 100)}%${r.whitespace_ratio >= 0.6 ? " (generous)" : ""}` : "not measured"]) };
}
export function editionsTable(eds: readonly EditionRecord[]): { head: string[]; rows: string[][] } {
  return { head: ["Edition", "Date", "Status", "Moves", "Values"], rows: eds.map(e => [String(e.number), e.dated, statusOf(e) ?? "–", e.moves.length ? e.moves.map(m => `${m.setting}: ${JSON.stringify(m.from)} → ${JSON.stringify(m.to)}${m.signal ? ` (${m.signal}, ${m.count} of ${m.base})` : ""}${m.rule ? ` · ${m.rule}` : ""}`).join("; ") : "none", valuesText(e.values)]) };
}
