// "What makes a story": the reader-facing rule list, generated from the story constants so the page and methodology can't drift. Pure.
import { MIN_RUN_GAP_DAYS, REAL_RUN_RULE } from "../run-gap";
import { DAILY_CAP, DEDUPE_DAYS, NEWS_DAILY_CAP, PUBLISH_MIN, SINGLE_BRAND_DAILY_CAP } from "./score";
import { AGAINST_MIN, GROUP_DAYS, PATTERN_DAYS, SHIFT_MIN_SHARE } from "./editor";
import { CENSUS_RULE } from "../census";
import { SITE_KIND_RULE } from "../brand-names";
import { WHITE_SPACE_NOT_APPLICABLE } from "./types";
import { label } from "../labels";
import { WRITER_PER_BUILD, WRITER_PER_DAY } from "./writer";
import { REBRAND_RULE } from "../rebrand-rule";
import { PROMO_RULE } from "../promo";
import { REVERSED_RULE } from "../reversal";
import { CAROUSEL_RULE, SHOWCASE_RULE } from "../carousel";
import { INTEGRITY_RULE } from "../integrity";
import {
  CROSSOVER_FLOOR, CROSSOVER_LEAD_MIN, FIRST_SEEN_ARCHIVE_MIN_BRANDS, FIRST_SEEN_ARCHIVE_MIN_QUARTERS, FIRST_SEEN_DIMENSIONS, FIRST_SEEN_EXCLUDED, FIRST_SEEN_MAX_BRANDS,
  FIRST_SEEN_MIN_BRANDS, ROUNDUP_MIN, ROUNDUP_WINDOW_DAYS, STORY_KINDS, STORY_TYPE_DEFS, WHITE_SPACE_MAX_SHARE, COUNTER_HELD_REASON, ESTIMATE_ONLY_REASON,
} from "./types";

