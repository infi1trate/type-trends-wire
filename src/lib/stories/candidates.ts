// Story candidates from what already exists: library events, rebrands, real forecast runs, alerts, wire items, launches,
// the current library sample and its archive. Pure and deterministic: same rows in, same candidates (and ids) out.
import { basis, canonical, label, sectorName, stageName, untick, type Basis } from "../labels";
import { eventSentence, EVENT_KIND, REBRAND_WORDS, type EventRow, type RebrandRow } from "../agency/changes";
import { siteTraits, type SiteRow } from "../forecast-signals";
import { brandPath, patternPath, signalPath } from "../ia";
import { pct } from "../digest/copy";
import { isoWeek } from "../digest/week";
import { rowKey, tiersFrom, type SignalRow } from "../signals";
import { SECTOR_COVERAGE_MIN } from "../sector-lens";
import type { Tier } from "../tiers";
import {
  AI_EVENTS, CROSSOVER_FLOOR, CROSSOVER_LEAD_MIN, FIRST_SEEN_MIN_BRANDS, MOVE_EVENTS, MOVE_LAYOUT_FIELDS, NEWS_NAME_MIN, NEWS_NAME_STOPWORDS, NEWS_SIGNAL_MIN,
  REBRAND_FOLD_AFTER_DAYS, REBRAND_FOLD_BEFORE_DAYS, ROUNDUP_MIN, ROUNDUP_WINDOW_DAYS, STORY_TYPE_DEFS, WHITE_SPACE_MAX_SHARE, WHITE_SPACE_MIN_ELSEWHERE,
  WHITE_SPACE_MIN_SECTOR_SITES, FIRST_SEEN_MAX_BRANDS, WHITE_SPACE_SKIP_CATEGORIES, countWord, type Candidate, type Fact,
} from "./types";

export type RunRows = { id: number; at: string; rows: SignalRow[] };
export type WireIn = { id: number; title: string; url: string; source: string; source_kind: string; published_at: string; excerpt: string | null; ref?: string | null };
export type SiteNow = { domain: string; name: string | null; sector: string; captured: string | null; traits: string[] };
export type ArchiveRow = { domain: string; sector: string; traits: string[] };
export type BuildInput = {
  now: string;
  events: EventRow[]; rebrands: RebrandRow[];
  /** Real (non-dev) forecast runs, oldest first. */
  runs: RunRows[];
  alerts: WireIn[]; wire: WireIn[]; launches: WireIn[];
  sites: SiteNow[]; archive: ArchiveRow[];
  trendsetters: { domain: string; rank: number }[];
};

