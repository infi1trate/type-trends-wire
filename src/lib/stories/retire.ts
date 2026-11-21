// Which stored stories the current rules would not produce, and how stored wording maps onto the current templates. Pure.
// Stories are insert-only: scripts/retire-stories.ts turns these answers into `kill` and `correct` rows in story_edits.
import { sectorName } from "../labels";
import { gapOk, MIN_RUN_GAP_DAYS } from "../run-gap";
import { deepEnough, firstSeenEligible, identityMove, inline, moveCandidate, noDollar, whiteSpaceGap, whiteSpaceText } from "./candidates";
import { runBase, type SampleRow } from "./sheet";
import { AI_EVENTS, WHITE_SPACE_MAX_SHARE, FIRST_SEEN_ARCHIVE_MIN_BRANDS, FIRST_SEEN_ARCHIVE_MIN_QUARTERS, FIRST_SEEN_MIN_BRANDS, ROUNDUP_MIN, type Candidate, type Fact, type NewsDropReason } from "./types";
import { SEASONAL_HELD_EVENTS } from "../promo";
import { isRebrand } from "../rebrand-rule";
import type { EventRow, RebrandRow } from "../agency/changes";
import { AI_ROUNDUP_DAILY_CAP, isAiRoundup } from "./score";

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
  reversed: "Retired: reversed within seven days",
} as const;
export type E0Reason = keyof typeof E0_RETIRE;
export const E0_WINDOW_DAYS = 30;
export const E0_CORRECT_NOTE = "Reworded as a move: fewer than three identity dimensions changed, so it is not a rebrand (wording only; the measured change is unchanged).";

export type E0Story = RetireStory & { kicker: string; headline: string; deck: string | null; facts: unknown };
export type E0Ctx = {
  /** A stored library event by id (live, with its sector), or null when it is not loaded. */
  event: (id: number) => EventRow | null;
  /** True when either capture of the event reads like a promotion (promo.ts). */
  seasonal: (eventId: number) => boolean;
  /** The rebrand desk row behind a rebrand story's source id (domain + confirmation time), or null. */
  rebrand: (domain: string, confirmedAt: string) => RebrandRow | null;
  /** The outside-news verdict for a wire item: why it is dropped now, null when it still qualifies, "unknown" when not loaded. */
  news: (wireId: number) => NewsDropReason | null | "unknown";
  /** True when the event was changed back within seven days, or is the change back (reversal.ts). Absent = nothing is reversed. */
  reversed?: (eventId: number) => boolean;
};
export type E0Verdict = { kill: E0Reason } | { correct: { type: "move"; kicker: string; headline: string; deck: string | null; facts: Fact[] } } | null;

const eventIdOf = (x: string) => { const m = /^(?:story:)?(?:move:|event:)(\d+)$/.exec(x); return m ? Number(m[1]) : null; };
const ids = (xs: string[]) => [...new Set(xs.map(eventIdOf).filter((n): n is number => n != null))];
/** The library events a single-brand story tells: a move's own event, a counter-move's move, an identity move's member moves. */
export const storyEventIds = (s: { id: string; source_ids: string[] }) => ids([s.id, ...s.source_ids]);
/** A published move, counter-move or identity move (shown type) told only by reversed events: the build retires it. */
export function reversedStory(s: { id: string; type: string; source_ids: string[] }, marked: ReadonlySet<number>): boolean {
  if (s.type !== "move" && s.type !== "counter_move") return false;
  const evs = storyEventIds(s);
  return evs.length > 0 && evs.every(id => marked.has(id));
}

