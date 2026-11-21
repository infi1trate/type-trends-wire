// THE CENSUS (E2g) — a count of what tracked homepages say right now, not of what changed. Pure: same captures in, same counts out.
//
// THE BASE. A brand counts when its newest live desktop home capture and the most recent earlier capture at least six hours older (E2h:
// steadier than "the two newest", which depended on how often the crawler ran that day) are both inside the last eight days, both read
// the headline from the page's h1, and both show the same headline (library-diff's own headline equality). Every count is
// reported with that base ("14 of 162 tracked homepages whose headline we can read").
// CENSUS A · WORDS IN HEADLINES. A short watch-list (key, matcher, display word): a member is a brand in the base whose newest headline
// matches. Members are listed with their headline quoted exactly, counted by sector, and those whose confirmed change added the word in
// the last 14 days are named with the old line, the new line and the two capture dates.
// CENSUS B · SALE MODE. A homepage is in sale mode when its h1 headline carries sale wording (E3: promo.ts saleSignal, a discount, sale,
// deal, an amount or percent off, Black Friday, Cyber Monday, save; seasonal words alone do not count) in both captures, or the
// same button label does (the first three labels, as the promotion rule reads them). Same base, except a brand whose headline is not from
// an h1 can still count through its buttons: its base is the homepages whose headline or buttons we can read in both captures.
// WHEN IT RUNS. Once a week per census, as a weekly piece (outside the daily five, never the lead on a day with a measured single-brand
// story), with at least eight members. After its first run it runs again only when the count has moved by two or more, and then says the
// earlier count ("up from 18 on 20 Nov"). Stored as a roundup row (the stored type list is a fixed check) told apart by its `census:` id.
import { equalField, isBlockedHeadline } from "./library-diff";
import { oneHeadline } from "./headline-text";
import { saleSignal } from "./promo";
import { brandName } from "./brand-names";
import { sectorName } from "./labels";
import { brandPath } from "./ia";
import { isoWeek } from "./digest/week";
import { tapeDate, tapeLine } from "./tape";
import type { EventRow } from "./agency/changes";
import type { Candidate, Fact } from "./stories/types";
import { productPair, productTypeCount, fieldText, type ProductPair, type SurfaceCapture } from "./surfaces";

export const CENSUS_DAYS = 8, CENSUS_SPAN_HOURS = 6, CENSUS_MIN = 8, CENSUS_MOVE_MIN = 2, CENSUS_ADDED_DAYS = 14, CENSUS_NAMED_MAX = 6, CENSUS_PICTURES = 4, CENSUS_BUTTONS = 3;
const H = 36e5, DAY = 864e5;

export type CensusCapture = { id: number; domain: string; at: string; source: string | null; h1: string | null; ctas: string[] };
export type CensusPair = { domain: string; newest: CensusCapture; older: CensusCapture };
/** One stored count (census_counts): what a census story ran on. */
export type CensusRow = { census_key: string; day: string; count: number; base: number; members: { domain: string; name: string; line: string }[]; story_id: string };
/** `recount` (E2h, maintenance only): count every census as a correction of the one that ran, ignoring the cadence and the earlier count. */
export type CensusInput = { captures: CensusCapture[]; /** W1b: live desktop home and product captures (measured fields) for the product-page census. */ surfaces?: SurfaceCapture[]; history: Pick<CensusRow, "census_key" | "day" | "count" | "base">[]; recount?: boolean };
/** A recount appended to census_counts keys its row `<story id>#recount:<ISO time>` (one count row per story id); this is the story it counts for. */
export const censusStoryOf = (rowStoryId: string) => rowStoryId.split("#")[0]!;
export const recountRowId = (storyId: string, at: string) => `${storyId}#recount:${at}`;
export type WatchEntry = { key: string; word: string; forms: string[]; matcher: RegExp };
/** The watch-list of words in headlines. Edit here only; a matcher is whole words, any case, never global. */
export const WATCH_LIST: readonly WatchEntry[] = [
  { key: "agents", word: "agents", forms: ["agent", "agents", "agentic"], matcher: /(?<![\p{L}\p{N}])agent(?:s|ic)?(?![\p{L}\p{N}])/iu },
];
export const SALE_KEY = "sale";
export const CENSUS_HOW = { words: "Read from each homepage's headline in our newest capture and one at least six hours older.", sale: "Read from each homepage's headline and buttons in our newest capture and one at least six hours older." } as const;
export const CENSUS_RULE = `A census counts what tracked homepages say now, not what changed. A brand counts when its newest capture and the most recent capture at least ${CENSUS_SPAN_HOURS} hours older are both inside the last ${CENSUS_DAYS} days, both read the headline from the page's h1, and both show the same headline; every count is given with that base. Words in headlines counts the homepages whose headline uses a watched word (agents, agent or agentic). Sale mode counts the homepages whose headline, or the same button, carries sale wording (a discount, sale, deal, an amount or percent off, Black Friday, Cyber Monday, save) in both captures; seasonal words alone do not count. A census runs once a week outside the daily five with at least ${CENSUS_MIN} homepages, and again only when its count has moved by ${CENSUS_MOVE_MIN} or more, saying the earlier count. It never leads on a day with a measured story about one brand.`;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim() : null);
/** A captured headline, read once (E2h: "X X" stored by a page that renders its h1 twice is "X"). */
const h1Text = (v: unknown) => { const t = str(v); return t ? oneHeadline(t) : null; };
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export const isCensusId = (id: string) => id.startsWith("census:");
export const censusKeyOf = (id: string) => (isCensusId(id) ? id.split(":")[1] ?? null : null);

