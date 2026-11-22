// L3 · the monthly design reading and the assembly of a proposed edition. Pure: the reading is the L1 dry run as stored data (one per
// month, insert-only), and an edition is assembled from its rule moves and the design review desk's open setting moves. Nothing here
// makes an edition live: approval and going live stay as L1 built them (owner only, values shipped in code through the build queue).
import { MOVES_PER_EDITION, type Move } from "./editions";
import { SIGNALS, MIN_BASE, ruleOf, type DryRow, type SignalId } from "./rules";
import { SETTINGS, inRange, isSettingId, sameValue, stepsBetween, valueText, type LivingValues, type SettingId, type Value } from "./settings";

export const OUTCOMES = ["no move", "one step up", "one step down", "at its ceiling", "at its floor", "too few measured"] as const;
export type Outcome = (typeof OUTCOMES)[number];
/** A desk proposal counts only within this many weeks of the reading. */
export const DESK_WEEKS = 5;
export type ReadingSignal = { signal: SignalId; setting: SettingId; count: number; base: number; share: number | null; rule: string; outcome: Outcome; from: Value; to: Value | null };
export type Reading = { month: string; read_at: string; run_id: string | null; edition: number; signals: ReadingSignal[]; ready: number; proposed_edition: number | null; note: string };

/** "2026-11" for a UTC instant. */
export const monthOf = (iso: string) => iso.slice(0, 7);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "November 2026". */
export const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;

/** The outcome of one signal-driven dry-run row, in the reading's words. */
export function outcomeOf(r: DryRow): Outcome {
  if (!r.signal || r.signal.share === null) return "too few measured";
  if (r.proposed !== null) return r.reason.startsWith("One step up") ? "one step up" : "one step down";
  if (/ceiling/.test(r.reason)) return "at its ceiling";
  if (/floor/.test(r.reason)) return "at its floor";
  return "no move";
}
/** The reading's signals from a dry run (signal-driven settings only, in register order). */
export function readingSignals(dry: readonly DryRow[]): ReadingSignal[] {
  return dry.flatMap(r => { const rule = ruleOf(r.setting); if (r.driver !== "signal" || !rule || !r.signal) return [];
    return [{ signal: rule.signal, setting: r.setting, count: r.signal.count, base: r.signal.base, share: r.signal.share === null ? null : Math.round(r.signal.share * 1e4) / 1e4, rule: rule.text, outcome: outcomeOf(r), from: r.current, to: r.proposed }]; });
}

// ASSEMBLY ---------------------------------------------------------------------------------------------------------------------------
/** A setting move the design review desk proposed (build queue kind "design move"), with its latest queue status. */
export type DeskMove = { item: number; log: number | null; at: string; setting: string; from: Value; to: Value; status: string; test: boolean; title: string };
export const OPEN_QUEUE = ["queued", "briefed"] as const;
export type Left = { setting: string; why: string; item?: number };
export type Assembly = { moves: Move[]; ready: number; edition: boolean; left: Left[] };
const deskRule = (m: DeskMove) => `Design review proposal (queue item ${m.item}${m.log ? `, desk log ${m.log}` : ""}): ${m.title}`.slice(0, 300);

/**
 * Rule moves first (each one step, as the dry run gave it), then the desk's setting moves newest first. A desk move is kept only when it
 * names a register setting, is in range, sits exactly one step from the live value, was proposed within DESK_WEEKS weeks, is still open
 * (queued or briefed), and is not a test. At most one move per setting and MOVES_PER_EDITION.max in all; fewer than the minimum: no edition.
 */
