// N1 · the parts of newsroom/style.md and newsroom/beats.md that come from the code, so the memory cannot drift from what the checks
// enforce. `bun scripts/newsroom-docs.ts` writes them; style.test.ts fails when a file and the code disagree. Pure.
import { ADVICE, BODY_MAX_PARAS, BODY_MAX_WORDS, BODY_MIN_PARAS, BODY_MIN_WORDS, HEADLINE_MAX_WORDS, HEADLINE_MIN_WORDS, INTENT_CLAIMS, METHOD_RUN_USES, METHOD_WORDS, STOCK_ENDINGS, TREND_SPEAK, WRITER_PER_DAY } from "../stories/writer";
import { BANNED_PHRASES, SUPERLATIVES } from "../stories/why";
import { CAUSAL, RANKING_WORDS, RANK_BOTTOM, RANK_TOP, STUDY_BANNED, STUDY_PER_DAY } from "../data-stories/writer";
import { DIGEST_BANNED, DIGEST_PER_DAY, FUTURE } from "../digest/writer";
import { DIGEST_WORDS, PICTURES_MAX, ROWS_MAX } from "../digest/edition";
import { DATA_STORIES, SERIES } from "../data-stories/registry";
import { CENSUS_DAYS, CENSUS_MIN, CENSUS_NAMED_MAX, CENSUS_SPAN_HOURS, PRODUCT_CENSUS_SECTORS, SALE_KEY, WATCH_LIST } from "../census";
import { HOME_FOLLOW_DAYS, QUIET_NEEDS, QUIET_WINDOW_DAYS } from "../stories/quiet";
import { ROUNDUP_MIN, ROUNDUP_WINDOW_DAYS, WHITE_SPACE_MAX_SHARE, WHITE_SPACE_MIN_ELSEWHERE, WHITE_SPACE_MIN_SECTOR_SITES, FIRST_SEEN_MIN_BRANDS, FIRST_SEEN_MAX_BRANDS, NEWS_NAME_MIN } from "../stories/types";
import { AI_ROUNDUP_DAILY_CAP, DAILY_CAP, DEDUPE_DAYS, NEWS_DAILY_CAP, PUBLISH_MIN, SINGLE_BRAND_DAILY_CAP } from "../stories/score";
import { AGAINST_MIN, SEASONAL_STORY_MIN } from "../stories/editor";
import { COPY_LINTS } from "./copy";
import { CHECKLIST, NAME_ALLOW } from "./standards";
import { DESK_CAPS, DESK_LIMITS } from "./caps";
import { REGISTER } from "./register";
import { COPY_RUN_MAX, LINE_MAX, NEWS_MAX_CANDIDATES, NEWS_MIN_NEW, NEWS_PICKS_PER_DAY, NEWS_WINDOW_HOURS, PITCH_WINDOW_DAYS, WIRE_BLOCK_HOURS } from "./news";
import { ALTERNATES_MAX } from "./graphics";
import { BUDGET_GROWTH, BUDGET_RULES, PROPOSALS_PER_WEEK, REVIEW_PAGES, REVIEW_WIDTHS, REVIEW_KINDS, MEASURE_IDS } from "./design-review";
import { GATE_CHECKS, NO_WORSE, VISIBLE_LIMITS } from "./build-gate";
import { EXPECTS, NEXT, QUEUE_KINDS, QUEUE_STATUSES, SHIPS_ALONE_KINDS } from "./queue";
import { CALL_FAIL_SHARE, CHECK_FAIL_SHARE, HISTORY_MAX_MS, LATE_FACTOR, SLOW_FACTOR, SLOW_FLOOR_MS } from "./engineering";
import { BACKTEST_DAYS, COVERAGE_DAYS, DETECTOR_SAMPLE, FINDING_KINDS, PROPOSAL_MAX_SIGNALS, PROPOSAL_MAX_STUDIES, SECTOR_MIN } from "./datadesk";