// THE BASE ---------------------------------------------------------------------------------------------------------------------------
/** Each brand's newest capture and the most recent earlier capture at least six hours older, both inside the last eight days. */
export function censusPairs(captures: readonly CensusCapture[], now: string): Map<string, CensusPair> {
  const t = Date.parse(now), by = new Map<string, CensusCapture[]>();
  for (const c of captures) { const at = Date.parse(c.at); if (at <= t && at >= t - CENSUS_DAYS * DAY) by.set(c.domain, [...(by.get(c.domain) ?? []), c]); }
  const out = new Map<string, CensusPair>();
  for (const [d, xs] of by) {
    const [newest, ...rest] = [...xs].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
    const older = newest ? rest.find(c => (Date.parse(newest.at) - Date.parse(c.at)) / H >= CENSUS_SPAN_HOURS) : undefined;
    if (!newest || !older) continue;
    out.set(d, { domain: d, newest, older });
  }
  return out;
}
/** Both captures read the headline from the page's h1 and show the same headline (library-diff equality; never a banner or error page). */
export function readableHeadline(p: CensusPair): string | null {
  const a = h1Text(p.newest.h1), b = h1Text(p.older.h1);
  if (p.newest.source !== "h1" || p.older.source !== "h1" || !a || !b || isBlockedHeadline(a) || isBlockedHeadline(b)) return null;
  return equalField("headline", b, a) ? a : null;
}
/** The base: brands whose headline we can read in both newest captures, with the newest headline. */
export function headlineBase(pairs: ReadonlyMap<string, CensusPair>): Map<string, string> {
  return new Map([...pairs].flatMap(([d, p]) => { const h = readableHeadline(p); return h ? [[d, h] as const] : []; }));
}

// CENSUS A · WORDS IN HEADLINES --------------------------------------------------------------------------------------------------------
export type Member = { domain: string; line: string; via: "headline" | "button" };
export const wordMembers = (entry: WatchEntry, base: ReadonlyMap<string, string>): Member[] =>
  [...base].filter(([, h]) => entry.matcher.test(h)).map(([domain, line]) => ({ domain, line, via: "headline" as const }));
const headlineOf = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? h1Text((v as Record<string, unknown>)["headline"]) : null);
/** Members whose confirmed headline change added the word in the last 14 days (the latest such change per brand). */
export function addedWord(entry: WatchEntry, members: readonly Member[], events: readonly EventRow[], now: string, rotating: ReadonlySet<number> = new Set()): EventRow[] {
  const t = Date.parse(now), mine = new Set(members.map(m => m.domain)), out = new Map<string, EventRow>();
  for (const e of [...events].sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id)) {
    if (e.type !== "message_pivot" || !mine.has(e.domain) || rotating.has(e.id) || (e.page_type && e.page_type !== "home") || (e.viewport && e.viewport !== "desktop") || (e.source && e.source !== "live")) continue;
    const at = Date.parse(e.detected_at); if (at > t || at < t - CENSUS_ADDED_DAYS * DAY) continue;
    const b = headlineOf(e.before), a = headlineOf(e.after);
    if (a && entry.matcher.test(a) && !(b && entry.matcher.test(b))) out.set(e.domain, e);
  }
  return [...out.values()];
}

