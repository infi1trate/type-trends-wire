// Read-time views over stored stories with the editor's overlay applied: cards, the Live stream, the story page. Pure.
import { basis as basisOf, label, sectorName, type Basis } from "../labels";
import { brandPath, patternPath, signalPath } from "../ia";
import { STORIES_PER_PAGE, type Story } from "../stories";
import { sectorFirst } from "../sector-lens";
import { COMPONENT_LABEL, LEAD_WINDOW_HOURS, PUBLISH_MIN, lensScore, type ComponentId, type Components } from "./score";
import { STORY_KINDS, STORY_TYPE_DEFS, type EvidenceLink, type Fact, type StoryKind } from "./types";
import { foldedIds, type Shown, type StoredStory } from "./edits";
import { soWhat } from "../digest/copy";

/** The deterministic so-what: the signal's own line for signal stories, the type's line otherwise. */
export const soWhatOf = (p: { type: StoryKind; signalKeys: string[]; stage?: string | null | undefined }) => {
  const key = p.signalKeys[0];
  return ["shift", "breakout", "crossover", "white_space", "first_seen"].includes(p.type) && key ? soWhat(key, p.stage ?? null) : STORY_TYPE_DEFS[p.type].soWhat || (key ? soWhat(key, p.stage ?? null) : "");
};

export type StoryRecord = Shown<StoredStory>;
export const storyPath = (id: string) => `/stories/${encodeURIComponent(id)}`;
export const isKind = (t: string): t is StoryKind => (STORY_KINDS as readonly string[]).includes(t);

/** Live type chips: what each one shows. */
export const TYPE_FILTERS = {
  all: { label: "All", types: null },
  moves: { label: "Moves", types: ["move", "rebrand", "counter_move", "roundup"] },
  signals: { label: "Signals", types: ["shift", "breakout", "first_seen", "crossover"] },
  openings: { label: "Openings", types: ["white_space"] },
  news: { label: "News", types: ["news"] },
} as const satisfies Record<string, { label: string; types: readonly StoryKind[] | null }>;
export type TypeFilter = keyof typeof TYPE_FILTERS;
export const resolveTypeFilter = (v: unknown): TypeFilter => (typeof v === "string" && v in TYPE_FILTERS ? (v as TypeFilter) : "all");
const inFilter = (t: string, f: TypeFilter) => { const ts = TYPE_FILTERS[f].types as readonly string[] | null; return !ts || ts.includes(t); };

const asBasis = (b: string | null): Basis | null => (b === "measured" || b === "ai" ? b : null);
export function toStory(s: StoryRecord): Story {
  return { id: s.id, type: isKind(s.type) ? s.type : "news", kicker: s.kicker, headline: s.headline, ...(s.deck ? { deck: s.deck } : {}), at: s.happened_at, sector: s.sector,
    signalKeys: s.signal_keys, domains: s.domains, evidence: storyPath(s.id), basis: asBasis(s.basis), score: s.score, corrected: s.correctedAt,
    held: s.state === "held" ? s.reason : s.state === "killed" ? `killed${s.killReason ? `: ${s.killReason}` : ""}` : null };
}
/** Published, not folded into another running story, newest first. */
export function streamOf(all: StoryRecord[]): StoryRecord[] {
  const folded = foldedIds(all);
  return all.filter(s => s.state === "published" && !folded.has(s.id)).sort((a, b) => b.happened_at.localeCompare(a.happened_at) || b.score - a.score || a.id.localeCompare(b.id));
}