const day = 864e5;
const STAGE_ORDER: Record<string, number> = { Emerging: 0, Rising: 1, Steady: 1.5, Peaking: 2, Fading: 3 };
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
/** A label used mid-sentence: lower-case the first letter unless it starts an acronym ("Serif headlines" → "serif headlines", "AI" stays). */
export const inline = (name: string) => (/^[A-Z][a-z]/.test(name) ? name[0]!.toLowerCase() + name.slice(1) : name);
const listOf = (xs: string[], n = 3) => (xs.length <= 1 ? xs.join("") : xs.length <= n ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : `${xs.slice(0, n).join(", ")} and ${xs.length - n} more`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const where = (sector: string | null) => (!sector || sector === "all" ? "across all sectors" : `in ${inline(sectorName(sector))}`);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
/** Stories never carry a "$": prices quoted from a brand's copy read as "USD 20", anything else drops the sign. */
export const noDollar = (s: string) => s.replace(/\$\s?(?=\d)/g, "USD ").replace(/\$/g, "");
/** "A, B, B" → "A, B": palette sentences can repeat a colour name for near-identical swatches. */
export const dedupeList = (s: string) => s.replace(/(?<=\b(?:to|:)\s)([^:;.]+)/g, list => [...new Set(list.split(", "))].join(", "));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Everything the builders share: tiers from the latest real run, row lookups, sector membership and trendsetter ranks. */
export type Ctx = ReturnType<typeof context>;
export function context(input: BuildInput) {
  const runs = [...input.runs].sort((a, b) => a.id - b.id), cur = runs.at(-1) ?? null;
  const prevStages = new Map<string, (string | null)[]>();
  [runs.at(-2), runs.at(-3)].forEach((r, i) => { for (const x of r?.rows ?? []) if (x.scope === "all") { const k = rowKey(x), a = prevStages.get(k) ?? [null, null]; a[i] = x.stage; prevStages.set(k, a); } });
  const tierMap = cur ? tiersFrom(cur.rows, prevStages) : new Map();
  const tiers = new Map<string, Tier>([...tierMap.values()].map(t => [t.key, t.tier]));
  const index = new Map<number, Map<string, SignalRow>>(runs.map(r => [r.id, new Map(r.rows.map(x => [`${rowKey(x)}|${x.scope}`, x]))]));
  const row = (run: RunRows | null | undefined, key: string, scope = "all") => (run ? index.get(run.id)?.get(`${key}|${scope}`) ?? null : null);
  const headline = new Set([...tiers].filter(([, t]) => t === "headline").map(([k]) => k));
  const sites = input.sites.filter(s => s.traits.length), bySector = new Map<string, SiteNow[]>();
  for (const s of sites) bySector.set(s.sector, [...(bySector.get(s.sector) ?? []), s]);
  const rank = new Map(input.trendsetters.map(t => [t.domain, t.rank]));
  const byRank = (a: string, b: string) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b);
  const showing = (key: string, sector?: string | null) => (sector ? bySector.get(sector) ?? [] : sites).filter(s => s.traits.includes(key)).map(s => s.domain).sort(byRank);
  /** A sector is covered when at least half the headline signals have an ok forecast row there (the sector lens rule). */
  const covered = (sector: string | null) => {
    if (!sector || sector === "all") return true;
    if (!cur || !headline.size) return false;
    let n = 0; for (const k of headline) if (row(cur, k, sector)?.status === "ok") n++;
    return n / headline.size >= SECTOR_COVERAGE_MIN;
  };
  /** Stage for a brand's sector when covered, else all sectors. */
  const stageFor = (key: string, sector: string | null) => { const s = sector && covered(sector) ? row(cur, key, sector) : null; return s?.status === "ok" ? { stage: s.stage, scope: sector! } : { stage: row(cur, key)?.stage ?? null, scope: "all" }; };
  return { runs, cur, tiers, headline, row, sites, bySector, rank, byRank, showing, covered, stageFor, now: input.now };
}
const tierOf = (ctx: Ctx, key: string): Tier | null => ctx.tiers.get(canonical(key)) ?? null;
const shown = (ctx: Ctx, key: string) => { const t = tierOf(ctx, key); return t === "headline" || t === "supporting"; };
const brandFact = (domains: string[], total: number, sector: string | null, key: string): Fact => ({
  text: `Seen on ${total} tracked ${sector ? `${inline(sectorName(sector))} ` : ""}brand${total === 1 ? "" : "s"}${domains.length ? `${total === 1 ? ":" : ", including"} ${listOf(domains.slice(0, 3))}` : ""}`,
  href: patternPath(key), basis: basis(key), kind: "brand",
});

// MOVE ---------------------------------------------------------------------------------------------
/** A visible move: the event type is a visitor-facing change (layout only when the hero changed). */
export function isVisibleMove(e: Pick<EventRow, "type" | "after" | "before">): boolean {
  if (!MOVE_EVENTS.has(e.type)) return false;
  if (e.type !== "layout_change") return true;
  const keys = Object.keys({ ...(e.before as object ?? {}), ...(e.after as object ?? {}) });
  return keys.some(k => MOVE_LAYOUT_FIELDS.has(k));
}
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** Traits a move gained and dropped (only the fields this event measured). */
export function traitDelta(e: Pick<EventRow, "type" | "before" | "after" | "domain" | "sector">): { gained: string[]; dropped: string[] } {
  const side = (v: unknown): SiteRow => {
    const o = obj(v), r: SiteRow = { domain: e.domain, quarter: "", sector: e.sector ?? "" };
    if (e.type === "type_change" && typeof o["h1"] === "string") r.h1_family = o["h1"];
    if (e.type === "theme_flip" && typeof o["theme"] === "string") r.theme = o["theme"];
    if (e.type === "layout_change" && typeof o["hero_media"] === "string") r.hero_media = o["hero_media"];
    if (AI_EVENTS.has(e.type)) { const dim = e.type === "imagery_shift" ? "imagery" : "aesthetic"; r.ai_tags = { [dim]: o[dim] }; }
    return r;
  };
  const b = new Set(siteTraits(side(e.before))), a = new Set(siteTraits(side(e.after)));
  return { gained: [...a].filter(k => !b.has(k)).sort(), dropped: [...b].filter(k => !a.has(k)).sort() };
}
export function moveCandidate(e: EventRow): Candidate {
  const sentence = dedupeList(untick(eventSentence(e))), cut = sentence.indexOf(": ");
  // "x.com changed its palette to A, B, C" keeps the headline short and moves the list into the after line.
  const to = cut > 0 ? null : /^(.+? changed its [a-z ]+?) to (.+)$/.exec(sentence);
  const head = to ? to[1]! : cut > 0 ? sentence.slice(0, cut) : sentence, detail = to ? `→ ${to[2]}` : cut > 0 ? sentence.slice(cut + 2) : "";
  const parts = detail ? detail.split("; ") : [], arrow = parts.length === 1 ? parts[0]!.split(/ ?→ /) : [];
  const b: Basis = AI_EVENTS.has(e.type) ? "ai" : "measured", brand = brandPath(e.domain);
  const facts: Fact[] = [
    ...(arrow.length === 2 ? [...(arrow[0] ? [{ text: `Before: ${arrow[0]}`, href: brand, basis: b, kind: "before" as const }] : []), { text: `After: ${arrow[1]}`, href: brand, basis: b, kind: "after" as const }] : parts.map(p => ({ text: p, href: brand, basis: b }))),
    { text: `Confirmed on a second capture, ${shortDate(e.detected_at)}`, href: `/library/${encodeURIComponent(e.domain)}`, basis: b, kind: "date" },
  ];
  const fields = Object.keys(obj(e.after)).length;
  return { id: `move:${e.id}`, type: "move", kicker: `Move · ${EVENT_KIND[e.type] ?? "Change"}${e.sector ? ` · ${sectorName(e.sector)}` : ""}`, headline: head,
    deck: `${to ? `Now ${to[2]}. ` : detail ? `${detail}. ` : ""}Confirmed ${shortDate(e.detected_at)}.`, facts, sector: e.sector ?? null, signalKeys: [], domains: [e.domain],
    evidence: [{ label: "Brand page", href: brand }, { label: "Library record", href: `/library/${encodeURIComponent(e.domain)}` }], sourceIds: [`event:${e.id}`], basis: b, happenedAt: e.detected_at,
    magnitude: e.type === "redesign" ? 99 : Math.max(1, fields) };
}