// CENSUS B · SALE MODE ---------------------------------------------------------------------------------------------------------------
const buttons = (c: CensusCapture) => c.ctas.map(str).filter((x): x is string => !!x).slice(0, CENSUS_BUTTONS);
/** The same button label in both captures that reads as a promotion (the newest capture's wording), or null. */
export function saleButton(p: CensusPair): string | null {
  const older = new Set(buttons(p.older).map(norm));
  return buttons(p.newest).find(b => older.has(norm(b)) && saleSignal(b) !== null) ?? null;
}
/** Sale mode: the base (headline readable in both, or buttons read in both) and the members (promotional h1 in both, else the same promotional button). */
export function saleCensus(pairs: ReadonlyMap<string, CensusPair>): { base: number; members: Member[] } {
  let base = 0; const members: Member[] = [];
  for (const [d, p] of pairs) {
    const h = readableHeadline(p), hasButtons = buttons(p.newest).length > 0 && buttons(p.older).length > 0;
    if (!h && !hasButtons) continue;
    base++;
    if (h && saleSignal(h) && saleSignal(h1Text(p.older.h1))) { members.push({ domain: d, line: h, via: "headline" }); continue; }
    const btn = saleButton(p); if (btn) members.push({ domain: d, line: btn, via: "button" });
  }
  return { base, members };
}

// CADENCE ----------------------------------------------------------------------------------------------------------------------------
/** Whether a census runs now: at least eight members; the first run always; then once a week at most, only when the count moved by two. */
export function censusDue(count: number, history: CensusInput["history"], key: string, now: string): { run: boolean; earlier: { count: number; day: string } | null; reason: string } {
  if (count < CENSUS_MIN) return { run: false, earlier: null, reason: `fewer than ${CENSUS_MIN} homepages` };
  const prev = history.filter(h => h.census_key === key).sort((a, b) => a.day.localeCompare(b.day)).at(-1) ?? null;
  if (!prev) return { run: true, earlier: null, reason: "first run" };
  if (isoWeek(new Date(`${prev.day}T12:00:00Z`)) === isoWeek(new Date(now))) return { run: false, earlier: null, reason: "already ran this week" };
  if (Math.abs(count - prev.count) < CENSUS_MOVE_MIN) return { run: false, earlier: null, reason: `count moved by less than ${CENSUS_MOVE_MIN}` };
  return { run: true, earlier: { count: prev.count, day: prev.day }, reason: "count moved" };
}