/** What the E0 rules do with one published story: kill it (with a reason), re-word a non-rebrand as a move, or leave it. */
export function e0Verdict(s: E0Story, c: E0Ctx): E0Verdict {
  if (s.type === "counter_move") return { kill: "counter" };
  if (s.type === "news") {
    const w = s.source_ids.map(x => /^wire:(\d+)$/.exec(x)).find(Boolean), v = w ? c.news(Number(w[1])) : "unknown";
    if (v === "bluesky" || (v === "unknown" && /\bBluesky\b/.test(s.kicker))) return { kill: "bluesky" };
    if (v === "no_name" || v === "no_subject") return { kill: "news" };
    return null;
  }
  const rev = (id: number) => !!c.reversed?.(id);
  if (s.type === "move") {
    // A rebrand already re-worded as a move (id "rebrand:…"): seasonal when its desk row or a member move is, reversed when every member move is.
    if (s.id.startsWith("rebrand:")) {
      const src = /^rebrand:(.+):(\d{4}-\d{2}-\d{2}T.*)$/.exec(s.source_ids.find(x => x.startsWith("rebrand:")) ?? "");
      const r = src ? c.rebrand(src[1]!, src[2]!) : null;
      const events = ids(s.source_ids.filter(x => x.startsWith("story:move:"))).map(id => c.event(id)).filter((e): e is EventRow => !!e);
      if (r?.seasonal || events.some(e => c.seasonal(e.id) && SEASONAL_HELD_EVENTS.has(e.type))) return { kill: "seasonal" };
      // Its own events (the desk row's) decide; without them, its member moves do.
      const own = r?.event_ids?.length ? r.event_ids : events.map(e => e.id);
      if (own.length && own.every(rev)) return { kill: "reversed" };
      return null;
    }
    const id = ids([s.id, ...s.source_ids.filter(x => x.startsWith("event:"))])[0], e = id != null ? c.event(id) : null;
    if (!e) return null;
    if (c.seasonal(e.id) && SEASONAL_HELD_EVENTS.has(e.type)) return { kill: "seasonal" };
    if (rev(e.id)) return { kill: "reversed" };
    if (AI_EVENTS.has(e.type)) return { kill: "estimate" };
    return null;
  }
  if (s.type === "roundup") {
    const members = ids(s.source_ids.filter(x => x.startsWith("story:move:"))).map(id => c.event(id)).filter((e): e is EventRow => !!e);
    if (!members.length) return null;
    const kept = members.filter(e => !c.seasonal(e.id));
    if (new Set(kept.map(e => e.domain)).size < ROUNDUP_MIN) return { kill: "seasonal" };
    return new Set(kept.filter(e => !rev(e.id)).map(e => e.domain)).size < ROUNDUP_MIN ? { kill: "reversed" } : null;
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
    const own = r.event_ids?.length ? r.event_ids : measured.map(e => e.id);
    if (own.length && own.every(rev)) return { kill: "reversed" };
    const m = identityMove(r, measured.map(moveCandidate));
    return { correct: { type: "move", kicker: m.kicker, headline: noDollar(m.headline), deck: m.deck == null ? null : noDollar(m.deck), facts: m.facts.map(f => ({ ...f, text: noDollar(f.text) })) } };
  }
  return null;
}