// REBRAND ------------------------------------------------------------------------------------------
export function rebrandCandidate(r: RebrandRow, moves: { c: Candidate; e: EventRow }[]): Candidate {
  const at = Date.parse(r.confirmed_at), reasons = r.reasons.map(x => REBRAND_WORDS[x] ?? x);
  const members = moves.filter(m => m.e.domain === r.domain && Date.parse(m.e.detected_at) >= at - REBRAND_FOLD_BEFORE_DAYS * day && Date.parse(m.e.detected_at) <= at + REBRAND_FOLD_AFTER_DAYS * day).map(m => m.c);
  const brand = brandPath(r.domain);
  return { id: `rebrand:${r.domain}:${r.confirmed_at.slice(0, 10)}`, type: "rebrand", kicker: `Rebrand · ${sectorName(r.sector)}`,
    headline: `${r.domain} rebranded: new ${listOf(reasons, 4) || "identity"}`, deck: clip(untick(r.read), 220),
    facts: [{ text: `Changed: ${listOf(reasons, 5) || "identity"}`, href: brand, basis: "measured" }, { text: `Confirmed ${shortDate(r.confirmed_at)}`, href: `/brands?tab=moves`, basis: "measured", kind: "date" },
      ...members.map(m => ({ text: m.headline, href: brand, basis: m.basis, kind: "member" as const }))],
    sector: r.sector, signalKeys: [], domains: [r.domain], evidence: [{ label: "Brand page", href: brand }, { label: "Rebrand desk", href: "/brands?tab=moves" }],
    sourceIds: [`rebrand:${r.domain}:${r.confirmed_at}`, ...members.map(m => `story:${m.id}`)], basis: "measured", happenedAt: r.confirmed_at, magnitude: Math.max(1, r.reasons.length), members: members.map(m => m.id) };
}

// SHIFT --------------------------------------------------------------------------------------------
export const stageDistance = (from: string | null, to: string | null) => { const a = stageName(from), b = stageName(to); return a && b ? Math.abs(STAGE_ORDER[a]! - STAGE_ORDER[b]!) : 1; };
export function shiftCandidates(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 1; i < ctx.runs.length; i++) {
    const prev = ctx.runs[i - 1]!, cur = ctx.runs[i]!;
    for (const r of cur.rows) {
      const key = rowKey(r);
      if (r.scope !== "all" || !ctx.headline.has(key)) continue;
      const before = stageName(ctx.row(prev, key)?.stage), after = stageName(r.stage);
      if (!before || !after || before === after) continue;
      const l = label(key), ex = ctx.showing(key);
      out.push({ id: `shift:${key}:${cur.id}`, type: "shift", kicker: `Shift · ${l.dimension}`, headline: `${l.name} moved from ${before} to ${after}`,
        deck: `${r.current_share != null ? `On ${pct(r.current_share, 1)} of tracked homepages` : "Share not measured"}${ex.length ? `, including ${listOf(ex.slice(0, 3))}` : ""}. Forecast run ${cur.id}.`,
        facts: [
          { text: `Stage ${before} in forecast run ${prev.id}, ${after} in run ${cur.id}`, href: signalPath(key), basis: basis(key), kind: "stage" },
          ...(r.current_share != null ? [{ text: `On ${pct(r.current_share, 1)} of tracked homepages`, href: signalPath(key), basis: basis(key), kind: "share" as const }] : []),
          ...(ex.length ? [brandFact(ex, ex.length, null, key)] : []),
        ],
        sector: null, signalKeys: [key], domains: ex.slice(0, 3), evidence: [{ label: "Signal page", href: signalPath(key) }, { label: "Forecast ledger", href: "/ledger" }],
        sourceIds: [`run:${prev.id}`, `run:${cur.id}`], basis: basis(key), happenedAt: cur.at, magnitude: stageDistance(before, after), runId: cur.id, stage: r.stage });
    }
  }
  return out;
}

