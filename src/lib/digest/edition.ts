// E5 · THE DIGEST AS ONE ARGUMENT A WEEK — an issue assembled from the story engine's published stories for one closed ISO week, as
// they stand when it is read. Pure: who the cover is, the five changes that mattered, the three pictures, the one chart, the numbers line,
// the corrections, the 600-word budget and the template text. No I/O, no AI; the loader (digest.server.ts) and the writer (writer.ts)
// share it, so the page, the share image, the feed and the tests read one model.
import { rankScores, isCensus, isOurRead } from "../stories/score";
import { brandName } from "../brand-names";
import { label } from "../labels";
import { words } from "../stories/writer";
import { pctText, qText } from "../data-stories/text";
import type { Crop } from "../crops";
import { DIGEST_NAME } from "../site";
import { isoWeek, issueNumber, weekMonday, weekRange, longDate } from "./week";

export const DIGEST_WORDS = 600, ROWS_MAX = 5, PICTURES_MAX = 3, QUIET_BELOW = 3, CHART_MIN_QUARTERS = 3, NAMES_MAX = 6;
export const CHANGE_WORDS = 28, CAPTION_WORDS = 25, USE_WORDS = 45;
/** The measured kinds a cover comes from first: a brand move (or counter-move), a rebrand, a census, a roundup, read from the page's code. */
export const COVER_KINDS: ReadonlySet<string> = new Set(["move", "counter_move", "rebrand", "roundup"]);
export const KEEP_READING_TAPE = "/terminal?panel=library";
/** Where a reader learns what a story must pass to run (the editor's log itself is staff-only). */
export const CORRECTIONS_HREF = "/what-we-show#ed-w-story";
/** The day issues were first rebuilt under these rules (E5): a correction the stored brief needs is dated no earlier. */
export const REBUILT_UNDER_E5 = "2026-11-21";

// INPUTS -------------------------------------------------------------------------------------------------------------------------------
export type EditionStory = {
  id: string; number: number | null; type: string; basis: string | null; score: number; happened_at: string; created_at?: string;
  kicker: string; headline: string; deck: string | null; body: string[]; domains: string[]; sector: string | null; signal_keys: string[];
  facts: { text: string; kind?: string | null }[];
};
/** A published story since retired with its change withdrawn on a second look (withdrawn.ts), with when the editor retired it. */
export type RetiredStory = { id: string; number: number | null; domains: string[]; happened_at: string; retired_at: string | null };
export type Picture = { kind: "pair"; before: Crop; after: Crop } | { kind: "one"; crop: Crop }
  /** L2 · a story with no capture of its own change (a signal story) brings the lead picture its own page shows, credits and all. */
  | { kind: "lead"; plan: import("../lead-picture").LeadPlan };
/** L2 · the lead picture kinds that are pictures of brands' pages (not words, swatches, marks or a chart). */
export const DIGEST_LEAD_KINDS = ["pair", "single", "mosaic"] as const;
/** A story's lead plan as a Digest picture, or null when it is not a picture of pages or has no item. */
export const leadAsPicture = (plan: import("../lead-picture").LeadPlan | null | undefined): Picture | null =>
  plan && (DIGEST_LEAD_KINDS as readonly string[]).includes(plan.kind) && plan.items.length > 0 ? { kind: "lead", plan } : null;
export type SeriesPoint = { q: string; s: number; n: number };
export type DigestTextRow = { week: string; facts_hash: string; headline: string; deck: string; argument: unknown; changes: unknown; chart_caption: string | null; use_text: string | null; model: string; passed: boolean; checked_at: string | null; created_at: string };
export type EditionRows = {
  week: string;
  /** Every published story the loader read (any week); the model keeps those dated into this week. */
  stories: EditionStory[];
  /** Retired stories (any week); those dated into this week feed the corrections. */
  retired: RetiredStory[];
  /** The domains the stored weekly brief for this week cites as changes (event citations), in citation order; corrections use them for
   *  No. 1 only, the terminal's brief line for every week. */
  briefDomains?: string[] | null;
  /** Story id → its kept picture (pair or one crop). */
  pictures: Record<string, Picture | null | undefined>;
  /** Signal key → its well-covered quarters (share by quarter). */
  series: Record<string, SeriesPoint[] | undefined>;
  numbers: { brands: number | null; confirmed: number; unconfirmed: number; ledger: { rate: number | null; hits: number; resolved: number } | null };
  texts: DigestTextRow[];
  /** The lead study, by its written headline (Keep reading). */
  study: { href: string; headline: string } | null;
};