// PHASE E2a · THE EDITOR'S CALL ----------------------------------------------------------------------
// The tiers applied to stories already published: a story the E2a engine would not run is retired (a tape line, a desk hold, a Brief
// table row), and a brand's several stories inside seven days are folded into the first with one correction. Pure: the script supplies
// the shown stories and the current candidates; the answer is kills and corrections, appended as story_edits.
export const E2_RETIRE = {
  tape: "Retired: now a tape line",
  folded: "Retired: folded into one story about this brand",
  desk: "Retired: held for the desk (unclear headline call)",
  brief: "Retired: Brief table only (signal on under 10% of tracked homepages)",
  firstSeen: "Retired: a first sighting needs at least two brands",
  whiteSpace: "Retired: the gap could not be filled",
} as const;
export type E2Reason = keyof typeof E2_RETIRE;
export const E2_WINDOW_DAYS = 14;
/** "Accent, vivid dark purple to vivid violet · 14 Nov" → "accent". */
export const factWhat = (text: string) => text.split(" · ")[0]!.split(",")[0]!.trim().toLowerCase();
const andList = (xs: string[]) => { const u = [...new Set(xs)]; return u.length < 2 ? u.join("") : `${u.slice(0, -1).join(", ")} and ${u.at(-1)}`; };
export const E2_FOLD_NOTE = (added: string[]) => `Folded: one brand, one story. Added the ${andList(added.map(factWhat))} change${new Set(added.map(factWhat)).size > 1 ? "s" : ""} from the brand's other changes that week.`;
export type E2Story = { id: string; type: string; sector: string | null; signal_keys: string[]; domains: string[]; source_ids: string[]; happened_at: string; headline: string; deck: string | null; facts: unknown };
export type E2Ctx = {
  candidates: Candidate[];
  /** The signal's share of tracked homepages in the latest run (0–1), or null when unknown. */
  shareOf: (key: string) => number | null;
  /** The reason a white space could not be filled in this sector, or null. */
  notApplicable: (sector: string, key: string) => string | null;
  shiftMinShare: number;
};
export type E2Plan = { kills: { id: string; reason: E2Reason }[]; corrects: { id: string; payload: { deck: string; facts: Fact[] }; note: string }[] };
const SINGLE = new Set(["move", "rebrand", "counter_move"]);
export function e2Plan(stories: E2Story[], c: E2Ctx): E2Plan {
  const out: E2Plan = { kills: [], corrects: [] };
  const brand = c.candidates.filter(x => x.id.startsWith("brand:") && !x.holdReason), desk = c.candidates.filter(x => x.id.startsWith("call:"));
  const tellsAny = (x: Candidate, evs: number[]) => x.sourceIds.some(s => { const n = eventIdOf(s); return n != null && evs.includes(n); });
  const groups = new Map<string, E2Story[]>();
  for (const s of stories) {
    if (SINGLE.has(s.type)) {
      const evs = storyEventIds(s); if (!evs.length) continue;
      const b = brand.find(x => x.domains[0] === s.domains[0] && tellsAny(x, evs));
      if (b) { groups.set(b.id, [...(groups.get(b.id) ?? []), s]); continue; }
      out.kills.push({ id: s.id, reason: desk.some(x => tellsAny(x, evs)) ? "desk" : "tape" });
    } else if (s.type === "roundup") {
      const key = s.signal_keys[0];
      const keep = key && c.candidates.some(x => x.id.startsWith("roundup:") && x.signalKeys.includes(key) && (x.sector ?? null) === (s.sector ?? null) && s.domains.filter(d => x.domains.includes(d)).length >= ROUNDUP_MIN);
      if (!keep) out.kills.push({ id: s.id, reason: "tape" });
    } else if (s.type === "shift") {
      const share = s.signal_keys[0] ? c.shareOf(s.signal_keys[0]) : null;
      if (share != null && share < c.shiftMinShare) out.kills.push({ id: s.id, reason: "brief" });
    } else if (s.type === "first_seen") {
      if (s.domains.length < FIRST_SEEN_MIN_BRANDS) out.kills.push({ id: s.id, reason: "firstSeen" });
    } else if (s.type === "white_space") {
      if (s.sector && s.signal_keys[0] && c.notApplicable(s.sector, s.signal_keys[0])) out.kills.push({ id: s.id, reason: "whiteSpace" });
    }
  }
  // One brand, one story: the story whose id the candidate carries (else the earliest) keeps running and gains the missing specifics.
  for (const [cid, ss] of groups) {
    const cand = brand.find(x => x.id === cid)!, target = ss.find(s => s.id === cid) ?? [...ss].sort((a, b) => a.happened_at.localeCompare(b.happened_at) || a.id.localeCompare(b.id))[0]!;
    for (const s of ss) if (s !== target) out.kills.push({ id: s.id, reason: "folded" });
    const have = new Set(asFacts(target.facts).map(f => f.text)), add = cand.facts.filter(f => f.kind === "member" && !have.has(f.text));
    if (!add.length) continue;
    const facts = [...cand.facts.filter(f => f.kind === "member"), ...asFacts(target.facts).filter(f => f.kind !== "member" && f.kind !== "before" && f.kind !== "after" && f.kind !== "date"), ...cand.facts.filter(f => f.kind === "share" && !have.has(f.text))];
    out.corrects.push({ id: target.id, payload: { deck: cand.deck ?? target.deck ?? "", facts }, note: E2_FOLD_NOTE(add.map(f => f.text)) });
  }
  return out;
}

