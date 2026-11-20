// Which stored stories the current rules would not produce, and how stored wording maps onto the current templates. Pure.
// Stories are insert-only: scripts/retire-stories.ts turns these answers into `kill` and `correct` rows in story_edits.
import { sectorName } from "../labels";
import { gapOk, MIN_RUN_GAP_DAYS } from "../run-gap";
import { deepEnough, firstSeenEligible, identityMove, inline, moveCandidate, noDollar } from "./candidates";
import { AI_EVENTS, FIRST_SEEN_ARCHIVE_MIN_BRANDS, FIRST_SEEN_ARCHIVE_MIN_QUARTERS, FIRST_SEEN_MIN_BRANDS, ROUNDUP_MIN, type Candidate, type Fact, type NewsDropReason } from "./types";
import { SEASONAL_HELD_EVENTS } from "../promo";
import { isRebrand } from "../rebrand-rule";
import type { EventRow, RebrandRow } from "../agency/changes";

export type RetireStory = { id: string; type: string; sector: string | null; signal_keys: string[]; domains: string[]; source_ids: string[] };
export type RetireCtx = {
  /** computed_at of a real run, or null when the run is unknown or not real. */
  runAt: (id: number) => string | null;
  /** Archive depth for a sector (null = library-wide) and signal category. */
  depth: (sector: string | null, category: string) => { brands: number; quarters: number };
};
export const RETIRE = {
  gap: `Retired: compared forecast runs less than ${MIN_RUN_GAP_DAYS} days apart`,
  unreal: "Retired: compared a forecast run that is not a real weekly run",
  unmeasurable: "Retired: the archive cannot measure this signal",
  oneBrand: `Retired: a sector first needs at least ${FIRST_SEEN_MIN_BRANDS} brands`,
  thin: (where: string) => `Retired: the archive ${where} is too thin to call a first (needs ${FIRST_SEEN_ARCHIVE_MIN_BRANDS} brands and ${FIRST_SEEN_ARCHIVE_MIN_QUARTERS} quarters with this measured)`,
} as const;
const category = (k: string) => k.slice(0, Math.max(0, k.indexOf(":")));

/** The kill note for a stored story the new rules would not produce, or null to keep it. */
export function retireReason(s: RetireStory, c: RetireCtx): string | null {
  if (s.type === "shift" || s.type === "crossover") {
    const runs = s.source_ids.filter(x => x.startsWith("run:")).map(x => Number(x.slice(4))).filter(Number.isFinite);
    if (runs.length < 2) return RETIRE.unreal;
    const [a, b] = [Math.min(...runs), Math.max(...runs)], at = c.runAt(a), bt = c.runAt(b);
    if (!at || !bt) return RETIRE.unreal;
    if (!gapOk(at, bt)) return `${RETIRE.gap} (runs ${a} and ${b}, ${Math.round(Math.abs(Date.parse(bt) - Date.parse(at)) / 36e5)} hours apart).`;
    return null;
  }
  if (s.type === "first_seen") {
    const key = s.signal_keys[0] ?? "";
    if (!firstSeenEligible(key)) return `${RETIRE.unmeasurable}.`;
    if (s.sector && s.domains.length < FIRST_SEEN_MIN_BRANDS) return `${RETIRE.oneBrand}.`;
    if (!deepEnough(c.depth(null, category(key)))) return `${RETIRE.thin("overall")}.`;
    if (s.sector && !deepEnough(c.depth(s.sector, category(key)))) return `${RETIRE.thin(`for ${inline(sectorName(s.sector))}`)}.`;
    return null;
  }
  return null;
}

