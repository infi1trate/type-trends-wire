// T1 · THE SPEND LEDGER (pure). One table for what the product costs, per Eastern-time week (Monday 00:00 to Sunday 24:00,
// America/New_York, the week the cap uses), newest first: the site's own model calls by kind and model, build credits (in dollars at a
// stated price per credit), agent sessions recorded by hand, the week's total, the total against the owner's cap, and three unit costs
// that each show their count and base. The loader (ledger.server.ts) only reads rows; nothing here sets or changes a cap.
import { etWeekStart } from "./spend";

/** What one Lovable credit costs in US dollars, as the owner stated it, and the date that price was read. */
export const CREDIT_USD = 0.3;
export const CREDIT_PRICE_READ = "2026-11-22";
export const LEDGER_WEEKS = 8;
/** Model call kinds that write or review stories (the writers' shared purpose); the desks' calls are recorded beside them by usage id. */
export const STORY_CALL_KINDS: ReadonlySet<string> = new Set(["story_why"]);
/** The kind whose calls read captures (the vision model). */
export const CAPTURE_READ_KIND = "vision";
/** The desks whose calls count towards a published story's cost, beside the writer's own calls. */
export const STORY_DESKS: ReadonlySet<string> = new Set(["standards", "editor in chief"]);

export type Week = { start: string; end: string; label: string };
/** The `n` Eastern-time weeks ending with the one holding `now`, newest first (DST-safe: each start is a Monday 00:00 in New York). */
export function etWeeks(now: number, n = LEDGER_WEEKS): Week[] {
  const out: Week[] = [];
  let start = etWeekStart(now), end = etWeekStart(Date.parse(start) + 8 * 864e5);
  for (let i = 0; i < n; i++) {
    out.push({ start, end, label: weekLabel(start) });
    end = start; start = etWeekStart(Date.parse(start) - 36e5);
  }
  return out;
}
/** "16 Nov" for the Monday a week starts on (its New York date). */
export function weekLabel(startIso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", day: "numeric", month: "short" }).format(new Date(startIso));
}

/** One model call row (ai_usage). `state` "rejected" is a reservation the budget refused: no call was made, so it is not counted. */
export type CallRow = { at: string; kind: string; model: string; ok: boolean; state: string; input_tokens: number | null; output_tokens: number | null; usd: number; snapshot_id: number | null };
export type BuildRow = { at: string; credits: number; queue_item: number | null; what: string };
export type AgentRow = { at: string; usd: number; what: string; actor: string };
/** A story text the writer stored (its own call's cost) and a desk call that read stories (its cost is split evenly between them). */
export type StoryTextRow = { story_id: string; usd: number };
export type DeskCallRow = { at: string; desk: string; purpose: string; usd: number; story_ids: string[] };
/** When a story was first published (its first "published" state). */
export type PublishedRow = { story_id: string; at: string };
/** A queue item's moves and gate results, to count shipped changes. */
export type ShipRow = { id: number; test: boolean; moves: { status: string; at: string }[]; gates: { at: string; pass: boolean }[] };
export type Cap = { model_usd: number | null; build_credits: number | null; set_at: string } | null;

export type KindLine = { kind: string; model: string; calls: number; failed: number; tokens_in: number; tokens_out: number; usd: number };
export type UnitCost = { value: number | null; count: number; base: number; line: string };
export type LedgerWeek = Week & {
  current: boolean;
  model: { calls: number; failed: number; tokens_in: number; tokens_out: number; usd: number; by_kind: KindLine[] };
  build: { credits: number; usd: number; entries: number };
  agent: { recorded: boolean; usd: number; entries: number; line: string };
  total_usd: number;
  cap: { set: boolean; line: string };
  per_story: UnitCost; per_capture: UnitCost; per_change: UnitCost;
};