// PHASE E2b · RE-PLAN ONE DAY ---------------------------------------------------------------------
// After the plan rules changed (measured first, one AI-read roundup a day, weekly pieces outside the five, against the grain backed by a
// measured change), a day is re-planned once: stored stories that lose their place get a kill ("Held: over the daily cap"), held stories
// that now win one get a restore, and the old against-the-grain piece is retired. Pure; appended edits are the only write, numbers stay.
export const E2B_REPLAN = {
  cap: "Held: over the daily cap",
  against: "Retired: against the grain now needs a measured change behind each brand",
  restore: "Re-planned: measured stories take their places first",
} as const;
export type ReplanStored = { id: string; type: string; state: "published" | "held" | "killed"; happened_at: string; basis?: string | null };
export type ReplanPlanned = { id: string; status: "published" | "held"; reason: string; type?: string; basis?: string | null };
export function replanEdits(stored: ReplanStored[], plan: ReplanPlanned[], day: string): { kills: { id: string; note: string }[]; restores: { id: string; note: string }[] } {
  const by = new Map(plan.map(p => [p.id, p])), kills: { id: string; note: string }[] = [], restores: { id: string; note: string }[] = [];
  for (const s of stored.filter(x => x.happened_at.slice(0, 10) === day && x.type !== "launch")) {
    const p = by.get(s.id);
    if (s.state === "published") {
      if (p?.status === "held") kills.push({ id: s.id, note: /^over the daily cap/.test(p.reason) ? E2B_REPLAN.cap : `Held: ${p.reason}`.slice(0, 200) });
      else if (!p && /^against:\d{4}-W\d{2}$/.test(s.id)) kills.push({ id: s.id, note: E2B_REPLAN.against });
      // An AI-read roundup the new plan no longer holds under this id (its window moved) loses its place when the day already has its one.
      else if (!p && isAiRoundup({ id: s.id, type: s.type, basis: s.basis ?? null }) && plan.filter(x => x.status === "published" && x.type != null && isAiRoundup({ id: x.id, type: x.type, basis: x.basis ?? null })).length >= AI_ROUNDUP_DAILY_CAP) kills.push({ id: s.id, note: E2B_REPLAN.cap });
    } else if (s.state === "held" && p?.status === "published") restores.push({ id: s.id, note: E2B_REPLAN.restore });
  }
  return { kills, restores };
}

// PHASE U2b · ONE COUNT PER CLAIM -------------------------------------------------------------------
// A stored white space was counted from site traits; its claim is now judged on the forecast run's own sample (the run that gave the
// signal its stage). A story that still passes is corrected to the run's numbers (append-only `correct` edit; its text is rewritten by
// the scheduled job because its facts changed); one that no longer passes is retired with the count in the note. Thresholds never move.
export const U2B_WHITE_NOTE = "Corrected: counts now come from the forecast run's latest-quarter sample, the same one that gives the signal its stage.";
export const u2bWhiteRetire = (k: number, n: number, sector: string) =>
  `Retired: on the forecast run's sample ${k} of ${n} tracked ${sector} homepages show it (${Math.round((k / n) * 1000) / 10}%), above the ${Math.round(WHITE_SPACE_MAX_SHARE * 100)}% a white space allows`;
export type WhiteVerdict = { kill: string } | { correct: { headline: string; deck: string; facts: Fact[] }; note: string } | { keep: true } | { unknown: true };
export function whiteSpaceRecheck(s: { sector: string | null; signal_keys: string[]; headline: string; deck: string | null; facts: unknown }, all: SampleRow | null | undefined, sec: SampleRow | null | undefined, stage: string): WhiteVerdict {
  const key = s.signal_keys[0], b = runBase(sec);
  if (!key || !s.sector || !runBase(all) || !b) return { unknown: true };
  const g = whiteSpaceGap(all, sec);
  if (!g) return { kill: u2bWhiteRetire(b.count, b.base, inline(sectorName(s.sector))).slice(0, 200) };
  const t = whiteSpaceText(key, s.sector, g, stage);
  const facts = Array.isArray(s.facts) ? (s.facts as Fact[]) : [];
  const kept = facts.filter(f => f.kind !== "count" && !(f.kind === "share" && /other sectors/.test(f.text)));
  const next = [...t.counts, ...kept];
  if (t.deck === s.deck && t.headline === s.headline && JSON.stringify(next) === JSON.stringify(facts)) return { keep: true };
  return { correct: { headline: t.headline, deck: t.deck, facts: next }, note: U2B_WHITE_NOTE };
}