// WEEK MEMBERSHIP AND THE COVER --------------------------------------------------------------------------------------------------------
/** A story belongs to the week of its own date: the change date it carries (from its captures), or for a story with no measured change,
 *  when it happened. One week per story, so no change is reported twice. Launches are not news of the week. */
export function weekStories<S extends Pick<EditionStory, "type" | "happened_at">>(week: string, stories: readonly S[]): S[] {
  const r = weekRange(week); if (!r) return [];
  // Compared as times: stored timestamps ("…T00:00:00+00:00") and ISO strings ("…T00:00:00.000Z") do not sort alike as text.
  const a = Date.parse(r.startIso), b = Date.parse(r.endIso);
  return stories.filter(s => { const t = Date.parse(s.happened_at); return s.type !== "launch" && t >= a && t < b; });
}
/** 0: a measured brand move, rebrand, census or roundup; 1: any other story not read by our AI; 2: an AI-read piece. */
export const coverTier = (s: Pick<EditionStory, "type" | "basis">) => (isOurRead(s) ? 2 : COVER_KINDS.has(s.type) && s.basis === "measured" ? 0 : 1);
type Rankable = Pick<EditionStory, "id" | "type" | "basis" | "score" | "happened_at"> & { number?: number | null };
/** The front page's order: its rank (an AI-read roundup sits under the measured stories of its day), newer first, lower number first. */
export function byRank<S extends Rankable>(stories: readonly S[]): S[] {
  const rank = rankScores([...stories]);
  return [...stories].sort((a, b) => (rank.get(b.id) ?? b.score) - (rank.get(a.id) ?? a.score) || b.happened_at.localeCompare(a.happened_at) || (a.number ?? 1e9) - (b.number ?? 1e9) || a.id.localeCompare(b.id));
}
/** The cover, chosen by code: the week's highest-ranked measured brand move, rebrand, census or roundup; else its highest-ranked other
 *  story not read by our AI; an AI-read piece only when the week has nothing measured. */
export function coverOf<S extends Rankable>(stories: readonly S[]): S | null {
  const ranked = byRank(stories);
  for (const t of [0, 1, 2]) { const s = ranked.find(x => coverTier(x) === t); if (s) return s; }
  return null;
}
/** The five changes that mattered: the cover first, then the front page's own rank. */
export function fiveRows<S extends Rankable>(stories: readonly S[]): S[] {
  const cover = coverOf(stories); if (!cover) return [];
  return [cover, ...byRank(stories).filter(s => s.id !== cover.id)].slice(0, ROWS_MAX);
}
/** "A quiet week: N confirmed changes." when the week has fewer than three stories. */
export const quietLine = (stories: number, confirmed: number) => (stories < QUIET_BELOW ? `A quiet week: ${confirmed} confirmed ${confirmed === 1 ? "change" : "changes"}.` : null);

// SUBJECTS -----------------------------------------------------------------------------------------------------------------------------
const tail = (kicker: string) => { const i = kicker.indexOf(" · "); return i > 0 ? kicker.slice(i + 3).split(" · ")[0]!.trim() : kicker.trim(); };
/** What a story is about, as the reader names it: the brand for a single-brand story; for a census its counted thing; for a roundup or a
 *  signal story the signal (or the roundup's own name); `terms` are the words a headline may use to name it. */
export function subjectOf(s: Pick<EditionStory, "id" | "type" | "kicker" | "domains" | "signal_keys">): { name: string; terms: string[] } {
  if ((s.type === "move" || s.type === "rebrand" || s.type === "counter_move") && s.domains.length === 1) { const n = brandName(s.domains[0]!); return { name: n, terms: [n] }; }
  if (isCensus(s)) {
    const key = s.id.split(":")[1] ?? "";
    return key === "sale" ? { name: "Sale mode", terms: ["sale mode", "sale"] } : { name: `‘${key}’ in headlines`, terms: [key, key.replace(/s$/, "")] };
  }
  if (s.type === "news" && s.domains.length === 1) { const n = brandName(s.domains[0]!); return { name: n, terms: [n] }; }
  const key = s.signal_keys[0];
  if (key && !s.id.startsWith("against:")) { const n = label(key).name; return { name: n, terms: [n] }; }
  const t = tail(s.kicker); return { name: t, terms: [t] };
}
const RANGE = /\bbetween \d{1,2}(?: [A-Z][a-z]{2,8})? and \d{1,2} [A-Z][a-z]{2,8}\b/;
/** When it changed, in capture dates: the story's own "between 11 and 14 Nov" when its lines carry one; null for a story with no
 *  measured change dated by captures (a signal or an opening), so no confirmation day is ever passed off as a change date. */