// TEXT -------------------------------------------------------------------------------------------------------------------------------
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** "Eighteen", "Twenty-three" (headline counts); digits from 1,000. */
export function numberWord(n: number): string {
  const w = n < 20 ? ONES[n]! : n < 100 ? `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}` : n < 1000 ? `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberWord(n % 100).toLowerCase()}` : ""}` : String(n);
  return w[0]!.toUpperCase() + w.slice(1);
}
const listAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export type CensusSite = { domain: string; name: string | null; sector: string };
/** The census story candidate (template text; the writer rewrites it on a normal build). Members in trendsetter rank order. */
export function censusCandidate(o: {
  key: string; title: string; now: string; base: number; members: Member[]; earlier: { count: number; day: string } | null;
  added?: EventRow[]; sites: ReadonlyMap<string, CensusSite>; rank: ReadonlyMap<string, number>;
}): Candidate {
  const name = (d: string) => brandName(d, o.sites.get(d)?.name ?? null);
  const members = [...o.members].sort((a, b) => (o.rank.get(a.domain) ?? 999) - (o.rank.get(b.domain) ?? 999) || name(a.domain).localeCompare(name(b.domain)));
  const n = members.length, day = o.now.slice(0, 10), entry = o.key === SALE_KEY ? null : WATCH_LIST.find(w => w.key === o.key) ?? null, word = entry?.word ?? null;
  const what = word ? "tracked homepages whose headline we can read" : "tracked homepages whose headline or buttons we can read";
  const named = members.slice(0, CENSUS_NAMED_MAX).map(m => name(m.domain)), rest = n - named.length;
  const moved = o.earlier ? `, ${n >= o.earlier.count ? "up" : "down"} from ${o.earlier.count} on ${tapeDate(`${o.earlier.day}T12:00:00Z`)}` : "";
  const headline = word ? `${numberWord(n)} tracked homepages have ‘${word}’ in the headline` : `${numberWord(n)} tracked homepages are in sale mode`;
  const forms = (entry?.forms ?? []).map(f => `‘${f}’`), or = forms.length <= 1 ? forms.join("") : `${forms.slice(0, -1).join(", ")} or ${forms.at(-1)}`;
  const verb = entry ? `use ${or} in the headline` : "show a sale in two captures at least six hours apart";
  const deck = `${n} of ${o.base} ${what} ${verb}${moved}: ${listAnd([...named, ...(rest ? [`${numberWord(rest).toLowerCase()} more`] : [])])}.`;
  const bySector = new Map<string, number>(); for (const m of members) { const s = o.sites.get(m.domain)?.sector ?? ""; bySector.set(s, (bySector.get(s) ?? 0) + 1); }
  const sectors = [...bySector].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s, k]) => `${s ? sectorName(s) : "Other"} ${k}`);
  const added = (o.added ?? []).filter(e => members.some(m => m.domain === e.domain));
  const lib = "/brands";
  const facts: Fact[] = [
    { text: `${n} of ${o.base} ${what}`, href: lib, basis: "measured", kind: "count" },
    { text: `By sector: ${sectors.join(", ")}`, href: lib, basis: "measured", kind: "count" },
    ...(o.earlier ? [{ text: `Earlier count: ${o.earlier.count} on ${tapeDate(`${o.earlier.day}T12:00:00Z`)}`, href: null, basis: "measured" as const, kind: "count" as const }] : []),
    ...members.map(m => ({ text: `${name(m.domain)} · “${m.line}”${m.via === "button" ? " (button)" : ""}`, href: brandPath(m.domain), basis: "measured" as const, kind: "line" as const })),
    ...added.map(e => ({ text: tapeLine(e, {}, o.sites.get(e.domain)?.name ?? null), href: brandPath(e.domain), basis: "measured" as const, kind: "member" as const })),
    { text: `Counted on ${tapeDate(o.now)} from each brand's newest capture and its latest capture at least ${CENSUS_SPAN_HOURS} hours older`, href: lib, basis: "measured", kind: "date" },
  ];
  return {
    id: `census:${o.key}:${isoWeek(new Date(o.now))}`, type: "roundup", kicker: `Census · ${o.title}`, headline, deck, facts, sector: null, signalKeys: [],
    domains: members.map(m => m.domain), evidence: members.slice(0, 4).map(m => ({ label: name(m.domain), href: brandPath(m.domain) })),
    sourceIds: [`census:${o.key}:${day}`, ...added.map(e => `added:${e.id}`)], basis: "measured", happenedAt: o.now, magnitude: n,
    census: { census_key: o.key, day, count: n, base: o.base, members: members.map(m => ({ domain: m.domain, name: name(m.domain), line: m.line })) },
  };
}