// REWORDING --------------------------------------------------------------------------------------
export type Wording = { headline: string; deck: string | null; facts: Fact[] };
export type RewordSources = {
  /** The current template's move story for an event id (events never change, so this is the same fact in today's words). */
  move: (eventId: number) => Candidate | null;
  /** The current rebrand deck for a domain + confirmation time. */
  rebrandDeck: (domain: string, confirmedAt: string) => string | null;
};
const asFacts = (v: unknown): Fact[] => (Array.isArray(v) ? v.filter((f): f is Fact => !!f && typeof f === "object" && typeof (f as Fact).text === "string") : []);
/** "Seen on 1 tracked studios brand, including x.com" → "Seen on 1 tracked studios brand: x.com". */
export const oneBrandFact = (t: string) => t.replace(/^(Seen on 1 tracked (?:[^,]*? )?brand), including /, "$1: ");
const canon = (fs: Fact[]) => JSON.stringify(fs.map(f => [f.text, f.href ?? null, f.basis ?? null, f.kind ?? null]));
const memberLine = (c: Candidate) => `${c.headline}${c.deck ? `: ${c.deck}` : ""}`;
const moveOf = (id: string, src: RewordSources) => { const m = /^(?:story:)?move:(\d+)$/.exec(id); return m ? src.move(Number(m[1])) : null; };

/** The stored story in today's template words, or null when nothing changes. Only wording changes: numbers come from the stored story or its unchanged source event. */
export function reword(s: RetireStory & { headline: string; deck: string | null; facts: unknown }, src: RewordSources): Wording | null {
  const facts = asFacts(s.facts);
  let next: Wording = { headline: s.headline, deck: s.deck, facts: facts.map(f => ({ ...f, text: oneBrandFact(f.text) })) };
  if (s.type === "move") { const c = moveOf(s.id, src); if (c) next = { headline: c.headline, deck: c.deck, facts: c.facts }; }
  else if (s.type === "counter_move") {
    const c = s.source_ids.map(x => moveOf(x, src)).find(Boolean);
    if (c) next = { headline: s.headline, deck: `${c.headline}${c.deck ? `: ${c.deck}` : "."}`, facts: [...c.facts, ...next.facts.filter(f => f.kind === "stage")] };
  } else if (s.type === "roundup") {
    const members = s.source_ids.filter(x => x.startsWith("story:move:")).map(x => moveOf(x, src));
    const memberFacts = next.facts.filter(f => f.kind === "member");
    if (members.length === memberFacts.length && members.every(Boolean)) { let i = 0; next.facts = next.facts.map(f => (f.kind === "member" ? { ...f, text: memberLine(members[i++]!) } : f)); }
  } else if (s.type === "rebrand") {
    const r = /^rebrand:(.+):(\d{4}-\d{2}-\d{2}T.*)$/.exec(s.source_ids.find(x => x.startsWith("rebrand:")) ?? "");
    const deck = r ? src.rebrandDeck(r[1]!, r[2]!) : null;
    const members = s.source_ids.filter(x => x.startsWith("story:move:")).map(x => moveOf(x, src)), memberFacts = next.facts.filter(f => f.kind === "member");
    if (members.length === memberFacts.length && members.every(Boolean)) { let i = 0; next.facts = next.facts.map(f => (f.kind === "member" ? { ...f, text: members[i++]!.headline } : f)); }
    if (deck) next.deck = deck;
  }
  // Stories never carry a "$" (same pass as allCandidates).
  next = { headline: noDollar(next.headline), deck: next.deck == null ? null : noDollar(next.deck), facts: next.facts.map(f => ({ ...f, text: noDollar(f.text) })) };
  // Stored jsonb reorders object keys, so facts compare by their fields, not their serialization.
  const same = next.headline === s.headline && next.deck === s.deck && canon(next.facts) === canon(facts);
  return same ? null : next;
}

// PHASE E0 · STOP THE NOISE ----------------------------------------------------------------------
// The same rules the engine now runs by (rebrand dimensions, seasonal holds, the news subject rule, estimate-only and counter-move
// holds), applied to stories already published. Pure: the script supplies the stored rows; the answer is a kill, a correct, or nothing.
export const E0_RETIRE = {
  rebrand: "Retired: one change is not a rebrand",
  seasonal: "Retired: seasonal promotion on the page",
  news: "Retired: outside news without a design subject",
  bluesky: "Retired: Bluesky post",
  estimate: "Retired: estimate only",
  counter: "Retired: held for the weekly counter-move roundup",
} as const;
export type E0Reason = keyof typeof E0_RETIRE;
export const E0_WINDOW_DAYS = 30;
export const E0_CORRECT_NOTE = "Reworded as a move: fewer than three identity dimensions changed, so it is not a rebrand (wording only; the measured change is unchanged).";