const r2 = (x: number) => Math.round(x * 100) / 100, r4 = (x: number) => Math.round(x * 1e4) / 1e4;
export const usd = (x: number) => `$${x < 0.1 && x > 0 ? x.toFixed(3) : x.toFixed(2)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A unit cost with its count and base; a zero base says so in words and never divides. */
export function unitCost(count: number, base: number, o: { unit: "usd" | "credits"; noBase: string; of: string }): UnitCost {
  const c = o.unit === "usd" ? r4(count) : r2(count);
  if (base <= 0) return { value: null, count: c, base: 0, line: o.noBase };
  const v = count / base, shown = o.unit === "usd" ? usd(v) : `${r2(v)} credits`;
  return { value: o.unit === "usd" ? r4(v) : r2(v), count: c, base, line: `${shown} (${o.unit === "usd" ? usd(count) : `${r2(count)} credits`} over ${o.of.replace("{n}", String(base))})` };
}

/** Items that shipped in a week: a move to live in the week, or a passing gate result in the week for an item already live then
 *  ("left live after a gate"). Test items never count. */
export function shippedIn(rows: readonly ShipRow[], w: Pick<Week, "start" | "end">): number[] {
  const t = (s: string) => Date.parse(s), a = t(w.start), b = t(w.end), inW = (s: string) => t(s) >= a && t(s) < b;
  return rows.filter(r => !r.test && (r.moves.some(m => m.status === "live" && inW(m.at)) || r.gates.some(g => g.pass && inW(g.at) && r.moves.some(m => m.status === "live" && t(m.at) <= t(g.at))))).map(r => r.id).sort((x, y) => x - y);
}

export type LedgerInput = { calls: readonly CallRow[]; builds: readonly BuildRow[]; agents: readonly AgentRow[]; texts: readonly StoryTextRow[]; deskCalls: readonly DeskCallRow[]; published: readonly PublishedRow[]; ships: readonly ShipRow[]; cap: Cap };
export function buildLedger(i: LedgerInput, now: number, n = LEDGER_WEEKS): LedgerWeek[] {
  const t = (s: string) => Date.parse(s);
  // A story's cost: every writer text stored for it, plus its share of each standards or editor-in-chief call that read it (a call that
  // read two stories counts half against each, so no call is counted twice). Fixture calls (scoring runs) are not a story's cost.
  const storyUsd = new Map<string, number>();
  for (const x of i.texts) storyUsd.set(x.story_id, (storyUsd.get(x.story_id) ?? 0) + (Number(x.usd) || 0));
  for (const c of i.deskCalls) {
    if (!STORY_DESKS.has(c.desk) || c.purpose === "fixture" || !c.story_ids.length) continue;
    for (const s of c.story_ids) storyUsd.set(s, (storyUsd.get(s) ?? 0) + (Number(c.usd) || 0) / c.story_ids.length);
  }
  const firstPublished = new Map<string, string>();
  for (const p of i.published) { const f = firstPublished.get(p.story_id); if (!f || t(p.at) < t(f)) firstPublished.set(p.story_id, p.at); }
  return etWeeks(now, n).map((w, idx) => {
    const a = t(w.start), b = t(w.end), inW = (s: string) => t(s) >= a && t(s) < b;
    const calls = i.calls.filter(c => c.state !== "rejected" && inW(c.at));
    const by = new Map<string, KindLine>();
    for (const c of calls) {
      const k = `${c.kind}\u0000${c.model}`, l = by.get(k) ?? { kind: c.kind, model: c.model, calls: 0, failed: 0, tokens_in: 0, tokens_out: 0, usd: 0 };
      l.calls++; if (!c.ok) l.failed++; l.tokens_in += c.input_tokens ?? 0; l.tokens_out += c.output_tokens ?? 0; l.usd += Number(c.usd) || 0;
      by.set(k, l);
    }
    const byKind = [...by.values()].map(l => ({ ...l, usd: r4(l.usd) })).sort((x, y) => y.usd - x.usd || x.kind.localeCompare(y.kind) || x.model.localeCompare(y.model));
    const modelUsd = calls.reduce((s, c) => s + (Number(c.usd) || 0), 0);
    const builds = i.builds.filter(x => inW(x.at)), credits = builds.reduce((s, x) => s + Number(x.credits), 0);
    const agents = i.agents.filter(x => inW(x.at)), agentUsd = agents.reduce((s, x) => s + Number(x.usd), 0);
    const total = modelUsd + credits * CREDIT_USD + agentUsd;
    const pub = [...firstPublished.entries()].filter(([, at]) => inW(at)).map(([id]) => id);
    const vision = calls.filter(c => c.kind === CAPTURE_READ_KIND), read = new Set(vision.filter(c => c.ok && c.snapshot_id != null).map(c => c.snapshot_id));
    const shipped = shippedIn(i.ships, w);
    return {
      ...w, current: idx === 0,
      model: { calls: calls.length, failed: calls.filter(c => !c.ok).length, tokens_in: calls.reduce((s, c) => s + (c.input_tokens ?? 0), 0), tokens_out: calls.reduce((s, c) => s + (c.output_tokens ?? 0), 0), usd: r4(modelUsd), by_kind: byKind },
      build: { credits: r2(credits), usd: r2(credits * CREDIT_USD), entries: builds.length },
      agent: { recorded: agents.length > 0, usd: r2(agentUsd), entries: agents.length, line: agents.length ? `${usd(agentUsd)} recorded by hand (${plural(agents.length, "session")})` : "not recorded" },
      total_usd: r2(total),
      cap: capFor(i.cap, modelUsd, credits),
      per_story: unitCost(pub.reduce((s, id) => s + (storyUsd.get(id) ?? 0), 0), pub.length, { unit: "usd", noBase: "no stories published", of: "{n} published stories" }),
      per_capture: unitCost(vision.reduce((s, c) => s + (Number(c.usd) || 0), 0), read.size, { unit: "usd", noBase: "no captures read", of: "{n} captures read" }),
      per_change: unitCost(credits, shipped.length, { unit: "credits", noBase: "no changes shipped", of: "{n} shipped changes" }),
    };
  });
}
/** The week's spend against the owner's cap (model dollars and build credits are capped separately), or "no cap set". */
export function capFor(cap: Cap, modelUsd: number, credits: number): { set: boolean; line: string } {
  if (!cap || (cap.model_usd == null && cap.build_credits == null)) return { set: false, line: "no cap set" };
  const parts = [cap.model_usd != null ? `model ${usd(modelUsd)} of ${usd(cap.model_usd)}` : null, cap.build_credits != null ? `build ${r2(credits)} of ${r2(cap.build_credits)} credits` : null].filter(Boolean);
  return { set: true, line: parts.join("; ") };
}
/** /api/public/health's one line for this week (no per-call detail). */
export function healthSpendLine(w: { model_usd: number; build_credits: number; agent_usd: number }): string {
  const total = w.model_usd + w.build_credits * CREDIT_USD + w.agent_usd;
  return `This week (Eastern time): model calls ${usd(w.model_usd)}, build ${r2(w.build_credits)} credits (${usd(w.build_credits * CREDIT_USD)} at ${usd(CREDIT_USD)} a credit), agent sessions ${w.agent_usd > 0 ? usd(w.agent_usd) : "not recorded"}; ${usd(total)} in all.`;
}
