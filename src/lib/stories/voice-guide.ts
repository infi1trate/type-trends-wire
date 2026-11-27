// V2 · Voice guide 2 (owner, 25 Nov 2026), the checks that are code. Pure. The story, study and Digest checks share it; the guide's
// words live in newsroom/style.md and its lists there are written from these constants (docs.ts), so the two cannot drift.

/** Constructions the desks may not use (style.md "What the check refuses" · Voice guide 2), outside quotations. */
export const VOICE_REFUSALS: readonly { name: string; re: RegExp }[] = [
  { name: "tracked homepages", re: /(?<![\p{L}])tracked(?:\s+[\p{L}-]+){0,3}?\s+homepages?(?![\p{L}])/iu },
  { name: "appeared on N of M as the opening clause", re: /^\s*[\p{L} ,'-]{0,40}?\bappeared on \d[\d,]* of \d/iu },
  { name: "in the latest quarter as the opening clause", re: /^\s*in the latest quarter\b/iu },
  { name: "moved or shifted for a change", re: /(?<![\p{L}])(?:moved|shifted|shifts|shifting)(?![\p{L}])/iu },
  { name: "a quarter label in prose", re: /(?<![\p{L}\p{N}])Q[1-4]\s+(?:19|20)\d\d(?![\p{N}])/u },
];
/** Applied to each sentence: the count and the percentage of one thing together, and a sentence that is only a count. */
export const SENTENCE_REFUSALS: readonly { name: string; test: (s: string) => boolean }[] = [
  { name: "the count and the percentage in one sentence", test: s => /\b\d[\d,]*\s+of\s+(?:the\s+)?\d[\d,]*\b/i.test(s) && /\d(?:\.\d+)?\s?%/.test(s) },
  { name: "a sentence that is only a count", test: s => /^\s*(?:\d[\d,.]*|[A-Z][a-z]+)\s+of\s+(?:the\s+)?\d[\d,]*(?:\s+[\p{L}-]+){0,2}\s*[.!?]?\s*$/u.test(s) },
];
/** "(AI estimate)" in a headline. */
export const HEADLINE_AI_ESTIMATE = /\(\s*AI estimate\s*\)/i;
/** Words aimed at a named brand that a light touch may never use. */
export const AT_A_BRAND = ["embarrassing", "embarrassed", "lazy", "copying", "copied", "copycat", "desperate", "cringe", "cringeworthy", "lame", "sad", "pathetic", "tired", "boring", "ugly", "dated"] as const;

// OUR READ ------------------------------------------------------------------------------------------------------------------------
export const OUR_READ = "Our read:";
/** Stories under this many words get no "Our read:" line. */
export const OUR_READ_MIN_WORDS = 60;
export const OUR_READ_MAX = { story: 1, study: 3, digest: 3 } as const;
export const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+(?=[“"A-Z0-9])|\n+/).map(s => s.trim()).filter(Boolean);
const PERSON = /\b(?:Mr|Ms|Mrs|Dr)\.?\s+[A-Z]|\b(?:CEO|founder|co-founder|designer|chief|president|director)\b/;
const MONTH = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b|\b(?:19|20)\d\d\b/;
const NUMBER_WORD = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|half|third|quarter)\b/i;
/** The "Our read:" sentences of a text. */
export const ourReadSentences = (text: string) => sentencesOf(text).filter(s => s.startsWith(OUR_READ));
/** The text without its "Our read:" sentences: what the intent, cause and hedge checks read. */
export const withoutOurRead = (text: string) => text.split("\n").map(p => sentencesOf(p).filter(s => !s.startsWith(OUR_READ)).join(" ")).join("\n");
/**
 * The "Our read:" rules: at most `max`; none under 60 words; each the last sentence before the how-we-know line (the last sentence of
 * the body); never with a number, a date, a quotation or a named person (`names`: people the sheet names).
 */
export function ourReadFailures(body: readonly string[], o: { max: number; words: number; names?: readonly string[]; lastOnly?: boolean }): string[] {
  const fail: string[] = [], all = body.join("\n"), reads = ourReadSentences(all);
  if (!reads.length) return fail;
  if (reads.length > o.max) fail.push(`${reads.length} “Our read:” lines (at most ${o.max})`);
  if (o.words < OUR_READ_MIN_WORDS) fail.push("an “Our read:” line in a piece under 60 words");
  if (o.lastOnly !== false) { const last = sentencesOf(body.at(-1) ?? "").at(-1) ?? ""; if (reads.length === 1 && !last.startsWith(OUR_READ)) fail.push("“Our read:” is not the last sentence before How we know"); }
  for (const r of reads) {
    const s = r.slice(OUR_READ.length);
    if (/\d/.test(s) || NUMBER_WORD.test(s)) fail.push("“Our read:” with a number");
    if (MONTH.test(s)) fail.push("“Our read:” with a date");
    if (/[“”"]/.test(s)) fail.push("“Our read:” with a quotation");
    if (PERSON.test(s) || (o.names ?? []).some(n => n && s.includes(n))) fail.push("“Our read:” names a person");
  }
  return [...new Set(fail)];
}

// WIT -----------------------------------------------------------------------------------------------------------------------------
/** A word aimed at a named brand in the same sentence. */
export function atBrandFailures(text: string, brands: readonly string[]): string[] {
  const out: string[] = [];
  for (const s of sentencesOf(text)) {
    if (!brands.some(b => b && s.includes(b))) continue;
    for (const w of AT_A_BRAND) if (new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, "iu").test(s)) out.push(`a jab at a named brand: ${w}`);
  }
  return [...new Set(out)];
}

// SHAPE ---------------------------------------------------------------------------------------------------------------------------
/** Numbers written in a paragraph (figures; a count "33 of 299" is one). Dates are not counted. */
export const numbersInOpening = (para: string) => [...para.replace(/\b\d{1,2}\s+(?:and\s+\d{1,2}\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/g, " ").replace(/\b(?:19|20)\d\d\b/g, " ").replace(/\b(\d[\d,]*)\s+of\s+(?:the\s+)?\d[\d,]*\b/g, "$1").matchAll(/\d[\d,]*(?:\.\d+)?/g)].length;
export const OPENING_NUMBERS_MAX = 2;
/** Rule 1: the first sentence is on something seen, not a count: it does not open on a figure, carries no count ("33 of 299") or share, and does not open on "most homepages". */
export const opensOnSeen = (para: string) => { const first = sentencesOf(para)[0] ?? ""; return !!first && !/^\W*(?:\d|[A-Z][a-z]+ of \d)/.test(first) && !/\d[\d,]*\s+of\s+(?:the\s+)?\d|\d\s?%/.test(first) && !/^(?:most|many|more|fewer|several|some)\s+(?:of\s+)?(?:the\s+)?(?:tracked\s+)?homepages\b/i.test(first); };

/** Every voice failure in a written text (outside quotations; the caller strips quotes). `kind` picks the "Our read:" allowance. */
export function voiceFailures(t: { headline: string; deck: string; body?: readonly string[] | null; how_we_know?: string | null }, o: { kind: keyof typeof OUR_READ_MAX; brands: readonly string[]; names?: readonly string[]; unquote: (s: string) => string; requireShape?: boolean }): string[] {
  const fail: string[] = [], body = t.body ?? [];
  const parts = [t.headline, t.deck, ...body].map(o.unquote), free = parts.join("\n");
  for (const r of VOICE_REFUSALS) {
    if (r.name.includes("opening clause")) { if (parts.slice(1).some(p => r.re.test(p))) fail.push(`voice: ${r.name}`); }
    else if (r.re.test(free)) fail.push(`voice: ${r.name}`);
  }
  for (const p of parts) for (const s of sentencesOf(p)) for (const r of SENTENCE_REFUSALS) if (r.test(s)) fail.push(`voice: ${r.name}`);
  if (HEADLINE_AI_ESTIMATE.test(t.headline)) fail.push("voice: (AI estimate) in a headline");
  fail.push(...atBrandFailures(free, o.brands).map(x => `voice: ${x}`));
  const words = body.join(" ").split(/\s+/).filter(Boolean).length;
  fail.push(...ourReadFailures(body.map(o.unquote), { max: OUR_READ_MAX[o.kind], words, ...(o.names ? { names: o.names } : {}), lastOnly: o.kind === "story" }).map(x => `voice: ${x}`));
  if (o.requireShape && body[0]) {
    if (!opensOnSeen(o.unquote(body[0]))) fail.push("voice: the opening sentence is a count, not something seen");
    const n = numbersInOpening(o.unquote(body[0])); if (n > OPENING_NUMBERS_MAX) fail.push(`voice: ${n} numbers in the opening paragraph (at most 2)`);
  }
  return [...new Set(fail)];
}

// CONTINUITY (rule 9) -------------------------------------------------------------------------------------------------------------
export const CONTINUITY_DAYS = 90;
export type PriorStory = { id: string; number: number | null; headline: string; at: string; signal_keys: readonly string[]; domains: readonly string[]; state: string };
/**
 * The continuity ledger for one story: the published, numbered stories in the last 90 days that covered one of its signals or brands,
 * newest first, as sheet lines the writer may refer back to once ("the same shift as No. 93"). Built from the stories table at write time.
 */
export function continuityLines(s: { id: string; signal_keys: readonly string[]; domains: readonly string[] }, prior: readonly PriorStory[], now: number, name: (domain: string) => string): string[] {
  const since = now - CONTINUITY_DAYS * 864e5, keys = new Set(s.signal_keys), doms = new Set(s.domains);
  return prior.filter(p => p.id !== s.id && p.state === "published" && p.number != null && Date.parse(p.at) >= since && Date.parse(p.at) <= now)
    .map(p => ({ p, sig: p.signal_keys.filter(k => keys.has(k)), dom: p.domains.filter(d => doms.has(d)) }))
    .filter(x => x.sig.length || x.dom.length)
    .sort((a, b) => b.p.at.localeCompare(a.p.at)).slice(0, 3)
    .map(x => `Earlier story No. ${x.p.number}, “${x.p.headline}”, covered ${x.dom.length ? x.dom.map(name).join(" and ") : "the same signal"}; refer back to it once if it fits ("the same shift as No. ${x.p.number}").`);
}

// V3 · A REWRITE KEEPS ITS FACTS ------------------------------------------------------------------------------------------------
const NUM = /\d[\d,]*(?:\.\d+)?/g;
const DAYMON = /\b(\d{1,2})(?:\s+and\s+(\d{1,2}))?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/g;
const textAll = (t: { headline: string; deck: string; body?: readonly string[] | null; how_we_know?: string | null }) => [t.headline, t.deck, ...(t.body ?? []), t.how_we_know ?? ""].join("\n");
const datesOf = (s: string) => new Set([...s.matchAll(DAYMON)].flatMap(m => [m[1]!, ...(m[2] ? [m[2]] : [])].map(d => `${Number(d)} ${m[3]}`)));
const numsOf = (s: string) => new Set([...s.replace(DAYMON, " ").replace(/\bNo\.\s*\d+/g, " ").matchAll(NUM)].map(m => m[0].replace(/,/g, "")));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
/** Every day-and-month a fact sheet carries, written ("22 November") or ISO ("2026-11-22"), as "22 Nov". Pure. */
export function factDates(facts: unknown): Set<string> {
  if (facts == null) return new Set();
  const t = typeof facts === "string" ? facts : JSON.stringify(facts), ISO = /\b\d{4}-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?/g, out = datesOf(t.replace(ISO, " "));
  for (const m of t.matchAll(/\b\d{4}-(\d{2})-(\d{2})/g)) { const mo = MON[Number(m[1]) - 1]; if (mo) out.add(`${Number(m[2])} ${mo}`); }
  return out;
}
/**
 * A rewrite may say fewer things, never different ones: every number and date it writes was in the previous text (a story reference
 * "No. 93" is not a fact of this story), and it names exactly
 * the brands the previous text named (of `brands`, the story's and the library's names). Pure; `standards` refuses on any failure and
 * the story keeps its text.
 */
export function rewriteFactFailures(prev: Parameters<typeof textAll>[0], next: Parameters<typeof textAll>[0], brands: readonly string[], facts?: unknown): string[] {
  const a = textAll(prev), b = textAll(next), out: string[] = [];
  const pn = numsOf(a), pd = datesOf(a);
  // Writer pass · a date on the story's own fact sheet may be added (the old text may simply not have said it); numbers and brands stay strict.
  for (const d of factDates(facts)) pd.add(d);
  for (const n of numsOf(b)) if (!pn.has(n)) out.push(`rewrite changes a number: ${n}`);
  for (const d of datesOf(b)) if (!pd.has(d)) out.push(`rewrite changes a date: ${d}`);
  const named = (t: string) => new Set(brands.filter(x => x && new RegExp(`(?<![\\p{L}\\p{N}])${x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(t)));
  const before = named(a), after = named(b);
  for (const x of after) if (!before.has(x)) out.push(`rewrite adds a brand: ${x}`);
  for (const x of before) if (!after.has(x)) out.push(`rewrite drops a brand: ${x}`);
  return [...new Set(out)];
}