// CENSUS C · PRODUCT PAGE AGAINST HOMEPAGE (W1b) -------------------------------------------------------------------------------------
// For each brand in a sector, the newest crawl that captured both its homepage and its product page (same run, never a gift-card page):
// does the product page use the homepage's measured headline typeface? The base is the brands where both typefaces were measured; the
// members are those where they differ. Same cadence as every census (eight members, weekly, moves of two).
export const PRODUCT_CENSUS_SECTORS = ["commerce-dtc", "hardware"] as const;
export const productCensusKey = (sector: string) => `product-type-${sector}`;
const SECTOR_WORD: Record<string, string> = { "commerce-dtc": "commerce", hardware: "hardware" };
export function productCensus(captures: readonly SurfaceCapture[], sites: ReadonlyMap<string, CensusSite>, sector: string, now: string): { base: number; differ: ProductPair[]; pairs: ProductPair[] } {
  const t = Date.parse(now), by = new Map<string, SurfaceCapture[]>();
  for (const c of captures) { const at = Date.parse(c.captured_at); if (sites.get(c.domain)?.sector === sector && at <= t && at >= t - CENSUS_DAYS * DAY) by.set(c.domain, [...(by.get(c.domain) ?? []), c]); }
  const pairs = [...by.values()].map(xs => productPair(xs)).filter((p): p is ProductPair => !!p);
  return { ...productTypeCount(pairs), pairs };
}
export function productCensusCandidate(o: { sector: string; now: string; base: number; differ: ProductPair[]; earlier: { count: number; day: string } | null; sites: ReadonlyMap<string, CensusSite>; rank: ReadonlyMap<string, number> }): Candidate {
  const name = (d: string) => brandName(d, o.sites.get(d)?.name ?? null), word = SECTOR_WORD[o.sector] ?? sectorName(o.sector).toLowerCase(), key = productCensusKey(o.sector);
  const members = [...o.differ].sort((a, b) => (o.rank.get(a.domain) ?? 999) - (o.rank.get(b.domain) ?? 999) || name(a.domain).localeCompare(name(b.domain)));
  const n = members.length, day = o.now.slice(0, 10), named = members.slice(0, CENSUS_NAMED_MAX).map(m => name(m.domain)), rest = n - named.length;
  const moved = o.earlier ? `, ${n >= o.earlier.count ? "up" : "down"} from ${o.earlier.count} on ${tapeDate(`${o.earlier.day}T12:00:00Z`)}` : "";
  const line = (p: ProductPair) => `homepage ${fieldText(p.home, "h1")}, product page ${fieldText(p.product, "h1")}`;
  const facts: Fact[] = [
    { text: `On ${n} of ${o.base} ${word} homepages the product page uses a different headline typeface from the homepage`, href: "/brands", basis: "measured", kind: "count" },
    ...(o.earlier ? [{ text: `Earlier count: ${o.earlier.count} on ${tapeDate(`${o.earlier.day}T12:00:00Z`)}`, href: null, basis: "measured" as const, kind: "count" as const }] : []),
    ...members.map(m => ({ text: `${name(m.domain)} · ${line(m)}`, href: brandPath(m.domain), basis: "measured" as const, kind: "line" as const })),
    { text: `Compared on ${tapeDate(o.now)}: each brand's homepage and product page from the same crawl, measured headline typeface only; brands where either typeface could not be measured are left out`, href: "/brands", basis: "measured", kind: "date" },
  ];
  return {
    id: `census:${key}:${isoWeek(new Date(o.now))}`, type: "roundup", kicker: "Census · Product pages",
    headline: `${numberWord(n)} ${word} product pages change the homepage's headline typeface`,
    deck: `On ${n} of ${o.base} ${word} homepages the product page uses a different headline typeface from the homepage${moved}: ${listAnd([...named, ...(rest ? [`${numberWord(rest).toLowerCase()} more`] : [])])}.`,
    facts, sector: null, signalKeys: [], domains: members.map(m => m.domain), evidence: members.slice(0, 4).map(m => ({ label: name(m.domain), href: brandPath(m.domain) })),
    sourceIds: [`census:${key}:${day}`], basis: "measured", happenedAt: o.now, magnitude: n,
    census: { census_key: key, day, count: n, base: o.base, members: members.map(m => ({ domain: m.domain, name: name(m.domain), line: line(m) })) },
  };
}

const RECOUNT = { run: true, earlier: null, reason: "recount" } as const;
/** Every census due now, from the captures and the stored counts. `events` are confirmed live changes (with their capture dates). */
export function censusCandidates(input: { now: string; census?: CensusInput | null; events: readonly EventRow[]; rotating?: ReadonlySet<number> }, sites: ReadonlyMap<string, CensusSite>, rank: ReadonlyMap<string, number>): Candidate[] {
  if (!input.census) return [];
  const pairs = new Map([...censusPairs(input.census.captures, input.now)].filter(([d]) => sites.has(d))), base = headlineBase(pairs), out: Candidate[] = [];
  for (const entry of WATCH_LIST) {
    const members = wordMembers(entry, base), due = input.census.recount ? RECOUNT : censusDue(members.length, input.census.history, entry.key, input.now);
    if (due.run) out.push(censusCandidate({ key: entry.key, title: "Headlines", now: input.now, base: base.size, members, earlier: due.earlier, added: addedWord(entry, members, input.events, input.now, input.rotating), sites, rank }));
  }
  const sale = saleCensus(pairs), due = input.census.recount ? RECOUNT : censusDue(sale.members.length, input.census.history, SALE_KEY, input.now);
  if (due.run) out.push(censusCandidate({ key: SALE_KEY, title: "Sale mode", now: input.now, base: sale.base, members: sale.members, earlier: due.earlier, sites, rank }));
  for (const sector of PRODUCT_CENSUS_SECTORS) {
    if (!input.census.surfaces) break;
    const c = productCensus(input.census.surfaces, sites, sector, input.now), key = productCensusKey(sector), d = input.census.recount ? RECOUNT : censusDue(c.differ.length, input.census.history, key, input.now);
    if (d.run) out.push(productCensusCandidate({ sector, now: input.now, base: c.base, differ: c.differ, earlier: d.earlier, sites, rank }));
  }
  return out;
}