// BREAKOUT -----------------------------------------------------------------------------------------
const ALERT_RE = /[?&]alert=(\d+)-([a-z_]+)/;
export function breakoutCandidates(ctx: Ctx, alerts: WireIn[]): Candidate[] {
  const out: Candidate[] = [];
  for (const a of alerts) {
    const m = ALERT_RE.exec(a.url); if (!m || m[2] !== "breakout" || !a.ref) continue;
    const key = canonical(a.ref); if (!ctx.headline.has(key)) continue;
    const runId = Number(m[1]), scope = /[?&]sector=([a-z-]+)/.exec(a.url)?.[1] ?? "all", run = ctx.runs.find(r => r.id === runId), r = ctx.row(run, key, scope);
    const l = label(key), ex = ctx.showing(key, scope === "all" ? null : scope);
    out.push({ id: `breakout:${key}:${scope}:${runId}`, type: "breakout", kicker: `Breakout · ${l.dimension}${scope !== "all" ? ` · ${sectorName(scope)}` : ""}`,
      headline: `${l.name}: breaking out ${where(scope)}`,
      deck: [r?.momentum != null ? `Momentum ${signed(r.momentum)} points a quarter` : null, r?.current_share != null ? `on ${pct(r.current_share, 1)} of tracked ${scope !== "all" ? `${inline(sectorName(scope))} ` : ""}homepages` : null].filter(Boolean).join(", ").replace(/^./, c => c.toUpperCase()) + `. Forecast run ${runId}.`,
      facts: [
        ...(r?.momentum != null ? [{ text: `Momentum ${signed(r.momentum)} points a quarter, in the top tenth of all fitted signals`, href: signalPath(key), basis: basis(key), kind: "share" as const }] : []),
        ...(r?.current_share != null ? [{ text: `On ${pct(r.current_share, 1)} of tracked ${scope !== "all" ? `${inline(sectorName(scope))} ` : ""}homepages`, href: signalPath(key), basis: basis(key), kind: "share" as const }] : []),
        ...(ex.length ? [brandFact(ex, ex.length, scope === "all" ? null : scope, key)] : []),
        { text: `Alert fired by forecast run ${runId}`, href: a.url.replace(/^https?:\/\/[^/]+/, ""), basis: basis(key), kind: "source" },
      ],
      sector: scope === "all" ? null : scope, signalKeys: [key], domains: ex.slice(0, 3), evidence: [{ label: "Signal page", href: signalPath(key) }],
      sourceIds: [`wire:${a.id}`, `run:${runId}`], basis: basis(key), happenedAt: a.published_at, magnitude: r?.momentum ?? 1, runId, stage: r?.stage ?? null });
  }
  return out;
}

// FIRST SEEN ---------------------------------------------------------------------------------------
const category = (k: string) => k.slice(0, Math.max(0, k.indexOf(":")));
export function firstSeenCandidates(ctx: Ctx, archive: ArchiveRow[]): Candidate[] {
  const out: Candidate[] = [], cats = new Set<string>(), all = new Set<string>(), bySector = new Map<string, { traits: Set<string>; cats: Set<string> }>();
  for (const a of archive) {
    const s = bySector.get(a.sector) ?? { traits: new Set(), cats: new Set() };
    for (const t of a.traits) { all.add(t); cats.add(category(t)); s.traits.add(t); s.cats.add(category(t)); }
    bySector.set(a.sector, s);
  }
  const keys = [...new Set(ctx.sites.flatMap(s => s.traits))].filter(k => shown(ctx, k)).sort();
  const make = (key: string, sector: string | null, domains: string[]): Candidate => {
    const l = label(key), at = ctx.sites.filter(s => domains.includes(s.domain)).map(s => s.captured ?? ctx.now).sort()[0] ?? ctx.now;
    const w = sector ? `in ${inline(sectorName(sector))}` : "in the library";
    return { id: `first:${key}:${sector ?? "all"}`, type: "first_seen", kicker: `First seen · ${l.dimension}${sector ? ` · ${sectorName(sector)}` : ""}`, headline: `First seen ${w}: ${inline(l.name)}`,
      deck: `${countWord(domains.length)} tracked brand${domains.length === 1 ? " shows" : "s show"} it now (${listOf(domains)}); no earlier archive capture ${sector ? `in ${inline(sectorName(sector))} ` : ""}had it.`,
      facts: [brandFact(domains, domains.length, sector, key), { text: `Archive captures checked: none ${sector ? `in ${inline(sectorName(sector))} ` : ""}carried it before`, href: signalPath(key), basis: basis(key), kind: "count" }],
      sector, signalKeys: [key], domains: domains.slice(0, 6), evidence: [{ label: "Signal page", href: signalPath(key) }, { label: "Pattern", href: patternPath(key) }],
      sourceIds: domains.map(d => `site:${d}`), basis: basis(key), happenedAt: at, magnitude: domains.length, firstSeen: true, stage: ctx.row(ctx.cur, key)?.stage ?? null };
  };
  const enough = (key: string, n: number) => n <= FIRST_SEEN_MAX_BRANDS && (n >= FIRST_SEEN_MIN_BRANDS || (n >= 1 && ctx.headline.has(key)));
  for (const key of keys) {
    // The archive must measure this kind of signal at all, or "first" would only mean "unmeasured".
    if (!cats.has(category(key))) continue;
    if (!all.has(key)) { const d = ctx.showing(key); if (enough(key, d.length)) out.push(make(key, null, d)); continue; }
    for (const [sector, arch] of bySector) {
      if (arch.traits.has(key) || !arch.cats.has(category(key))) continue;
      const d = ctx.showing(key, sector); if (enough(key, d.length)) out.push(make(key, sector, d));
    }
  }
  return out;
}