const JOB_WORD = { spot: "Spot", prove: "Prove", act: "Act" } as const;
const pc = (v: number) => `${Math.round(v * 100)}%`;
export const storyTypeList = () => STORY_KINDS.map(k => { const d = STORY_TYPE_DEFS[k]; return { id: k, name: d.kicker, job: JOB_WORD[d.job], trigger: d.trigger, evidence: d.evidence }; });
export const firstSeenList = () => Object.entries(FIRST_SEEN_DIMENSIONS).map(([id, d]) => ({ id, ...d }));
export function storyRules() {
  return [
    { id: "gap", title: "Real runs, a week apart", text: `Shifts, crossovers and "Moving now" compare the latest real forecast run with the most recent real run at least ${MIN_RUN_GAP_DAYS} days older. The forecast is weekly, so closer runs are reruns of our pipeline, not a change in the world; with no such pair there are no shift or crossover stories at all. A signal missing from the earlier run is never a shift. Real run: ${REAL_RUN_RULE.replace(/^A run is real when /, "").replace(/\.$/, "")}.` },
    { id: "first", title: "First seen needs an archive that could have seen it", text: `Only for kinds of signal the archive measures from stored HTML and CSS: ${firstSeenList().map(d => d.name.toLowerCase()).join(", ")}. Never for ${FIRST_SEEN_EXCLUDED} It needs at least ${FIRST_SEEN_MIN_BRANDS} brands, library-wide or in a sector; in a sector also an archive for that sector with at least ${FIRST_SEEN_ARCHIVE_MIN_BRANDS} brands and ${FIRST_SEEN_ARCHIVE_MIN_QUARTERS} quarters where that kind of signal was measured. More than ${FIRST_SEEN_MAX_BRANDS} brands at once is not an arrival.` },
    { id: "spread", title: "Spread and openings", text: `A crossover needs a leading sector at ${pc(CROSSOVER_LEAD_MIN)} or more and a second sector passing ${pc(CROSSOVER_FLOOR)}. A white space is a headline signal Rising or Emerging overall on at most ${pc(WHITE_SPACE_MAX_SHARE)} of a covered sector's brands, one per sector per week, and never where the gap could not be filled (${notApplicableText()}). A roundup folds ${ROUNDUP_MIN} or more brands making the same move inside ${PATTERN_DAYS} days, counting only changes that are neither seasonal nor reversed (on storefront and media homepages only typeface and layout moves). A shift runs as a story only when the signal is on at least ${pc(SHIFT_MIN_SHARE)} of tracked homepages; below that it goes to the Digest's Brief table only. Stage changes of one family (AI positioning) from the same pair of runs are one story.` },
    { id: "twice", title: "A change must be seen twice on each side", text: INTEGRITY_RULE },
    { id: "tiers", title: "Tape, stories, studies", text: `Every confirmed change is a tape line: brand, what changed, from and to, date, and its label if any (Seasonal, Reversed). Each change is dated by its captures: between the last capture that showed the old value and the first that showed the new one, never the day it was confirmed. A story needs a claim: a positioning change, an identity change, a headline typeface change, a pattern, a weekly census, the weekly against-the-grain roundup or outside news. Everything else stays a tape line. A study is the weekly data story.` },
    { id: "position", title: "A new headline is a story only when it is a new position", text: "A headline change on a standard homepage is called position (what the brand says it is or does), product rotation, promotion or unclear. Rules go first (sale or seasonal wording, a product name or model number on both sides, the same words around a changed number, a headline that is only the company's name); otherwise the text model decides and gives a one-sentence reason, stored with the call. Only a position can run; unclear is held for the desk with its reason, and a model failure is unclear, never a position." },
    { id: "kinds", title: "Storefront, media, studio and carousel homepages", text: `${SITE_KIND_RULE.merchandised} ${SITE_KIND_RULE.editorial} On both, a change of typeface or layout can still be a story. ${SHOWCASE_RULE} ${CAROUSEL_RULE}` },
    { id: "identity", title: "One brand, one story", text: `An identity change is two or more of type, colour, layout and headline changing on one standard homepage within ${GROUP_DAYS} days; a change of the headline typeface family (not a weight, width or fallback) runs on any homepage. Changes to one brand inside ${GROUP_DAYS} days are one story carrying every specific; a later change in that window is appended to the story as a correction with its update time, never a second story. A single-brand story may cite one library figure for the signal the change relates to, in the brand's sector or across the library, whichever has the larger base.` },
    { id: "weekly", title: "Weekly pieces", text: `Counter-moves are held singly; once a week, when at least ${AGAINST_MIN} exist, each with a stored stage and share behind its signal, one roundup may gather them.` },
    { id: "census", title: "The census: what homepages say now", text: CENSUS_RULE },
    { id: "rebrand", title: "A rebrand has to be earned", text: REBRAND_RULE },
    { id: "seasonal", title: "Sale skins are not identity changes", text: `${PROMO_RULE} Sale skins are counted by the sale-mode census, not gathered from changes.` },
    { id: "reversed", title: "A change undone is not a move", text: REVERSED_RULE },
    { id: "news", title: "Outside news needs a subject", text: `An outside item runs only when its title names a tracked brand by name (a bare domain, link, handle or the publication naming itself does not count) or a headline signal by its label, and its title or excerpt is about design: a logo, typeface, redesign, website, campaign, packaging, interface and the like. Bluesky posts stay on the wire and never become stories. At most ${NEWS_DAILY_CAP} news stories run a day.` },
    { id: "estimate", title: "Estimates and counter-moves don't run alone", text: `A single brand's change read only by AI (aesthetic or imagery) is held: "${ESTIMATE_ONLY_REASON}". Counter-moves are held for a weekly roundup: "${COUNTER_HELD_REASON}". Both stay on the event tape and the brand page.` },
    { id: "score", title: "Score and caps", text: `Each candidate scores 0–100 from size, brand weight, novelty and sector relevance (0–25 each) and runs at ${PUBLISH_MIN} or more. The same brand or signal and type within ${DEDUPE_DAYS} days keeps the higher score. At most ${DAILY_CAP} stories run per UTC day, at most ${SINGLE_BRAND_DAILY_CAP} of them about a single brand and ${NEWS_DAILY_CAP} of them news; often fewer, and none when nothing qualifies. Everything else is held with its reason, never thrown away.` },
    { id: "why", title: "Written from the facts, checked by code", text: `Each story's headline, deck and body are written by an AI model from that story's own facts only (at most ${WRITER_PER_BUILD} writer calls a build and ${WRITER_PER_DAY} a day). Code then checks every number, quotation, brand name and date against the facts, and refuses advice, stock endings, trend-speak and "rebrand" for anything less than type, colour and layout changing together. A text that fails twice falls back once to a smaller model, then to the plain template text, so no story waits on the writer. One line under each story says how we know: measured from captures, or our read, an AI estimate.` },
    { id: "edits", title: "Editors overrule, nothing is rewritten", text: "Stored stories never change. Editors pin, kill, correct and restore by appending edits that apply when the page is read; a corrected story says so." },
  ];
}
/** The white-space map in words: sector × signal pairs a sector could not fill. */
export const notApplicableText = () => Object.entries(WHITE_SPACE_NOT_APPLICABLE).flatMap(([sector, m]) => Object.keys(m).map(k => `${label(k).name.toLowerCase()} in ${sector}`)).join(", ");
/** The STORIES methodology paragraph, from the same rules. */
export const storiesMethodology = () => `${storyTypeList().map(t => `${t.name.toUpperCase()} (${t.trigger.replace(/\.$/, "")})`).join("; ")}. ${storyRules().map(r => r.text).join(" ")}`;
