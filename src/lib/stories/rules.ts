// "What makes a story": the reader-facing rule list, generated from the story constants so the page and methodology can't drift. Pure.
import { MIN_RUN_GAP_DAYS, REAL_RUN_RULE } from "../run-gap";
import { DAILY_CAP, DEDUPE_DAYS, NEWS_DAILY_CAP, PUBLISH_MIN } from "./score";
import { WHY_LINE_MAX, WHY_PER_BUILD, WHY_PER_DAY } from "./why";
import { REBRAND_RULE } from "../rebrand-rule";
import { PROMO_RULE } from "../promo";
import { REVERSED_RULE } from "../reversal";
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
    { id: "first", title: "First seen needs an archive that could have seen it", text: `Only for kinds of signal the archive measures from stored HTML and CSS: ${firstSeenList().map(d => d.name.toLowerCase()).join(", ")}. Never for ${FIRST_SEEN_EXCLUDED} Library-wide it needs ${FIRST_SEEN_MIN_BRANDS} brands (or 1 on a headline signal); in a sector always ${FIRST_SEEN_MIN_BRANDS}, plus an archive for that sector with at least ${FIRST_SEEN_ARCHIVE_MIN_BRANDS} brands and ${FIRST_SEEN_ARCHIVE_MIN_QUARTERS} quarters where that kind of signal was measured. More than ${FIRST_SEEN_MAX_BRANDS} brands at once is not an arrival.` },
    { id: "spread", title: "Spread and openings", text: `A crossover needs a leading sector at ${pc(CROSSOVER_LEAD_MIN)} or more and a second sector passing ${pc(CROSSOVER_FLOOR)}. A white space is a headline signal Rising or Emerging overall on at most ${pc(WHITE_SPACE_MAX_SHARE)} of a covered sector's brands, one per sector per week. A roundup folds ${ROUNDUP_MIN} or more same-kind moves inside ${ROUNDUP_WINDOW_DAYS} days.` },
    { id: "rebrand", title: "A rebrand has to be earned", text: REBRAND_RULE },
    { id: "seasonal", title: "Sale skins are not identity changes", text: PROMO_RULE },
    { id: "reversed", title: "A change undone is not a move", text: REVERSED_RULE },
    { id: "news", title: "Outside news needs a subject", text: `An outside item runs only when its title names a tracked brand by name (a bare domain, link, handle or the publication naming itself does not count) or a headline signal by its label, and its title or excerpt is about design: a logo, typeface, redesign, website, campaign, packaging, interface and the like. Bluesky posts stay on the wire and never become stories. At most ${NEWS_DAILY_CAP} news stories run a day.` },
    { id: "estimate", title: "Estimates and counter-moves don't run alone", text: `A single brand's change read only by AI (aesthetic or imagery) is held: "${ESTIMATE_ONLY_REASON}". Counter-moves are held for a weekly roundup: "${COUNTER_HELD_REASON}". Both stay on the event tape and the brand page.` },
    { id: "score", title: "Score and caps", text: `Each candidate scores 0–100 from size, brand weight, novelty and sector relevance (0–25 each) and runs at ${PUBLISH_MIN} or more. The same brand or signal and type within ${DEDUPE_DAYS} days keeps the higher score. At most ${DAILY_CAP} stories run per UTC day, ${NEWS_DAILY_CAP} of them news. Everything else is held with its reason, never thrown away.` },
    { id: "why", title: "Facts first, one AI line", text: `Headline, deck and facts are templated from data. One optional line says what to do or watch next: written by AI at build time (at most ${WHY_PER_BUILD} a build and ${WHY_PER_DAY} a day, ${WHY_LINE_MAX} characters), checked for new numbers, unknown names and hedging, and labelled AI ESTIMATE. Story pages show it only when it says something about the story itself; generic advice (audit, compare, evaluate your own site) and the fixed so-what stay on the editor's desk and in the terminal.` },
    { id: "edits", title: "Editors overrule, nothing is rewritten", text: "Stored stories never change. Editors pin, kill, correct and restore by appending edits that apply when the page is read; a corrected story says so." },
  ];
}
/** The STORIES methodology paragraph, from the same rules. */
export const storiesMethodology = () => `${storyTypeList().map(t => `${t.name.toUpperCase()} (${t.trigger.replace(/\.$/, "")})`).join("; ")}. ${storyRules().map(r => r.text).join(" ")}`;