export function assemble(o: { live: LivingValues; signals: readonly ReadingSignal[]; desk: readonly DeskMove[]; now: string }): Assembly {
  const moves: Move[] = [], left: Left[] = [], used = new Set<string>();
  for (const s of o.signals) {
    if (s.to === null || !(s.outcome === "one step up" || s.outcome === "one step down")) continue;
    moves.push({ setting: s.setting, from: s.from, to: s.to, signal: s.signal, share: s.share, count: s.count, base: s.base, rule: s.rule });
    used.add(s.setting);
  }
  const since = Date.parse(o.now) - DESK_WEEKS * 7 * 864e5;
  for (const m of [...o.desk].sort((a, b) => b.at.localeCompare(a.at) || b.item - a.item)) {
    const no = (why: string) => left.push({ setting: m.setting, why, item: m.item });
    if (m.test) { no("a test item, not a real proposal"); continue; }
    if (!(OPEN_QUEUE as readonly string[]).includes(m.status)) { no(`no longer open (${m.status})`); continue; }
    if (Date.parse(m.at) < since) { no(`older than ${DESK_WEEKS} weeks`); continue; }
    if (!isSettingId(m.setting)) { no("not a register setting"); continue; }
    const id = m.setting;
    if (!inRange(id, m.to)) { no(`${valueText(id, m.to)} is outside its range`); continue; }
    if (sameValue(id, o.live[id], m.to)) { no("already the live value"); continue; }
    if (stepsBetween(id, o.live[id], m.to) !== 1) { no(`${stepsBetween(id, o.live[id], m.to)} steps from the live value`); continue; }
    if (used.has(id)) { no("another move on the same setting comes first"); continue; }
    moves.push({ setting: id, from: o.live[id], to: m.to, signal: null, share: null, count: null, base: null, rule: deskRule(m) });
    used.add(id);
  }
  const kept = moves.slice(0, MOVES_PER_EDITION.max);
  for (const m of moves.slice(MOVES_PER_EDITION.max)) left.push({ setting: m.setting, why: `over the ${MOVES_PER_EDITION.max} moves an edition takes` });
  return { moves: kept, ready: moves.length, edition: kept.length >= MOVES_PER_EDITION.min, left };
}
export const noEditionNote = (ready: number) => `No edition this month: ${ready} ${ready === 1 ? "move" : "moves"} ready, an edition needs three.`;

/** The proposal filed for the owner: "Edition N", one line per move with its signal, count, base and rule, or the desk proposal. */
export function editionProposal(n: number, moves: readonly Move[]): string {
  const lines = moves.map(m => { const id = m.setting as SettingId, name = SETTINGS[id]?.name ?? m.setting;
    return m.signal ? `${name}: ${valueText(id, m.from)} to ${valueText(id, m.to)}. ${SIGNALS[m.signal as SignalId]?.name ?? m.signal} on ${m.count} of ${m.base} leading brands measured. Rule: ${m.rule}` : `${name}: ${valueText(id, m.from)} to ${valueText(id, m.to)}. From ${m.rule}`; });
  return `Edition ${n}. ${lines.join(" ")}`.slice(0, 1000);
}

// THE COLOPHON LINE -----------------------------------------------------------------------------------------------------------------
/** Short names for the reading's line. */
const SHORT: Record<SignalId, string> = { pill_buttons: "Pill buttons", tight_headlines: "Tight headline spacing", generous_whitespace: "Generous whitespace" };
const pct = (s: ReadingSignal) => (s.base ? ` (${Math.round((s.count / s.base) * 100)}%)` : "");
/**
 * "November 2026: no move. Pill buttons on 10 of 19 leading brands measured (53%); the line is 60%. Tight headline spacing on 8 of 23
 * (35%). Generous whitespace on 11 of 30 (37%)." Every number comes from the stored reading.
 */
export function readingLine(r: Pick<Reading, "month" | "signals">): string {
  const moved = r.signals.filter(s => s.outcome === "one step up" || s.outcome === "one step down");
  const head = moved.length ? moved.map(s => `${SETTINGS[s.setting].name.toLowerCase()} ${s.outcome}`).join(", ") : "no move";
  const parts = r.signals.map((s, k) => {
    const rule = ruleOf(s.setting), at = rule ? Math.round(rule.at * 100) : null;
    if (s.outcome === "too few measured") return `${SHORT[s.signal]}: too few measured (${s.base} of the ${MIN_BASE} needed)`;
    const tail = s.outcome === "at its ceiling" || s.outcome === "at its floor" ? `; ${SETTINGS[s.setting].name.toLowerCase()} is ${s.outcome}` : "";
    return k === 0 ? `${SHORT[s.signal]} on ${s.count} of ${s.base} leading brands measured${pct(s)}; the line is ${at}%${tail}` : `${SHORT[s.signal]} on ${s.count} of ${s.base}${pct(s)}${tail}`;
  });
  return `${monthName(r.month)}: ${head}.${parts.length ? ` ${parts.join(". ")}.` : ""}`;
}
