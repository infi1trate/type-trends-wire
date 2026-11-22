// N2 · THE COPY DESK (no model). One set of lints for every reader-facing line of a story or study page that is not written text:
// kickers, the Numbers list ("The changes"), picture captions, chart notes and labels. Written text (headline, deck, body and how we
// know from a writer) has its own check in stories/writer.ts. Pure: the standards checklist (item 8), the weekly sweep and
// newsroom/style.md read these definitions.
import { STAGES } from "../labels";
import { METHOD_RUN_USES, METHOD_WORDS, has } from "../stories/writer";

export type LineKind = "kicker" | "number" | "caption" | "note" | "label";
export type Lint = { id: CopyLintId; line: string; detail: string };
export type CopyLintId = "method" | "stage-case" | "date-format" | "percent-form" | "count-form" | "internal-id";

const QUOTED = /“[^”]*”|‘[^’]*’|"[^"]*"/g;
/** Our own words only: captured copy inside quotation marks is left as it was captured. */
const ours = (line: string) => line.replace(QUOTED, " ");
const STAGE_MID = new RegExp(`(?<![.!?:]\\s|^|·\\s|\\|\\s)\\b(${STAGES.join("|")})\\b`, "g");
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const MONTH_FIRST = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\b(?!\s*(?:%|of\b))/;
const SLASH_DATE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/;
const PERCENT_WORD = /\b(?:per ?cent|percent|pct)\b/i;
const PERCENT_SPACE = /\d\s+%/;
const COUNT_SLASH = /(?<![\d/.])\d{1,4}\s?\/\s?\d{1,4}(?![\d/])/;
const OUT_OF = /\b\d+\s+out of\s+\d+\b/i;
const INTERNAL = [
  { name: "a story or source id", re: /\b(?:event|story|move|quiet|census|brand|news|roundup|white|breakout|shift|first|crossover|counter|wire|asset-from|asset-to|page-from|page-to|call|added|seasonal|against):[\w.:-]*\d[\w.:-]*/ },
  { name: "a signal key", re: /\b[a-z]+(?:_[a-z]+)*:[a-z]+(?:_[a-z]+)+\b|\b[a-z]{3,}_[a-z_]{3,}\b/ },
  { name: "a row id", re: /\b(?:id|run|snapshot|event)\s*#?\s*\d{2,}\b|#\d{2,}\b/i },
] as const;

/** The copy desk's lints, in the order the sweep reports them. Each has a plain description (style.md lists these). */
export const COPY_LINTS: readonly { id: CopyLintId; title: string; rule: string; good: string; bad: string }[] = [
  { id: "method", title: "No method words or run numbers", rule: "Method words (score, threshold, deterministic) and run numbers (“forecast run 13”, “in run 15”) stay in the Data view.", good: "Lifestyle photography is rising across all sectors", bad: "Lifestyle photography is Rising across all sectors (forecast run 13)" },
  { id: "stage-case", title: "Stage words are ordinary words inside a sentence", rule: `${STAGES.join(", ")} are written in lower case unless they open a line or a label.`, good: "Image hero is on 48.7% of tracked homepages (peaking)", bad: "Image hero is on 48.7% of tracked homepages (Peaking)" },
  { id: "date-format", title: "One date format on the Read side", rule: "Day then month (“20 Nov”, “between 14 and 20 Nov”); never an ISO date, a month-first date or a slashed date.", good: "Confirmed on a second capture, 20 Nov", bad: "Confirmed 2026-11-20" },
  { id: "percent-form", title: "Percentages one way", rule: "A number and the sign together (“48.7%”); never “percent”, “per cent” or a space before the sign.", good: "49% of brands in other sectors show it", bad: "49 percent of brands in other sectors show it" },
  { id: "count-form", title: "Counts one way", rule: "“k of n” (“1 of 30 tracked dev tools brands”); never “k/n” or “k out of n”.", good: "1 of 30 tracked dev tools brands shows it", bad: "1/30 tracked dev tools brands show it" },
  { id: "internal-id", title: "No internal ids", rule: "No story, source or row ids and no signal keys (“event:4905”, “imagery:photography_lifestyle”); names only.", good: "Names Netlify, a tracked brand", bad: "Names netlify.com (event:4905)" },
];

/** Every lint one line fails (empty = it passes). */
export function lintLine(line: string, kind: LineKind = "number"): Lint[] {
  const out: Lint[] = [], free = ours(line), push = (id: CopyLintId, detail: string) => out.push({ id, line, detail });
  for (const w of METHOD_WORDS) if (has(free, w)) push("method", `method word “${w}”`);
  for (const u of METHOD_RUN_USES) if (u.re.test(free)) push("method", `“${u.name}”`);
  if (kind !== "kicker" && kind !== "label") for (const m of free.matchAll(STAGE_MID)) if (m.index! > 0) { push("stage-case", `“${m[1]}” inside a sentence`); break; }
  if (ISO_DATE.test(free)) push("date-format", "an ISO date");
  else if (MONTH_FIRST.test(free)) push("date-format", "a month-first date");
  else if (SLASH_DATE.test(free) && !COUNT_SLASH.test(free)) push("date-format", "a slashed date");
  if (PERCENT_WORD.test(free)) push("percent-form", "“percent” in words");
  if (PERCENT_SPACE.test(free)) push("percent-form", "a space before %");
  if (COUNT_SLASH.test(free) && !SLASH_DATE.test(free.replace(COUNT_SLASH, ""))) push("count-form", "a count written k/n");
  if (OUT_OF.test(free)) push("count-form", "a count written “k out of n”");
  for (const x of INTERNAL) if (x.re.test(free)) { push("internal-id", x.name); break; }
  return out;
}
/** Lints for a set of lines (each with its kind), de-duplicated by line and lint. */
export function lintLines(lines: readonly { text: string; kind: LineKind }[]): Lint[] {
  const seen = new Set<string>(), out: Lint[] = [];
  for (const l of lines) for (const x of lintLine(l.text, l.kind)) { const k = `${x.id}|${x.line}`; if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}