export const LISTS_START = "<!-- lists:start (written by scripts/newsroom-docs.ts from the code; do not edit by hand) -->";
export const LISTS_END = "<!-- lists:end -->";
const q = (xs: readonly string[]) => xs.map(x => `“${x}”`).join(", ");
/** Every word and phrase list the shared check enforces, with the check that refuses it. */
export const STYLE_LISTS: readonly { title: string; source: string; check: string; items: readonly string[] }[] = [
  { title: "Advice", source: "ADVICE (stories/writer.ts)", check: "banned phrase", items: ADVICE },
  { title: "Stock endings", source: "STOCK_ENDINGS (stories/writer.ts)", check: "banned phrase", items: STOCK_ENDINGS },
  { title: "Trend-speak", source: "TREND_SPEAK (stories/writer.ts)", check: "banned phrase", items: TREND_SPEAK },
  { title: "Superlatives", source: "SUPERLATIVES (stories/why.ts, used by the shared check in stories/writer.ts)", check: "banned word", items: SUPERLATIVES },
  { title: "Hedging and filler", source: "BANNED_PHRASES (stories/why.ts, used by the shared check in stories/writer.ts)", check: "banned word", items: BANNED_PHRASES },
  { title: "Method words", source: "METHOD_WORDS (stories/writer.ts)", check: "method word", items: METHOD_WORDS },
  { title: "Method uses of “run”", source: "METHOD_RUN_USES (stories/writer.ts)", check: "method word", items: METHOD_RUN_USES.map(u => u.name) },
  { title: "Claims about intent", source: "INTENT_CLAIMS (stories/writer.ts)", check: "claim about intent", items: INTENT_CLAIMS.map(u => u.name) },
  { title: "Ranking words (studies and the Digest: only when the sheet carries the ranking)", source: "RANKING_WORDS (data-stories/writer.ts)", check: "a superlative the sheet does not carry", items: RANKING_WORDS },
  { title: "Ranked-list words (studies: allowed about the top or bottom entry of a ranked list on the sheet)", source: "RANK_TOP, RANK_BOTTOM (data-stories/writer.ts)", check: "a superlative the sheet does not carry", items: [...RANK_TOP, ...RANK_BOTTOM] },
  { title: "Causal words (studies and the Digest: only when the sheet links the two)", source: "CAUSAL (data-stories/writer.ts)", check: "a causal claim", items: CAUSAL },
  { title: "Study phrases", source: "STUDY_BANNED (data-stories/writer.ts)", check: "banned phrase", items: STUDY_BANNED },
  { title: "Digest phrases", source: "DIGEST_BANNED (digest/writer.ts)", check: "banned phrase", items: DIGEST_BANNED },
  { title: "Predictions (the Digest: only with a forecast call on the sheet)", source: "FUTURE (digest/writer.ts)", check: "a claim about the future without a forecast call", items: FUTURE },
];
/** Also refused by the shared check: arrows (our labels as prose), hex codes, and “rebrand” unless the facts show one. */
export function styleListsBlock(): string {
  return [LISTS_START, "",
    ...STYLE_LISTS.flatMap(l => [`### ${l.title}`, "", `Refused as “${l.check}”. Source: \`${l.source}\`.`, "", q(l.items), ""]),
    "### Also refused by the shared check", "",
    "An arrow (→ or ->) in our own words; a hex code in the text; “rebrand” as a claim unless the facts show type, colour and layout changing together, or a new name or logo.", "",
    "### The copy desk (lines that are not written text)", "",
    "Kickers, the Numbers list, picture captions and credits, chart titles and notes, and labels are linted by the copy desk (`COPY_LINTS`, newsroom/copy.ts). A failing line fails the standards checklist; the weekly sweep records failing lines in the desk log under `copy desk` and fixes nothing.", "",
    ...COPY_LINTS.flatMap(l => [`- **${l.title}.** ${l.rule} Good: “${l.good}”. Not: “${l.bad}”.`]), "",
    `### Lengths`, "",
    `Story headline ${HEADLINE_MIN_WORDS}–${HEADLINE_MAX_WORDS} words; body ${BODY_MIN_PARAS}–${BODY_MAX_PARAS} paragraphs, ${BODY_MIN_WORDS}–${BODY_MAX_WORDS} words. The Digest stays under ${DIGEST_WORDS} words.`, "",
    LISTS_END].join("\n");
}
/** The block between the markers in a style file, or null. */
export function listsBlockOf(md: string): string | null {
  const a = md.indexOf(LISTS_START), b = md.indexOf(LISTS_END);
  return a < 0 || b < a ? null : md.slice(a, b + LISTS_END.length);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** newsroom/beats.md, whole: the standing questions and series, each with its trigger and minimums from the code's constants. */
export function beatsDoc(): string {
  const studies = (s: string) => DATA_STORIES.filter(d => d.series === s).map(d => `  - Study No. ${d.number}, “${d.question}” (${d.status}${d.reason ? `: ${d.reason.split(":")[0]}` : ""})`);
  return [
    "# Beats", "",
    "The standing questions slug answers, and the series a reader learns to expect. Every trigger and minimum below is read from the code (`src/lib/newsroom/docs.ts` writes this file; a test fails when it drifts). Edit the constants, not this file.", "",
    "## Every day: the story engine", "",
    `- **Daily limits.** At most ${DAILY_CAP} stories a day, ${SINGLE_BRAND_DAILY_CAP} of them about a single brand, ${NEWS_DAILY_CAP} outside-news stories and ${AI_ROUNDUP_DAILY_CAP} AI-read roundup; the weekly pieces run outside the five. A story needs a score of ${PUBLISH_MIN}; the same brand and type do not run twice within ${DEDUPE_DAYS} days.`,
    `- **The writers.** Story writer ${WRITER_PER_DAY} calls a day, study writer ${STUDY_PER_DAY}, Digest writer ${DIGEST_PER_DAY}. Every text passes the shared check or the facts-built text is shown.`,
    `- **Moves and rebrands.** A measured change on a homepage, confirmed by two captures either side. “Rebrand” needs type, colour and layout together, or a new name or logo.`,
    `- **Roundups.** At least ${ROUNDUP_MIN} brands making the same change within ${ROUNDUP_WINDOW_DAYS} days.`,
    `- **Against the grain.** At least ${AGAINST_MIN} brands moving against their sector, in the weekly roundup; seasonal promotions need ${SEASONAL_STORY_MIN} brands to be a story.`,
    `- **First seen.** A signal first seen in a sector on ${FIRST_SEEN_MIN_BRANDS} to ${FIRST_SEEN_MAX_BRANDS} brands.`,
    `- **White space.** A signal on at most ${pct(WHITE_SPACE_MAX_SHARE)} of a sector's homepages while at least ${pct(WHITE_SPACE_MIN_ELSEWHERE)} elsewhere, in a sector with at least ${WHITE_SPACE_MIN_SECTOR_SITES} measured homepages.`,
    `- **Breakouts.** A forecast alert that a signal reached the Breakout stage (stage words in \`labels.ts\`, alert rules in \`alerts.ts\`).`,
    `- **Outside news.** An item from the wire's publications that names a tracked brand (names of at least ${NEWS_NAME_MIN} letters, strict matching) and is about design; the story says what the item says, about that brand.`,
    `- **Quiet change.** Needs ${QUIET_NEEDS.what}, with no mention in the wire's publications within ${QUIET_WINDOW_DAYS} days either side. Never alone: ${QUIET_NEEDS.notAlone}. It needs a picture to lead with: ${QUIET_NEEDS.picture}. A page that follows a confirmed homepage change of the same kind within ${HOME_FOLLOW_DAYS} days is not quiet: it becomes a fact on the brand's own story.`, "",
    "## The desks: what runs", "",
    `A story the engine would run waits for review. Standards checks it, then the editor in chief places it; only then does it publish (its state is “reviewed”). Standards runs again on a published story when an edit changes its facts. Daily model-call caps: standards ${DESK_CAPS.standards}, editor in chief ${DESK_CAPS["editor in chief"]} (UTC day, counted in the spend ledger). When a desk's call fails or its cap is used, the story takes the engine's path and its state says so.`, "",
    "The standards checklist (code, no model); a failed item holds the story with the item as the reason:", "",
    ...CHECKLIST.map((c, i) => `${i + 1}. ${c.title}.`), "",
    `Brands whose homepage title does not carry their name and are known to be the right website: ${Object.values(NAME_ALLOW).map(a => a.name).join(", ")}.`, "",
    "The second reader (one model call) reads what a reader will see with the facts sheet and each brand's title and sector, and lists problems; any blocker holds the story with the model's own sentence. The editor in chief (one call per build, only with a decision to make) picks the lead and order and may hold; it never kills, changes text, exceeds the caps or runs a held story. A story it held two days running is not offered again unless its facts change.", "",
    ...desksBlock(), "",
    "## The census", "",
    `A census counts what homepages say now: a brand counts when its newest capture and one at least ${CENSUS_SPAN_HOURS} hours older are both inside the last ${CENSUS_DAYS} days. It runs with at least ${CENSUS_MIN} members and names at most ${CENSUS_NAMED_MAX}.`, "",
    ...WATCH_LIST.map(w => `- **Words in headlines: ${w.word}** (${w.forms.join(", ")}).`),
    `- **Sale wording** (\`${SALE_KEY}\`): headlines and buttons in sale mode.`,
    `- **Product pages** (${PRODUCT_CENSUS_SECTORS.join(", ")}): does the product page match the homepage (headline typeface and accent from the same crawl).`, "",
    "## Studies", "",
    ...SERIES.flatMap(s => [`- **${s.title}** (\`${s.id}\`): ${s.description}`, ...studies(s.id)]), "",
    "## The Digest", "",
    `One argument a week, under ${DIGEST_WORDS} words, from published stories only: ${PICTURES_MAX} pictures, one chart and the ${ROWS_MAX} changes that mattered. The week is a closed ISO week.`, "",
  ].join("\n");
}

export const DESKS_START = "<!-- desks:start (written by scripts/newsroom-docs.ts from the code; do not edit by hand) -->";
export const DESKS_END = "<!-- desks:end -->";
/** N3 · the order of work, every desk's daily model-call limit, and the news, graphics and data desks' jobs, from the constants. */
export function desksBlock(): string[] {
  const n3 = REGISTER.filter(a => a.since === "N3");
  return [
    "## The order of work", "",
    "candidate → drafted → checked → picture checked (graphics) → standards (the checklist, then the second reader) → editor in chief → published. When a desk's call fails or its limit is used, the pipeline carries on by rule and the story's state history says so.", "",
    "## Daily model-call limits (UTC day; fixture calls are not counted)", "",
    ...DESK_LIMITS.map(l => `- **${l.desk}**, ${l.what}: ${l.cap} a day.`), "",
    "## The news desk", "",
    `Picks at most ${NEWS_PICKS_PER_DAY} links a day from the wire's publications (outlet items only, published in the last ${NEWS_WINDOW_HOURS} hours, never picked before, one per story keeping the earliest; at most ${NEWS_MAX_CANDIDATES} shown to the model, and only when at least ${NEWS_MIN_NEW} are new since its last call). Each line is checked in code: at most ${LINE_MAX} characters, one sentence, no number or proper name the item's title or excerpt does not carry, never more than ${COPY_RUN_MAX} words in a row taken from them, and the copy desk's and writers' word lists. The brand tag comes from the strict name matcher, never the model. A pick tagged with a brand that has a measured change within ${PITCH_WINDOW_DAYS} days either side files a pitch for the editor in chief. Readers see the picks of the last ${WIRE_BLOCK_HOURS} hours as THE WIRE on the front page, after THE TAPE.`, "",
    "## The graphics desk", "",
    `Checks each story's picture before standards: the rule's choice and up to ${ALTERNATES_MAX} ranked alternates that pass the quality gate. Only a stored crop that passes the gate can be chosen; a before-and-after pair may become its after-crop alone, never mixed across dates; the caption is rebuilt by rule and no text changes. “No picture shows it” fails checklist item 3 for a type that needs a picture. For study figures it chooses a form only where more than one chart-kit form fits the data, and checks every published story, study and Digest share image daily (code).`, "",
    "## The data desk", "",
    `Daily checks (code) record findings of these kinds: ${FINDING_KINDS.join(", ")}. The detector sample re-derives ${DETECTOR_SAMPLE} measured events a day under today's rules; coverage flags active brands with no good capture for ${COVERAGE_DAYS} days and sectors under ${SECTOR_MIN} measured homepages. An open finding on a brand and measure a story cites holds it (checklist item 9). Weekly, after the forecast, it scores the forecast made ${BACKTEST_DAYS} days earlier against what the measurements show, then makes one call that files at most ${PROPOSAL_MAX_STUDIES} study pitches and ${PROPOSAL_MAX_SIGNALS} signal ideas; code drops any that name a measure the product does not hold.`, "",
    "## Door actions added in N3", "",
    ...n3.map(a => `- **\`${a.id}\`** (${a.level}): ${a.what}`), "",
    ...productLoopBlock(),
  ];
}
/** N4 · the product loop: page reviews, the design review and engineering desks, the build queue and the gate, from the constants. */
export function productLoopBlock(): string[] {
  const n4 = REGISTER.filter(a => a.since === "N4");
  const lim = (k: keyof typeof VISIBLE_LIMITS) => { const l = VISIBLE_LIMITS[k]; return !l ? "no pixel limit, but the owner's accepted proposal" : `at most ${pct(l.share)} of pixels changed and height within ${l.heightPx != null ? `${l.heightPx} px` : pct(l.heightShare!)}`; };
  return [
    "## Page reviews", "",
    `A review run measures ${REVIEW_PAGES.length} pages (${REVIEW_PAGES.map(p => `${p.name.toLowerCase()} \`${p.id}\``).join(", ")}) at ${REVIEW_WIDTHS.join(", ")} px. An outside browser job sends one \`review\` call per page and width with its measures (${MEASURE_IDS.map(m => `\`${m}\``).join(", ")}) and an optional small WebP picture (the crops' rule; kept under its own folder, never shown to readers). A run's kind is ${REVIEW_KINDS.join(", ")}; a test run is shown as a test and never counts toward budgets, breaches or the gate. A missing measure is not measured, never zero.`, "",
    `Budgets per page and width: ${BUDGET_RULES.map(r => `${r.measure.replace(/_/g, " ")} (${r.basis}${r.limit != null ? `: ${r.limit}` : ""})`).join("; ")}. The first-run budgets are the first complete weekly run plus ${pct(BUDGET_GROWTH)}, so nothing breaches on day one; until a first weekly run exists there are none.`, "",
    "## The design review desk", "",
    `Weekly, after a complete weekly run (all ${REVIEW_PAGES.length} pages at ${REVIEW_WIDTHS.length} widths), once per run. Breaches first, in code: overflow, contrast, tap targets, errors and speed become bug items on the queue; height, words, links and image weight become proposals. Then one vision call per page (limit ${DESK_LIMITS.find(l => l.desk === "design review")?.cap ?? 0} a day) sees the page's three pictures, its measures with last week's and the register of design settings with their ranges, and returns at most two observations about density, hierarchy and access, each with one move. Code keeps a setting move only when it names a register setting and a value inside its range; anything else is a layout move that needs the owner; a move that touches the name, the wordmark, the brand direction, the type families, the navigation or a page's structure is dropped. At most ${PROPOSALS_PER_WEEK} proposals a week, the ones tied to a breach first, each filed with \`propose\` and a queue item linked to it. Nothing live changes. Setting moves the owner accepts wait for the next monthly design edition.`, "",
    "## The engineering desk", "",
    `Daily, code only, no model: files or declines bug items by stable key for a scheduled job whose newest run failed, that has not run within ${LATE_FACTOR} times its usual interval, or whose newest run took more than ${SLOW_FACTOR} times its 14-day median (and over ${SLOW_FLOOR_MS / 1000} s); a crawl or the wire older than the health staleness rules; a page over its speed target in the newest review run; more than ${pct(CALL_FAIL_SHARE)} of a desk's or the writers' model calls failing over 24 hours; a writer's texts failing the shared check more than ${pct(CHECK_FAIL_SHARE)} of the time over 24 hours; the history refresh taking over ${HISTORY_MAX_MS / 1000} s. Job facts are names, run times, durations and success only. An item whose problem is gone is declined “no longer found”; nothing is deleted.`, "",
    "## The build queue", "",
    `One list for every product change. Kinds: ${QUEUE_KINDS.join(", ")}. What readers should see: ${EXPECTS.join(", ")}. Statuses: ${QUEUE_STATUSES.join(", ")}. The order: ${Object.entries(NEXT).filter(([, v]) => v.length).map(([k, v]) => `${k} → ${v.join(" or ")}`).join("; ")}; built → gate passed or gate failed only through \`gate_result\`; declined at any open point with a reason. Briefed and live for anything but ${SHIPS_ALONE_KINDS.join(" and ")} need the owner's accepted proposal; live needs the newest gate result to be a pass.`, "",
    "## The gate", "",
    ...GATE_CHECKS.map((c, i) => `${i + 1}. ${c.name}.`), "",
    `Visible change: no visible change allows ${lim("no visible change")}; small allows ${lim("small")}; layout has ${lim("layout")}. Not above the before run: ${NO_WORSE.map(m => m.replace(/_/g, " ")).join(", ")}. A design move also passes the living-design gate (its checks except the edition's move count).`, "",
    "## Door actions added in N4", "",
    ...n4.map(a => `- **\`${a.id}\`** (${a.level}): ${a.what}`),
  ];
}
/** The block between the desks markers in README.md, or null. */
export function desksBlockOf(md: string): string | null {
  const a = md.indexOf(DESKS_START), b = md.indexOf(DESKS_END);
  return a < 0 || b < a ? null : md.slice(a, b + DESKS_END.length);
}
export const desksReadmeBlock = () => [DESKS_START, "", ...desksBlock().map(l => l.replace(/^## /, "### ")), "", DESKS_END].join("\n");