/** `/`: lead (a pinned story wins, else the best of the last 48 hours under the lens boost), then the stream (30 a page), launches apart. */
export function liveModel(all: StoryRecord[], o: { sector: string; page: number; type: TypeFilter; now: number }) {
  const stream = streamOf(all), ranked = stream.filter(s => s.type !== "launch");
  const pinned = ranked.filter(s => s.pinnedUntil).sort((a, b) => (b.edits.at(-1)?.at ?? "").localeCompare(a.edits.at(-1)?.at ?? ""))[0] ?? null;
  const recent = ranked.filter(s => Date.parse(s.happened_at) >= o.now - LEAD_WINDOW_HOURS * 36e5 && Date.parse(s.happened_at) <= o.now + 36e5);
  const best = [...(recent.length ? recent : ranked.slice(0, 30))].sort((a, b) => lensScore(b, o.sector) - lensScore(a, o.sector) || b.happened_at.localeCompare(a.happened_at))[0] ?? null;
  const lead = pinned ?? best;
  const rest = ranked.filter(s => s.id !== lead?.id && inFilter(s.type, o.type));
  const ordered = o.sector !== "all" ? sectorFirst(rest, o.sector, s => s.sector) : rest;
  const pages = Math.max(1, Math.ceil(ordered.length / STORIES_PER_PAGE)), page = Math.min(Math.max(0, o.page), pages - 1);
  const counts = Object.fromEntries((Object.keys(TYPE_FILTERS) as TypeFilter[]).map(f => [f, ranked.filter(s => s.id !== lead?.id && inFilter(s.type, f)).length])) as Record<TypeFilter, number>;
  const inSector = o.sector !== "all" ? ordered.filter(s => s.sector === o.sector).length : null;
  return {
    lead: lead ? toStory(lead) : null, leadPinned: !!pinned, stories: ordered.slice(page * STORIES_PER_PAGE, (page + 1) * STORIES_PER_PAGE).map(toStory),
    total: ordered.length, page, pages, type: o.type, counts, inSector,
    launches: stream.filter(s => s.type === "launch").slice(0, 6).map(toStory),
    /** Live's "Updated" stamp: when the newest published story was stored. */
    updatedAt: stream.map(s => s.created_at).sort().at(-1) ?? null,
  };
}

/** Stories naming a signal, brand or any of several keys (RELATED blocks), newest first. */
export function storiesAbout(all: StoryRecord[], o: { signal?: string | undefined; signals?: string[] | undefined; domain?: string | undefined; exclude?: string | undefined; limit?: number }): Story[] {
  const keys = new Set([...(o.signals ?? []), ...(o.signal ? [o.signal] : [])]);
  return streamOf(all).filter(s => s.id !== o.exclude && s.type !== "launch" && ((keys.size && s.signal_keys.some(k => keys.has(k))) || (o.domain && s.domains.includes(o.domain)))).slice(0, o.limit ?? 6).map(toStory);
}
/** source id ("event:12") → the published story that tells it (a move's own story, else the roundup/rebrand/counter-move holding it). */
export function storyForSource(all: StoryRecord[]): Map<string, string> {
  const out = new Map<string, string>(), stream = streamOf(all), ids = new Set(stream.map(s => s.id)), byId = new Map(all.map(s => [s.id, s]));
  const parentOf = new Map<string, string>(); for (const s of stream) for (const x of s.source_ids) if (x.startsWith("story:")) parentOf.set(x.slice(6), s.id);
  for (const s of all) for (const x of s.source_ids) {
    if (x.startsWith("story:") || out.has(x)) continue;
    const target = ids.has(s.id) ? s.id : parentOf.get(s.id) ?? null;
    if (target && byId.get(target)?.state === "published") out.set(x, target);
  }
  return out;
}