export function whenOf(s: Pick<EditionStory, "facts" | "deck">): string | null {
  for (const t of [...s.facts.map(f => f.text), s.deck ?? ""]) { const m = RANGE.exec(t); if (m) return m[0]; }
  return null;
}

// PICTURES AND THE CHART ---------------------------------------------------------------------------------------------------------------
/** Up to three pictures, the cover's first, then the next rows that have one; each stays with its row. */
export function pickPictures(rows: readonly Pick<EditionStory, "id">[], pictures: EditionRows["pictures"]): Map<string, Picture> {
  const out = new Map<string, Picture>();
  for (const r of rows) { const p = pictures[r.id]; if (p && out.size < PICTURES_MAX) out.set(r.id, p); }
  return out;
}
export type Chart = { key: string; name: string; storyId: string; number: number | null; series: SeriesPoint[]; first: SeriesPoint; last: SeriesPoint };
/** One chart: the cover's main signal by quarter (the first of its signals with three well-covered quarters), else the next row's; else none. */
export function pickChart(rows: readonly Pick<EditionStory, "id" | "number" | "signal_keys">[], series: EditionRows["series"]): Chart | null {
  for (const r of rows) for (const key of r.signal_keys) {
    const s = series[key];
    if (s && s.length >= CHART_MIN_QUARTERS) return { key, name: label(key).name, storyId: r.id, number: r.number, series: s, first: s[0]!, last: s.at(-1)! };
  }
  return null;
}
export const chartCaption = (c: Chart) => `${c.name}: ${pctText(c.first.s)} of tracked homepages in ${qText(c.first.q)}, ${pctText(c.last.s)} in ${qText(c.last.q)}.`;

// THE NUMBERS AND THE CORRECTIONS ------------------------------------------------------------------------------------------------------
export type NumberPart = { text: string; href: string };
export function numbersLine(n: EditionRows["numbers"]): NumberPart[] {
  const out: NumberPart[] = [];
  if (n.brands != null) out.push({ text: `${n.brands} brands tracked`, href: "/brands" });
  out.push({ text: `${n.confirmed} ${n.confirmed === 1 ? "change" : "changes"} confirmed this week`, href: KEEP_READING_TAPE });
  out.push({ text: `${n.unconfirmed} seen once and still unconfirmed`, href: `${KEEP_READING_TAPE}#seen-once` });
  if (n.ledger?.rate != null) out.push({ text: `forecast record ${Math.round(n.ledger.rate * 100)}% (${n.ledger.hits} of ${n.ledger.resolved} calls)`, href: "/ledger" });
  return out;
}
export const numbersText = (parts: NumberPart[]) => `${parts.map(p => p.text).join(" · ")}.`;
/**
 * The brands whose reported changes were withdrawn: the domains the stored brief cited as changes (No. 1 only) and the brands of the
 * week's retired stories, minus every brand with a published story in the week. In order of first mention, one name per brand.
 */