// CROSSOVER ----------------------------------------------------------------------------------------
export function crossoverCandidates(ctx: Ctx): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 1; i < ctx.runs.length; i++) {
    const prev = ctx.runs[i - 1]!, cur = ctx.runs[i]!, bySignal = new Map<string, SignalRow[]>();
    for (const r of cur.rows) if (r.scope !== "all" && r.status === "ok" && r.current_share != null && shown(ctx, rowKey(r))) bySignal.set(rowKey(r), [...(bySignal.get(rowKey(r)) ?? []), r]);
    for (const [key, rows] of bySignal) {
      const lead = [...rows].sort((a, b) => b.current_share! - a.current_share! || a.scope.localeCompare(b.scope))[0]!;
      if (lead.current_share! < CROSSOVER_LEAD_MIN) continue;
      for (const r of rows) {
        if (r.scope === lead.scope) continue;
        const before = ctx.row(prev, key, r.scope)?.current_share;
        if (before == null || before >= CROSSOVER_FLOOR || r.current_share! < CROSSOVER_FLOOR) continue;
        const d = ctx.showing(key, r.scope); if (!d.length) continue;
        const l = label(key), s = inline(sectorName(r.scope));
        out.push({ id: `crossover:${key}:${r.scope}:${cur.id}`, type: "crossover", kicker: `Crossover · ${l.dimension} · ${sectorName(r.scope)}`, headline: `${sectorName(r.scope)} picks up ${inline(l.name)}`,
          deck: `Led by ${inline(sectorName(lead.scope))} at ${pct(lead.current_share, 1)}, it now sits on ${pct(r.current_share, 1)} of ${s} homepages, up from ${pct(before, 1)}.`,
          facts: [
            { text: `${sectorName(lead.scope)}: ${pct(lead.current_share, 1)} of homepages (the leading sector)`, href: signalPath(key), basis: basis(key), kind: "share" },
            { text: `${sectorName(r.scope)}: ${pct(before, 1)} in run ${prev.id} → ${pct(r.current_share, 1)} in run ${cur.id}`, href: signalPath(key), basis: basis(key), kind: "share" },
            brandFact(d, d.length, r.scope, key),
          ],
          sector: r.scope, signalKeys: [key], domains: d.slice(0, 6), evidence: [{ label: "Signal page", href: signalPath(key) }], sourceIds: [`run:${prev.id}`, `run:${cur.id}`],
          basis: basis(key), happenedAt: cur.at, magnitude: (r.current_share! - CROSSOVER_FLOOR) * 100, runId: cur.id, stage: r.stage });
      }
    }
  }
  return out;
}