// STORY PAGE ---------------------------------------------------------------------------------------
export const STORY_BLOCKS = ["headline", "evidence", "so-what", "related"] as const;
const asFacts = (v: unknown): Fact[] => (Array.isArray(v) ? v.filter((f): f is Fact => !!f && typeof f === "object" && typeof (f as Fact).text === "string") : []);
const asLinks = (v: unknown): EvidenceLink[] => (Array.isArray(v) ? v.filter((x): x is EvidenceLink => !!x && typeof x === "object" && typeof (x as EvidenceLink).href === "string") : []);
const asComponents = (v: unknown): { id: ComponentId; label: string; value: number; why: string }[] => {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Components>;
  return (Object.keys(COMPONENT_LABEL) as ComponentId[]).map(id => ({ id, label: COMPONENT_LABEL[id], value: typeof o[id]?.value === "number" ? o[id]!.value : 0, why: typeof o[id]?.why === "string" ? o[id]!.why : "" }));
};
export function storyPage(s: StoryRecord, related: { earlier: Story[]; soWhat: string; patterns: string[] }) {
  const type = isKind(s.type) ? s.type : "news", def = STORY_TYPE_DEFS[type], facts = asFacts(s.facts);
  const before = facts.find(f => f.kind === "before")?.text.replace(/^Before: /, "") ?? null, after = facts.find(f => f.kind === "after")?.text.replace(/^After: /, "") ?? null;
  return {
    id: s.id, type, typeName: def.kicker, job: def.job, kicker: s.kicker, headline: s.headline, deck: s.deck, at: s.happened_at, sector: s.sector, sectorName: s.sector ? sectorName(s.sector) : null,
    basis: asBasis(s.basis), state: s.state, heldReason: s.state === "held" ? s.reason : null, killReason: s.killReason, correctedAt: s.correctedAt, pinnedUntil: s.pinnedUntil,
    facts: facts.filter(f => f.kind !== "before" && f.kind !== "after"), beforeAfter: before && after ? { before, after } : null,
    evidence: asLinks(s.evidence),
    brands: s.domains.map(d => ({ domain: d, href: brandPath(d) })),
    signals: s.signal_keys.map(k => ({ key: k, name: label(k).name, dimension: label(k).dimension, basis: basisOf(k), href: signalPath(k) })),
    patterns: related.patterns.map(k => ({ key: k, name: label(k).name, href: patternPath(k) })),
    soWhat: s.why_line ? { text: s.why_line, basis: "ai" as const, model: s.why_model, at: s.why_at } : { text: related.soWhat, basis: "measured" as const, model: null, at: null },
    score: s.score, threshold: PUBLISH_MIN, components: asComponents(s.components), whyRan: s.why_ran,
    earlier: related.earlier, edits: s.edits.map(e => ({ action: e.action, at: e.at, note: e.note })),
    blocks: STORY_BLOCKS,
  };
}
export type StoryPageModel = ReturnType<typeof storyPage>;
export type LiveStories = ReturnType<typeof liveModel>;

// QUEUE (desk + Terminal › Live › Today) ------------------------------------------------------------
export const QUEUE_DAYS = 7;
const dayOf = (iso: string) => iso.slice(0, 10);
export function queueModel(all: StoryRecord[], day: string | null, now: number) {
  const today = new Date(now).toISOString().slice(0, 10), since = new Date(now - QUEUE_DAYS * 864e5).toISOString().slice(0, 10);
  const days = [...new Set(all.map(s => dayOf(s.happened_at)))].filter(d => d >= since && d <= today).sort().reverse();
  const pick = day ?? null, rows = all.filter(s => (pick ? dayOf(s.happened_at) === pick : dayOf(s.happened_at) >= since)).sort((a, b) => b.happened_at.localeCompare(a.happened_at) || b.score - a.score);
  const item = (s: StoryRecord) => ({ ...toStory(s), state: s.state, reason: s.reason, whyRan: s.why_ran, components: asComponents(s.components), whyLine: s.why_line, pinnedUntil: s.pinnedUntil, killReason: s.killReason, edits: s.edits.map(e => ({ action: e.action, at: e.at, note: e.note, payload: e.payload as Record<string, string> })) });
  // Counts read the overlay: a killed story no longer counts as ran.
  const count = (d: string, st: StoryRecord["state"]) => all.filter(s => s.state === st && (st !== "published" || s.type !== "launch") && dayOf(s.happened_at) === d).length;
  return {
    day: pick, today, days: days.map(d => ({ day: d, published: count(d, "published"), held: count(d, "held"), killed: count(d, "killed") })),
    published: rows.filter(s => s.state === "published").map(item), held: rows.filter(s => s.state === "held").map(item), killed: rows.filter(s => s.state === "killed").map(item),
    edits: all.flatMap(s => s.edits.map(e => ({ story: s.id, headline: s.stored.headline, action: e.action, at: e.at, note: e.note }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
  };
}
export type QueueModel = ReturnType<typeof queueModel>;