export function withdrawnBrands(o: { briefDomains?: readonly string[] | null; retired: readonly Pick<RetiredStory, "domains">[]; published: readonly Pick<EditionStory, "domains">[] }): string[] {
  const shown = new Set(o.published.flatMap(s => s.domains)), out: string[] = [];
  for (const d of [...(o.briefDomains ?? []), ...o.retired.flatMap(r => r.domains)]) if (!shown.has(d) && !out.includes(d)) out.push(d);
  return out;
}
/** The domains a stored weekly brief cites as changes (its event citations), in citation order. */
export function briefEventDomains(brief: unknown): string[] {
  if (!brief || typeof brief !== "object") return [];
  const b = brief as { sections?: { citations?: { kind?: string; id?: string }[] }[]; refs?: Record<string, { domain?: unknown } | undefined> }, out: string[] = [];
  for (const sec of b.sections ?? []) for (const c of sec.citations ?? []) {
    const d = c.kind === "event" ? b.refs?.[`event:${c.id}`]?.domain : null;
    if (typeof d === "string" && d && !out.includes(d)) out.push(d);
  }
  return out;
}
/** "a, b and c" with at most NAMES_MAX names, then "and N more". */
export function namesList(domains: readonly string[]): string {
  const names = domains.map(d => brandName(d)), shown = names.slice(0, NAMES_MAX), more = names.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length <= 1 ? shown.join("") : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}
export type Corrections = { text: string; names: string[]; date: string; href: string };
export function corrections(domains: readonly string[], rebuiltOn: string | null): Corrections | null {
  if (!domains.length || !rebuiltOn) return null;
  const date = longDate(rebuiltOn);
  return { text: `Corrections: this issue was rebuilt on ${date}. The first version reported changes at ${namesList(domains)} that are not confirmed stories.`, names: domains.map(d => brandName(d)), date, href: CORRECTIONS_HREF };
}
/** How many of a stored brief's cited changes are at withdrawn brands (the terminal's weekly brief line). */
export const withdrawnCited = (briefDomains: readonly string[], withdrawn: readonly string[]) => briefDomains.filter(d => withdrawn.includes(d)).length;
export const withdrawnBriefLine = (n: number) => `${n} ${n === 1 ? "change" : "changes"} cited here ${n === 1 ? "is not a confirmed story" : "are not confirmed stories"}. See the Digest for the corrected week.`;

// THE TEXT -----------------------------------------------------------------------------------------------------------------------------
export type DigestText = { headline: string; deck: string; argument: string[]; changes: string[]; chart_caption: string | null; use: string | null; source: "model" | "fallback"; model: string; at: string | null; stale: boolean };
/** A deck cut to `max` words at a sentence end, else a clause end (;  ,  —), else at the word limit. */
export function trimWords(text: string, max = CHANGE_WORDS): string {
  const t = text.replace(/\s+/g, " ").trim(), w = t.split(" ");
  if (words(t).length <= max) return t;
  const cut = w.slice(0, max).join(" ");
  // A sentence end first, then the strongest clause end: semicolon, colon, dash, comma (each leaving at least six words).
  for (const re of [/^(.*[.!?])(?=\s|$)/, /^(.*;)(?=\s)/, /^(.*:)(?=\s)/, /^(.*\s[—–])(?=\s)/, /^(.*,)(?=\s)/]) {
    const m = re.exec(cut); if (m && words(m[1]!).length >= 6) return `${m[1]!.replace(/\s*[;:,—–]$/, "").trim()}${/[.!?]$/.test(m[1]!) ? "" : "."}`;
  }
  return `${cut.replace(/[;:,—–.]+$/, "")}.`;
}
/** The fallback, always complete: the cover's own headline and deck, its opening paragraph, each row's deck cut to 28 words; no use. */
export function fallbackText(cover: EditionStory, rows: readonly EditionStory[], chart: Chart | null): DigestText {
  const opening = cover.body[0]?.trim() || cover.deck?.trim() || cover.headline;
  return { headline: cover.headline, deck: cover.deck?.trim() || cover.headline, argument: [opening], changes: rows.map(r => trimWords(r.deck?.trim() || r.headline)),
    chart_caption: chart ? chartCaption(chart) : null, use: null, source: "fallback", model: "template", at: null, stale: false };
}
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map(x => x.trim()) : []);
/** The newest passed version written from the current sheet; else the newest passed version at all ("Text from <date>", when it still
 *  has one sentence per row); else the fallback. */