// COUNTER-MOVE -------------------------------------------------------------------------------------
const RISING = new Set(["Rising", "Emerging"]);
export function counterMoveCandidates(ctx: Ctx, moves: { c: Candidate; e: EventRow }[]): Candidate[] {
  const out: Candidate[] = [];
  for (const { c, e } of moves) {
    const { gained, dropped } = traitDelta(e);
    const hit = [...gained.map(k => ({ k, adopt: true })), ...dropped.map(k => ({ k, adopt: false }))].find(({ k, adopt }) => {
      if (!shown(ctx, k)) return false; const st = stageName(ctx.stageFor(k, e.sector ?? null).stage);
      return adopt ? st === "Fading" : !!st && RISING.has(st);
    });
    if (!hit) continue;
    const { stage, scope } = ctx.stageFor(hit.k, e.sector ?? null), st = stageName(stage)!, l = label(hit.k), w = scope === "all" ? "across all sectors" : `in ${inline(sectorName(scope))}`;
    out.push({ id: `counter:${e.id}:${hit.k}`, type: "counter_move", kicker: `Counter-move${e.sector ? ` · ${sectorName(e.sector)}` : ""}`,
      headline: hit.adopt ? `${e.domain} adopts ${inline(l.name)} while it fades ${w}` : `${e.domain} drops ${inline(l.name)} while it is ${st.toLowerCase()} ${w}`,
      deck: `${c.headline}${c.deck ? `: ${c.deck}` : "."}`,
      facts: [...c.facts, { text: `${l.name} is ${st} ${w}`, href: signalPath(hit.k), basis: basis(hit.k), kind: "stage" }],
      sector: e.sector ?? null, signalKeys: [hit.k], domains: [e.domain], evidence: [...c.evidence, { label: "Signal page", href: signalPath(hit.k) }],
      sourceIds: [`event:${e.id}`, `story:${c.id}`], basis: c.basis === "ai" || basis(hit.k) === "ai" ? "ai" : "measured", happenedAt: e.detected_at, magnitude: 1, members: [c.id], stage });
  }
  return out;
}

// WHITE SPACE --------------------------------------------------------------------------------------
export function whiteSpaceCandidates(ctx: Ctx): Candidate[] {
  if (!ctx.cur) return [];
  const out: Candidate[] = [], week = isoWeek(new Date(ctx.now));
  for (const [sector, list] of [...ctx.bySector].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < WHITE_SPACE_MIN_SECTOR_SITES || !ctx.covered(sector)) continue;
    const others = ctx.sites.filter(s => s.sector !== sector);
    const opts = [...ctx.headline].filter(key => !WHITE_SPACE_SKIP_CATEGORIES.has(category(key))).flatMap(key => {
      const r = ctx.row(ctx.cur, key), st = stageName(r?.stage);
      if (r?.status !== "ok" || !st || !RISING.has(st)) return [];
      const k = list.filter(s => s.traits.includes(key)).length, elsewhere = others.length ? others.filter(s => s.traits.includes(key)).length / others.length : 0;
      return k / list.length <= WHITE_SPACE_MAX_SHARE && elsewhere >= WHITE_SPACE_MIN_ELSEWHERE ? [{ key, k, elsewhere, st, momentum: r.momentum ?? 0 }] : [];
    }).sort((a, b) => b.elsewhere - a.elsewhere || b.momentum - a.momentum || a.key.localeCompare(b.key));
    const best = opts[0]; if (!best) continue;
    const l = label(best.key), s = inline(sectorName(sector)), ex = ctx.showing(best.key).filter(d => !list.some(x => x.domain === d));
    out.push({ id: `white:${sector}:${week}`, type: "white_space", kicker: `White space · ${sectorName(sector)}`,
      headline: `Almost no ${s} brand uses ${inline(l.name)}; it is ${best.st.toLowerCase()} everywhere else`,
      deck: `${countWord(best.k)} of ${list.length} tracked ${s} brands ${best.k === 1 ? "shows" : "show"} it, against ${pct(best.elsewhere, 0)} of brands in other sectors.`,
      facts: [
        { text: `${best.k} of ${list.length} tracked ${s} brands ${best.k === 1 ? "shows" : "show"} it`, href: `/patterns/${encodeURIComponent(best.key)}?sector=${sector}`, basis: basis(best.key), kind: "count" },
        { text: `${pct(best.elsewhere, 0)} of brands in other sectors show it`, href: patternPath(best.key), basis: basis(best.key), kind: "share" },
        { text: `${l.name} is ${best.st} across all sectors (forecast run ${ctx.cur.id})`, href: signalPath(best.key), basis: basis(best.key), kind: "stage" },
        ...(ex.length ? [{ text: `Using it elsewhere: ${listOf(ex.slice(0, 4), 4)}`, href: patternPath(best.key), basis: basis(best.key), kind: "brand" as const }] : []),
      ],
      sector, signalKeys: [best.key], domains: ex.slice(0, 4), evidence: [{ label: "Signal page", href: signalPath(best.key) }, { label: "Pattern", href: patternPath(best.key) }],
      sourceIds: [`run:${ctx.cur.id}`, `week:${week}`], basis: basis(best.key), happenedAt: ctx.now, magnitude: (best.elsewhere - best.k / list.length) * 100, runId: ctx.cur.id, stage: ctx.row(ctx.cur, best.key)?.stage ?? null });
  }
  return out;
}

