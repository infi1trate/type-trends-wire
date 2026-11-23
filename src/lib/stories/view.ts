// Read-time views over stored stories with the editor's overlay applied: cards, the Live stream, the story page. Pure.
import { launchBox, type LaunchRow } from "../launches";
import { deLegacy } from "../brand";
import { STAGES, basis as basisOf, label, sectorName, type Basis } from "../labels";
import { brandPath, patternPath, signalPath } from "../ia";
import { brandName } from "../brand-names";
import { STORIES_PER_PAGE, type Story } from "../stories";
import { sectorFirst } from "../sector-lens";
import { COMPONENT_LABEL, LEAD_WINDOW_HOURS, lensScore, type ComponentId, type Components } from "./score";
import { STORY_KINDS, STORY_TYPE_DEFS, type EvidenceLink, type Fact, type StoryKind } from "./types";
import { foldedIds, type Shown, type StoredStory } from "./edits";
import { soWhat } from "../digest/copy";
import { noDid } from "./reader";
import { storyHowWeKnow, type Written } from "./texts";
import { leadAllowed, rankScores } from "./score";

/** The deterministic so-what: the signal's own line for signal stories, the type's line otherwise. */
export const soWhatOf = (p: { type: StoryKind; signalKeys: string[]; stage?: string | null | undefined }) => {
  const key = p.signalKeys[0];
  return ["shift", "breakout", "crossover", "white_space", "first_seen"].includes(p.type) && key ? soWhat(key, p.stage ?? null) : STORY_TYPE_DEFS[p.type].soWhat || (key ? soWhat(key, p.stage ?? null) : "");
};