export function chooseText(rows: readonly DigestTextRow[], hash: string, rowCount: number, fallback: DigestText): DigestText {
  const passed = rows.filter(r => r.passed && r.checked_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const fits = (r: DigestTextRow) => arr(r.changes).length === rowCount && arr(r.argument).length > 0;
  const pick = passed.find(r => r.facts_hash === hash && fits(r)) ?? passed.find(fits);
  if (!pick) return fallback;
  return { headline: pick.headline, deck: pick.deck, argument: arr(pick.argument), changes: arr(pick.changes), chart_caption: fallback.chart_caption === null ? null : pick.chart_caption?.trim() || fallback.chart_caption,
    use: pick.use_text?.trim() || null, source: "model", model: pick.model, at: pick.created_at, stale: pick.facts_hash !== hash };
}

// THE WORD BUDGET ----------------------------------------------------------------------------------------------------------------------
/** Everything a reader reads in the issue's text (headline, deck, argument, chart caption, change sentences, use, numbers, corrections). */
export function issueWords(t: Pick<DigestText, "headline" | "deck" | "argument" | "changes" | "chart_caption" | "use">, extra: { numbers: string; corrections: string | null; quiet: string | null }): number {
  return [t.headline, t.deck, ...t.argument, t.chart_caption ?? "", ...t.changes, t.use ?? "", extra.numbers, extra.corrections ?? "", extra.quiet ?? ""].reduce((a, s) => a + words(s).length, 0);
}
/** The fallback over the budget (a long opening paragraph): its argument loses whole sentences from the end until the issue fits. */
export function fitBudget(t: DigestText, extra: Parameters<typeof issueWords>[1]): DigestText {
  let out = t;
  while (issueWords(out, extra) > DIGEST_WORDS && out.argument.length) {
    const last = out.argument.at(-1)!, sentences = last.split(/(?<=[.!?])\s+/);
    const argument = sentences.length > 1 ? [...out.argument.slice(0, -1), sentences.slice(0, -1).join(" ")] : out.argument.slice(0, -1);
    out = { ...out, argument: argument.length ? argument : [] };
  }
  return out;
}

// THE ISSUE ----------------------------------------------------------------------------------------------------------------------------
export type EditionRow = { id: string; number: number | null; subject: string; kind: string; headline: string; href: string; sentence: string; when: string | null; picture: Picture | null };
export type Edition = {
  name: string; week: string; number: number; dates: { start: string; end: string; label: string };
  kicker: string; text: DigestText; words: number;
  cover: { id: string; number: number | null; subject: string; terms: string[]; why: string };
  chart: (Chart & { caption: string }) | null;
  rows: EditionRow[]; quiet: string | null;
  /** L2 · how many of the issue's rows have a picture it could carry (at most three are carried); absent on records written before L2. */
  picturesAvailable?: number;
  numbers: NumberPart[];
  corrections: Corrections | null;
  /** How many of the stored brief's cited brands have no published story in the week (the terminal's weekly brief line); 0 without a brief. */
  briefWithdrawn: number;
  keep: { label: string; href: string }[];
  next: { number: number; monday: string };
  hash: string;
  /** The model's shape (stored records from before E5 have none and are recomputed). */
  v: 5;
};
export const storyHref = (s: Pick<EditionStory, "id" | "number">) => (s.number != null ? `/stories/no/${s.number}` : `/stories/${encodeURIComponent(s.id)}`);
/** Why the code chose this cover (reported on the desk and in tests). */
export const coverWhy = (s: EditionStory) => (coverTier(s) === 0 ? "the week's highest-ranked measured brand move, rebrand, census or roundup" : coverTier(s) === 1 ? "no measured brand move, rebrand, census or roundup this week: the highest-ranked story not read by our AI" : "nothing measured this week: the highest-ranked AI-read piece");
/** The Monday the next issue appears: the day after the following week closes. */
export function nextIssue(week: string): { number: number; monday: string } {
  const mon = weekMonday(week)!, nextWeek = isoWeek(new Date(+mon + 7 * 864e5)), after = weekRange(nextWeek)!;
  return { number: (issueNumber(nextWeek) ?? 0), monday: after.endIso.slice(0, 10) };
}
export type EditionBase = Omit<Edition, "text" | "words" | "hash" | "v">;
export type EditionParts = { base: EditionBase; cover: EditionStory; rows: EditionStory[]; chart: Chart | null; fallback: DigestText; extra: { numbers: string; corrections: string | null; quiet: string | null } };
/** Everything about the issue except its text, or null when the week has no published story (that week has no issue). */
export function editionParts(r: EditionRows): EditionParts | null {
  const number = issueNumber(r.week), range = weekRange(r.week);
  if (number === null || !range) return null;
  const mine = weekStories(r.week, r.stories), rows = fiveRows(mine), cover = rows[0];
  if (!cover) return null;
  const pics = pickPictures(rows, r.pictures), chart = pickChart(rows, r.series), subject = subjectOf(cover);
  // Corrections are to what the issue reported: retirements after the week closed (the issue runs from then).
  const retired = weekStories(r.week, r.retired.map(x => ({ ...x, type: "retired" }))).filter(x => !!x.retired_at && Date.parse(x.retired_at) >= Date.parse(range.endIso));
  const withdrawn = withdrawnBrands({ briefDomains: number === 1 ? r.briefDomains ?? null : null, retired, published: mine });
  const rebuiltOn = withdrawn.length ? [...retired.map(x => x.retired_at!.slice(0, 10)), ...(number === 1 && r.briefDomains?.length ? [REBUILT_UNDER_E5] : [])].sort().at(-1) ?? null : null;
  const base: EditionBase = {
    name: DIGEST_NAME, week: r.week, number, dates: { start: range.start, end: range.end, label: range.label },
    kicker: `${DIGEST_NAME} · No. ${number} · ${range.label}`,
    cover: { id: cover.id, number: cover.number, subject: subject.name, terms: subject.terms, why: coverWhy(cover) },
    chart: chart ? { ...chart, caption: chartCaption(chart) } : null,
    rows: rows.map(s => ({ id: s.id, number: s.number, subject: subjectOf(s).name, kind: s.kicker.split(" · ")[0] ?? s.kicker, headline: s.headline, href: storyHref(s), sentence: "", when: whenOf(s), picture: pics.get(s.id) ?? null })),
    quiet: quietLine(mine.length, r.numbers.confirmed),
    picturesAvailable: rows.filter(s => !!r.pictures[s.id]).length,
    numbers: numbersLine(r.numbers),
    corrections: corrections(withdrawn, rebuiltOn),
    briefWithdrawn: r.briefDomains?.length ? withdrawnCited(r.briefDomains, withdrawnBrands({ briefDomains: r.briefDomains, retired, published: mine })) : 0,
    keep: [{ label: "Signals", href: "/signals" }, { label: "The tape", href: KEEP_READING_TAPE }, ...(r.study ? [{ label: r.study.headline, href: r.study.href }] : [])],
    next: nextIssue(r.week),
  };
  return { base, cover, rows, chart, fallback: fallbackText(cover, rows, chart), extra: { numbers: numbersText(base.numbers), corrections: base.corrections?.text ?? null, quiet: base.quiet } };
}
/** The issue with its text: the stored version that passed for this sheet (or an older passed one, dated), else the fallback, fitted. */
export function finishEdition(p: EditionParts, hash: string, texts: readonly DigestTextRow[]): Edition {
  const chosen = chooseText(texts.filter(t => t.week === p.base.week), hash, p.rows.length, p.fallback);
  const text = chosen.source === "fallback" ? fitBudget(chosen, p.extra) : chosen;
  return { ...p.base, rows: p.base.rows.map((x, i) => ({ ...x, sentence: text.changes[i] ?? "" })), text, words: issueWords(text, p.extra), hash, v: 5 };
}

// THE ARCHIVE --------------------------------------------------------------------------------------------------------------------------
export type ArchiveRow = { week: string; number: number; dates: string; headline: string; href: string };
/** "No. N · <date range> · <written headline>", newest first; weeks with no issue are not there. */
export function archiveRows(issues: readonly (Pick<Edition, "week" | "number" | "dates"> & { headline: string })[]): ArchiveRow[] {
  return [...issues].sort((a, b) => b.week.localeCompare(a.week)).map(i => ({ week: i.week, number: i.number, dates: i.dates.label, headline: i.headline, href: `/digest/${i.week}` }));
}
export const archiveLine = (a: ArchiveRow) => `No. ${a.number} · ${a.dates} · ${a.headline}`;
/** The closed weeks an archive or the latest issue can show, newest first: every week from No. 1 to the last one that has ended. */
export function closedWeeks(now: number, first: string): string[] {
  const out: string[] = [], a = weekMonday(first); if (!a) return out;
  for (let t = +a; t + 7 * 864e5 <= now; t += 7 * 864e5) out.push(isoWeek(new Date(t)));
  return out.reverse();
}