// ROUNDUP ------------------------------------------------------------------------------------------
const THING: Record<string, string> = { type_change: "type", palette_shift: "colors", theme_flip: "theme", layout_change: "hero", message_pivot: "headline copy", redesign: "homepage", imagery_shift: "imagery", aesthetic_shift: "look" };
export function roundupCandidates(ctx: Ctx, moves: { c: Candidate; e: EventRow }[]): Candidate[] {
  const out: Candidate[] = [], used = new Set<string>(), bucket = (iso: string) => Math.floor(Date.parse(iso) / (ROUNDUP_WINDOW_DAYS * day));
  const emit = (id: string, members: { c: Candidate; e: EventRow }[], sector: string | null, what: { key: string } | { type: string }) => {
    const domains = [...new Set(members.map(m => m.e.domain))].sort(ctx.byRank); if (domains.length < ROUNDUP_MIN) return;
    for (const m of members) used.add(m.c.id);
    const s = sector ? `${inline(sectorName(sector))} ` : "", times = members.map(m => m.e.detected_at).sort(), n = countWord(domains.length);
    const key = "key" in what ? what.key : null, l = key ? label(key) : null;
    out.push({ id, type: "roundup", kicker: `Roundup${l ? ` · ${l.dimension}` : ""}${sector ? ` · ${sectorName(sector)}` : ""}`,
      headline: l ? `${n} ${s}brands moved to ${inline(l.name)}` : `${n} ${s}brands changed their ${THING["type" in what ? what.type : ""] ?? "look"}`,
      deck: `${listOf(domains, 4)}, between ${shortDate(times[0]!)} and ${shortDate(times.at(-1)!)}.`,
      facts: members.sort((a, b) => a.e.detected_at.localeCompare(b.e.detected_at)).map(m => ({ text: `${m.c.headline}${m.c.deck ? `: ${m.c.deck}` : ""}`, href: brandPath(m.e.domain), basis: m.c.basis, kind: "member" as const })),
      sector, signalKeys: key ? [key] : [], domains, evidence: key ? [{ label: "Signal page", href: signalPath(key) }, { label: "Pattern", href: patternPath(key) }] : domains.slice(0, 4).map(d => ({ label: d, href: brandPath(d) })),
      sourceIds: members.map(m => `story:${m.c.id}`), basis: members.some(m => m.c.basis === "ai") || (key && basis(key) === "ai") ? "ai" : "measured",
      happenedAt: times.at(-1)!, magnitude: domains.length, members: members.map(m => m.c.id), stage: key ? ctx.row(ctx.cur, key)?.stage ?? null : null });
  };
  const group = (keyOf: (m: { c: Candidate; e: EventRow }) => string[]) => {
    const g = new Map<string, { c: Candidate; e: EventRow }[]>();
    for (const m of moves) if (!used.has(m.c.id)) for (const k of keyOf(m)) g.set(k, [...(g.get(k) ?? []), m]);
    return [...g].sort(([a], [b]) => a.localeCompare(b));
  };
  // 1) Same signal gained in one sector. 2) Same signal gained across sectors. 3) Same kind of change in one sector.
  for (const [k, ms] of group(m => traitDelta(m.e).gained.filter(t => shown(ctx, t)).map(t => `${m.e.sector ?? "all"}|${t}|${bucket(m.e.detected_at)}`))) {
    const [sector, key, b] = k.split("|"); emit(`roundup:${sector}:${key}:${b}`, ms.filter(m => !used.has(m.c.id)), sector === "all" ? null : sector!, { key: key! });
  }
  for (const [k, ms] of group(m => traitDelta(m.e).gained.filter(t => shown(ctx, t)).map(t => `${t}|${bucket(m.e.detected_at)}`))) {
    const [key, b] = k.split("|"); if (new Set(ms.map(m => m.e.sector)).size >= 2) emit(`roundup:all:${key}:${b}`, ms, null, { key: key! });
  }
  for (const [k, ms] of group(m => (m.e.sector ? [`${m.e.sector}|${m.e.type}|${bucket(m.e.detected_at)}`] : []))) {
    const [sector, type, b] = k.split("|"); emit(`roundup:${sector}:${type}:${b}`, ms, sector!, { type: type! });
  }
  return out;
}