import { sheetFacts, type SheetNumber } from "./sheet";
import { datedFacts } from "./as-of";
import { recolour, type ColourEvent } from "./recolour";
export type StoryRecord = Shown<StoredStory> & { written?: Written | null; template?: { headline: string; deck: string | null } };
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
  return { id: s.id, type: isKind(s.type) ? s.type : "news", kicker: noDid(s.kicker), headline: s.headline, ...(s.deck ? { deck: s.deck } : {}), at: s.happened_at, sector: s.sector,
    signalKeys: s.signal_keys, domains: s.domains, evidence: storyPath(s.id), basis: asBasis(s.basis), score: s.score, corrected: s.correctedAt, number: s.state === "published" ? s.number ?? null : null,
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
  // E2b: an AI-read roundup never ranks above a measured story of its day, and neither it nor a weekly piece leads on a day with a measured story.
  const rank = rankScores(ranked), pool = (recent.length ? recent : ranked.slice(0, 30)), allowed = pool.filter(s => leadAllowed(s, ranked));
  const best = [...(allowed.length ? allowed : pool)].sort((a, b) => lensScore({ score: rank.get(b.id) ?? b.score, sector: b.sector }, o.sector) - lensScore({ score: rank.get(a.id) ?? a.score, sector: a.sector }, o.sector) || b.happened_at.localeCompare(a.happened_at))[0] ?? null;
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
/** The changes on the Read side: the tape lines the story is built from (and its numbers), each with its receipt. The headline call, the
 *  confirmation line and other source lines are machinery: they stay in the Data view. */
export const readFacts = (facts: Fact[]) => {
  const members = facts.filter(f => f.kind === "member");
  // "Changed: accent" only summarises the change lines; with the lines themselves present it is noise.
  return [...members, ...facts.filter(f => f.kind !== "member" && f.kind !== "line" && f.kind !== "source" && f.kind !== "date" && f.kind !== "before" && f.kind !== "after" && !(members.length && !f.kind && /^Changed: /.test(f.text)))];
};
/** W1d · a story that stores no change or number lines (a single change's before and after, a quiet change) lists what it does store:
 *  its before and after lines, the page it was measured on, its capture-dated "Changed between …" line and the outside-news count.
 *  Never the headline call, an alert or a confirmation line. Empty means the section is left out, never an empty sentence. */
export const readFallback = (facts: Fact[]) => facts.filter(f => f.kind === "before" || f.kind === "after"
  || (f.kind === "date" && /^Changed between /.test(f.text))
  || (f.kind === "source" && (/^Page: /.test(f.text) || /^We found no mention /.test(f.text))));
/** The Read list: the change and number lines, else what the story does store (`readFallback`). */
export const readList = (facts: Fact[]) => { const r = readFacts(facts); return r.length ? r : readFallback(facts); };
const STAGE_RE = new RegExp(`(?<![.!?:]\\s|^)\\b(${STAGES.join("|")})\\b`, "g");
/** W1b · a fact line in Read-side wording, for the facts-built body: no forecast run numbers ("(forecast run 13)", "in run 15") and stage
 *  names as ordinary lower-case words inside a sentence ("is rising across all sectors"). Text inside quotation marks is left as captured. */
export function readWording(text: string): string {
  const shift = /^Stage (\w+) in forecast run \d+, (\w+) in run \d+\.?$/.exec(text);
  let t = shift ? `It moved from ${shift[1]!.toLowerCase()} to ${shift[2]!.toLowerCase()}` : text;
  t = t.replace(/\s*\((?:in |from )?(?:the )?(?:forecast )?runs? (?:no\.?\s*|#)?\d+\)/gi, "")
    .replace(/,?\s*(?:in|by|from) (?:the )?(?:forecast )?runs? (?:no\.?\s*|#)?\d+/gi, "")
    .replace(/\bforecast runs?\b/gi, "forecast");
  // Stage words outside quotes and not opening a sentence read in lower case.
  return t.split(/([“"‘][^”"’]*[”"’])/).map((part, i) => i % 2 ? part : part.replace(STAGE_RE, (w, _m, off: number) => off === 0 ? w : w.toLowerCase())).join("");
}
/** I3 · 0.4 · the body a story reads as before its text is written and checked: its change and number lines as sentences, in their
 *  order, at most four to a paragraph and two paragraphs. Pure; nothing here is new wording. */
export function templateBody(facts: readonly Pick<Fact, "text">[]): string[] {
  const lines = facts.map(f => readWording(f.text.trim())).filter(Boolean).map(t => /[.!?”"]$/.test(t) ? t : `${t}.`).slice(0, 8);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 4) out.push(lines.slice(i, i + 4).join(" "));
  return out;
}
/** Mark on a census line whose brand's confirmed change added the word in the last 14 days (E2h). */
export const CENSUS_NEW_MARK = "New this fortnight";
/** E2g · a census's "The lines": every member, brand name then its quoted line, linking to the brand page. E2h: the newly added members
 *  (those with a change line, linked to the same brand page) come first and are marked new; then the rest, each group in rank order. */
export function censusLines(facts: Fact[]): { name: string; line: string; href: string | null; isNew: boolean }[] {
  const added = new Set(facts.filter(f => f.kind === "member" && f.href).map(f => f.href));
  const lines = facts.filter(f => f.kind === "line").map(f => { const i = f.text.indexOf(" · "), isNew = !!f.href && added.has(f.href); return i > 0 ? { name: f.text.slice(0, i), line: f.text.slice(i + 3), href: f.href, isNew } : { name: f.text, line: "", href: f.href, isNew }; });
  return [...lines.filter(l => l.isNew), ...lines.filter(l => !l.isNew)];
}
/** Data-view lines (the desk and terminal): headline call, confirmations and other source lines. */
export const dataFacts = (facts: Fact[]) => facts.filter(f => f.kind === "source" || f.kind === "date");
/** The story page (Read side, E2b): kicker (kind · sector), headline, deck, the picture, the written body, one how-we-know line, the changes
 *  with receipts, then a way on. Score, threshold and why it ran stay in the Data view and on the desk; stored why lines are not shown. */
export function storyPage(s: StoryRecord, related: { earlier: Story[]; patterns: string[]; numbers?: SheetNumber[] | null; colourEvents?: ColourEvent[] | null; /** L2 · when the numbers were true, and one dated update line (as-of.ts) */ dating?: { asOf: string | null; update: string | null } | null }) {
  const type = isKind(s.type) ? s.type : "news", def = STORY_TYPE_DEFS[type], census = s.id.startsWith("census:");
  const stored = related.colourEvents && s.domains.length === 1 ? recolour(asFacts(s.facts), related.colourEvents) : asFacts(s.facts);
  // U2b · one list: with the run's numbers known, the list is the writer's sheet (stored lines it kept, then its numbers), so every count
  // in the text is in the list and no second count for the same signal and scope is.
  const facts = related.numbers && !census ? sheetFacts(stored, related.numbers, s.sector) : stored;
  const before = facts.find(f => f.kind === "before")?.text.replace(/^Before: /, "") ?? null, after = facts.find(f => f.kind === "after")?.text.replace(/^After: /, "") ?? null;
  const sector = s.sector ? sectorName(s.sector) : null;
  return {
    id: s.id, number: s.state === "published" || s.state === "killed" ? s.number ?? null : null, type, typeName: census ? "Census" : def.kicker, kicker: type === "news" || census ? noDid(s.kicker) : [def.kicker, sector].filter(Boolean).join(" · "), headline: deLegacy(s.headline), deck: deLegacy(s.deck), at: s.happened_at, sector: s.sector, sectorName: sector,
    basis: asBasis(s.basis), state: s.state, heldReason: s.state === "held" ? s.reason : null, heldByDesk: s.state === "held" && !!(s as { heldAt?: string | null }).heldAt, killReason: s.killReason, correctedAt: s.correctedAt, pinnedUntil: s.pinnedUntil, corrections: s.correctionNotes ?? [],
    // I3 · 0.4: without checked written text the page reads its facts as the body (never an empty section).
    body: s.written?.body?.length ? s.written.body.map(p => deLegacy(p)) : templateBody(census ? [] : readFacts(facts).map(f => ({ text: noDid(deLegacy(f.text)) }))), howWeKnow: noDid(storyHowWeKnow(s)),
    // E2g: a census shows "The changes" only for members whose confirmed change added the word; its count lines live in the deck and
    // under "The lines".
    // N2 · copy desk: the Numbers list reads in Read-side wording (no run numbers, stage words in lower case mid-sentence).
    facts: datedFacts((census ? facts.filter(f => f.kind === "member") : readList(facts)).map(f => ({ ...f, text: readWording(noDid(deLegacy(f.text))) })), census ? null : related.dating?.asOf ?? null), beforeAfter: before && after ? { before, after } : null,
    numbersUpdate: census ? null : related.dating?.update ?? null,
    census: census ? { lines: censusLines(facts), sectors: facts.find(f => f.kind === "count" && /^By sector: /.test(f.text))?.text.replace(/^By sector: /, "") ?? null } : null,
    // A story that is not a rebrand never says "rebrand", even in a stored receipt label.
    evidence: asLinks(s.evidence).map(e => ({ ...e, label: type !== "rebrand" && e.label === "Rebrand desk" ? "Identity changes" : e.label === "Library record" ? "Brand data" : noDid(deLegacy(e.label)) })),
    brands: s.domains.map(d => ({ domain: d, name: brandName(d), href: brandPath(d) })),
    signals: s.signal_keys.map(k => ({ key: k, name: label(k).name, dimension: label(k).dimension, basis: basisOf(k), href: signalPath(k) })),
    patterns: related.patterns.map(k => ({ key: k, name: label(k).name, href: patternPath(k) })),
    earlier: related.earlier, edits: s.edits.map(e => ({ action: e.action, at: e.at, note: e.note })),
    blocks: STORY_BLOCKS,
  };
}
/** "Next": the next story of the same UTC day by rank, else the newest earlier story (published, not folded). */
export function nextStory(all: StoryRecord[], id: string): Story | null {
  const stream = streamOf(all).filter(s => s.type !== "launch"), me = stream.find(s => s.id === id) ?? all.find(s => s.id === id);
  if (!me) return null;
  const day = me.happened_at.slice(0, 10), rank = rankScores(stream);
  const sameDay = stream.filter(s => s.happened_at.slice(0, 10) === day).sort((a, b) => (rank.get(b.id) ?? b.score) - (rank.get(a.id) ?? a.score) || b.happened_at.localeCompare(a.happened_at) || a.id.localeCompare(b.id));
  const i = sameDay.findIndex(s => s.id === id);
  const next = i >= 0 ? sameDay[i + 1] : undefined;
  const earlier = stream.filter(s => s.id !== id && s.happened_at < me.happened_at && !sameDay.slice(0, Math.max(0, i + 1)).some(x => x.id === s.id)).sort((a, b) => b.happened_at.localeCompare(a.happened_at))[0];
  const pick = next ?? earlier;
  return pick ? toStory(pick) : null;
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
  const item = (s: StoryRecord) => ({ ...toStory(s), kicker: s.kicker, state: s.state, reason: s.reason, whyRan: s.why_ran, components: asComponents(s.components), whyLine: s.why_line,
    template: s.template ?? { headline: s.headline, deck: s.deck }, written: s.written ? { model: s.written.model, version: s.written.version, at: s.written.at } : null, dataLines: dataFacts(asFacts(s.facts)).map(f => f.text), pinnedUntil: s.pinnedUntil, killReason: s.killReason, edits: s.edits.map(e => ({ action: e.action, at: e.at, note: e.note, payload: e.payload as Record<string, string> })) });
  // Counts read the overlay: a killed story no longer counts as ran.
  const count = (d: string, st: StoryRecord["state"]) => all.filter(s => s.state === st && (st !== "published" || s.type !== "launch") && dayOf(s.happened_at) === d).length;
  return {
    day: pick, today, days: days.map(d => ({ day: d, published: count(d, "published"), held: count(d, "held"), killed: count(d, "killed") })),
    published: rows.filter(s => s.state === "published").map(item), held: rows.filter(s => s.state === "held").map(item), killed: rows.filter(s => s.state === "killed").map(item),
    edits: all.flatMap(s => s.edits.map(e => ({ story: s.id, headline: s.stored.headline, action: e.action, at: e.at, note: e.note }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
    /** PH1 · the Terminal's LAUNCHES group: the same rows as Today's New on the scene box (published only, at most three). */
    launches: launchBox(all, now),
  };
}
export type QueueModel = ReturnType<typeof queueModel>;
/** P2 · the terminal's story list as it first shows (the last seven days' published stories, newest first): only the fields a row
 *  draws, a few kilobytes from the same stored index, so the server sends the list at its final height inside the Today panel and the
 *  full queue (every held and taken-down story, ~470 KB) still loads after hydration. */
export type QueueHeadRow = Pick<QueueModel["published"][number], "id" | "evidence" | "score" | "number" | "type" | "headline" | "state" | "reason" | "killReason" | "at">;
export function queueHead(m: QueueModel): { published: QueueHeadRow[]; held: number; launches: LaunchRow[] } {
  // PH1 · launches are not rows among the stories and are not counted; they come apart, as the LAUNCHES group.
  return { launches: m.launches, held: m.held.filter(s => s.type !== "launch").length, published: m.published.filter(s => s.type !== "launch").map(s => ({ id: s.id, evidence: s.evidence, ...(s.score !== undefined ? { score: s.score } : {}), ...(s.number !== undefined ? { number: s.number } : {}), type: s.type, headline: s.headline, state: s.state, reason: s.reason, killReason: s.killReason, at: s.at })) };
}