export type E0Story = RetireStory & { kicker: string; headline: string; deck: string | null; facts: unknown };
export type E0Ctx = {
  /** A stored library event by id (live, with its sector), or null when it is not loaded. */
  event: (id: number) => EventRow | null;
  /** True when the event's after capture reads like a promotion and its before capture does not (promo.ts). */
  seasonal: (eventId: number) => boolean;
  /** The rebrand desk row behind a rebrand story's source id (domain + confirmation time), or null. */
  rebrand: (domain: string, confirmedAt: string) => RebrandRow | null;
  /** The outside-news verdict for a wire item: why it is dropped now, null when it still qualifies, "unknown" when not loaded. */
  news: (wireId: number) => NewsDropReason | null | "unknown";
};
export type E0Verdict = { kill: E0Reason } | { correct: { type: "move"; kicker: string; headline: string; deck: string | null; facts: Fact[] } } | null;

const eventIdOf = (x: string) => { const m = /^(?:story:)?(?:move:|event:)(\d+)$/.exec(x); return m ? Number(m[1]) : null; };
const ids = (xs: string[]) => [...new Set(xs.map(eventIdOf).filter((n): n is number => n != null))];

/** What the E0 rules do with one published story: kill it (with a reason), re-word a non-rebrand as a move, or leave it. */
export function e0Verdict(s: E0Story, c: E0Ctx): E0Verdict {
  if (s.type === "counter_move") return { kill: "counter" };
  if (s.type === "news") {
    const w = s.source_ids.map(x => /^wire:(\d+)$/.exec(x)).find(Boolean), v = w ? c.news(Number(w[1])) : "unknown";
    if (v === "bluesky" || (v === "unknown" && /\bBluesky\b/.test(s.kicker))) return { kill: "bluesky" };
    if (v === "no_name" || v === "no_subject") return { kill: "news" };
    return null;
  }
  if (s.type === "move") {
    // A rebrand already re-worded as a move (id "rebrand:…") was decided by the rebrand rule; only a move's own event counts here.
    if (s.id.startsWith("rebrand:")) return null;
    const id = ids([s.id, ...s.source_ids.filter(x => x.startsWith("event:"))])[0], e = id != null ? c.event(id) : null;
    if (!e) return null;
    if (c.seasonal(e.id) && SEASONAL_HELD_EVENTS.has(e.type)) return { kill: "seasonal" };
    if (AI_EVENTS.has(e.type)) return { kill: "estimate" };
    return null;
  }
  if (s.type === "roundup") {
    const members = ids(s.source_ids.filter(x => x.startsWith("story:move:"))).map(id => c.event(id)).filter((e): e is EventRow => !!e);
    if (!members.length) return null;
    const brands = new Set(members.filter(e => !c.seasonal(e.id)).map(e => e.domain));
    return brands.size < ROUNDUP_MIN ? { kill: "seasonal" } : null;
  }
  if (s.type === "rebrand") {
    const src = /^rebrand:(.+):(\d{4}-\d{2}-\d{2}T.*)$/.exec(s.source_ids.find(x => x.startsWith("rebrand:")) ?? "");
    const r = src ? c.rebrand(src[1]!, src[2]!) : null;
    const events = ids(s.source_ids.filter(x => x.startsWith("story:move:"))).map(id => c.event(id)).filter((e): e is EventRow => !!e);
    const seasonal = !!r?.seasonal || events.some(e => c.seasonal(e.id) && SEASONAL_HELD_EVENTS.has(e.type));
    if (seasonal) return { kill: "seasonal" };
    if (r && isRebrand(r)) return null;
    if (!r) return { kill: "rebrand" };
    const measured = events.filter(e => !AI_EVENTS.has(e.type));
    if (events.length && !measured.length) return { kill: "estimate" };
    const m = identityMove(r, measured.map(moveCandidate));
    return { correct: { type: "move", kicker: m.kicker, headline: noDollar(m.headline), deck: m.deck == null ? null : noDollar(m.deck), facts: m.facts.map(f => ({ ...f, text: noDollar(f.text) })) } };
  }
  return null;
}