// NEWS + LAUNCH ------------------------------------------------------------------------------------
export type NewsMatcher = { brands: { domain: string; re: RegExp[] }[]; signals: { key: string; name: string; re: RegExp }[] };
/** Tracked brands match by domain, or by brand name (word boundary, case-insensitive) unless the name is an ordinary word; headline signals match by label. */
export function newsMatcher(sites: { domain: string; name: string | null }[], headline: Iterable<string>): NewsMatcher {
  const bound = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "iu");
  return {
    brands: sites.map(s => {
      const names = new Set([s.name, s.domain.split(".")[0]].filter((x): x is string => !!x && x.length >= NEWS_NAME_MIN && !NEWS_NAME_STOPWORDS.has(x.toLowerCase())));
      return { domain: s.domain, re: [new RegExp(`(?<![\\p{L}\\p{N}.-])${escape(s.domain)}(?![\\p{L}\\p{N}-])`, "iu"), ...[...names].map(bound)] };
    }),
    signals: [...headline].map(key => ({ key, name: label(key).name })).filter(x => x.name.length >= NEWS_SIGNAL_MIN).map(x => ({ ...x, re: bound(x.name) })),
  };
}
export function newsMatches(m: NewsMatcher, text: string) {
  return { domains: m.brands.filter(b => b.re.some(r => r.test(text))).map(b => b.domain).sort(), signals: m.signals.filter(s => s.re.test(text)).map(s => s.key).sort() };
}
/** RSS sign-off lines ("The post … appeared first on X.") name the publisher, not the story. */
export const NEWS_BOILERPLATE = /\s*The post .*? appeared first on .*$/is;
const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
export function newsCandidates(m: NewsMatcher, wire: WireIn[]): { candidates: Candidate[]; dropped: number } {
  const out: Candidate[] = []; let dropped = 0;
  for (const w of wire) {
    const title = untick(w.title), excerpt = w.source_kind === "rss" && w.excerpt ? untick(w.excerpt).replace(NEWS_BOILERPLATE, "").trim() || null : null;
    const host = hostOf(w.url), found = newsMatches(m, `${title}\n${excerpt ?? ""}`);
    // A publication naming itself is not news about that brand (designboom's feed always says "designboom").
    const hit = { domains: found.domains.filter(d => !(host === d || host.endsWith(`.${d}`) || w.source.toLowerCase().replace(/\s+/g, "") === d.split(".")[0])), signals: found.signals };
    if (!hit.domains.length && !hit.signals.length) { dropped++; continue; }
    const names = [...hit.domains, ...hit.signals.map(k => label(k).name)];
    out.push({ id: `news:${w.id}`, type: "news", kicker: `News · ${w.source}`, headline: clip(title, 160), deck: excerpt ? clip(excerpt, 180) : `Names ${listOf(names, 4)}.`,
      facts: [{ text: `Source: ${w.source}, ${shortDate(w.published_at)}`, href: w.url, basis: null, kind: "source" },
        ...hit.domains.map(d => ({ text: `Names ${d}, a tracked brand`, href: brandPath(d), basis: null, kind: "brand" as const })),
        ...hit.signals.map(k => ({ text: `Mentions ${label(k).name}, a headline signal`, href: signalPath(k), basis: basis(k) }))],
      sector: null, signalKeys: hit.signals, domains: hit.domains, evidence: [{ label: `Read at ${w.source}`, href: w.url }], sourceIds: [`wire:${w.id}`], basis: null,
      happenedAt: w.published_at, magnitude: hit.domains.length + hit.signals.length });
  }
  return { candidates: out, dropped };
}
export function launchCandidate(w: WireIn): Candidate {
  return { id: `launch:${w.id}`, type: "launch", kicker: "Launch · Product Hunt", headline: clip(untick(w.title), 160), deck: w.excerpt ? clip(untick(w.excerpt), 180) : null,
    facts: [{ text: `Product Hunt, ${shortDate(w.published_at)}`, href: w.url, basis: null, kind: "source" }], sector: null, signalKeys: [], domains: [],
    evidence: [{ label: "Product Hunt", href: w.url }], sourceIds: [`wire:${w.id}`], basis: null, happenedAt: w.published_at, magnitude: 1 };
}

/** Every candidate for one build, plus how many outside news items were dropped for naming nothing we track. */
export function allCandidates(input: BuildInput): { candidates: Candidate[]; ctx: Ctx; newsDropped: number; newsKept: number } {
  const ctx = context(input);
  const moves = input.events.filter(isVisibleMove).sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id).map(e => ({ c: moveCandidate(e), e }));
  const rebrands = input.rebrands.map(r => rebrandCandidate(r, moves));
  const inRebrand = new Set(rebrands.flatMap(r => r.members ?? []));
  const free = moves.filter(m => !inRebrand.has(m.c.id));
  const counters = counterMoveCandidates(ctx, free), inCounter = new Set(counters.flatMap(c => c.members ?? []));
  const roundups = roundupCandidates(ctx, free.filter(m => !inCounter.has(m.c.id)));
  const news = newsCandidates(newsMatcher(input.sites, ctx.headline), input.wire);
  const candidates = [
    ...moves.map(m => m.c), ...rebrands, ...shiftCandidates(ctx), ...breakoutCandidates(ctx, input.alerts), ...firstSeenCandidates(ctx, input.archive),
    ...crossoverCandidates(ctx), ...counters, ...whiteSpaceCandidates(ctx), ...roundups, ...input.launches.map(launchCandidate), ...news.candidates,
  ].map(c => ({ ...c, headline: noDollar(c.headline), deck: c.deck == null ? null : noDollar(c.deck), facts: c.facts.map(f => ({ ...f, text: noDollar(f.text) })) }));
  return { candidates, ctx, newsDropped: news.dropped, newsKept: news.candidates.length };
}
export const soWhatFor = (c: Pick<Candidate, "type" | "signalKeys" | "stage">) => STORY_TYPE_DEFS[c.type].soWhat;
