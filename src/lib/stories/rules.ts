// "What makes a story": the reader-facing rule list, generated from the story constants so the page and methodology can't drift. Pure.
import { MIN_RUN_GAP_DAYS, REAL_RUN_RULE } from "../run-gap";
import { DAILY_CAP, DEDUPE_DAYS, NEWS_DAILY_CAP, PUBLISH_MIN } from "./score";
import { WHY_LINE_MAX, WHY_PER_BUILD, WHY_PER_DAY } from "./why";
import {
  CROSSOVER_FLOOR, CROSSOVER_LEAD_MIN, FIRST_SEEN_ARCHIVE_MIN_BRANDS, FIRST_SEEN_ARCHIVE_MIN_QUARTERS, FIRST_SEEN_DIMENSIONS, FIRST_SEEN_EXCLUDED, FIRST_SEEN_MAX_BRANDS,
  FIRST_SEEN_MIN_BRANDS, ROUNDUP_MIN, ROUNDUP_WINDOW_DAYS, STORY_KINDS, STORY_TYPE_DEFS, WHITE_SPACE_MAX_SHARE,
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
    { id: "score", title: "Score and caps", text: `Each candidate scores 0–100 from size, brand weight, novelty and sector relevance (0–25 each) and runs at ${PUBLISH_MIN} or more. The same brand or signal and type within ${DEDUPE_DAYS} days keeps the higher score. At most ${DAILY_CAP} stories run per UTC day, ${NEWS_DAILY_CAP} of them news. Everything else is held with its reason, never thrown away.` },
    { id: "why", title: "Facts first, one AI line", text: `Headline, deck and facts are templated from data. One optional line says what to do or watch next: written by AI at build time (at most ${WHY_PER_BUILD} a build and ${WHY_PER_DAY} a day, ${WHY_LINE_MAX} characters), checked for new numbers, unknown names and hedging, and labelled AI ESTIMATE; otherwise the fixed so-what shows.` },
    { id: "edits", title: "Editors overrule, nothing is rewritten", text: "Stored stories never change. Editors pin, kill, correct and restore by appending edits that apply when the page is read; a corrected story says so." },
  ];
}
/** The STORIES methodology paragraph, from the same rules. */
export const storiesMethodology = () => `${storyTypeList().map(t => `${t.name.toUpperCase()} (${t.trigger.replace(/\.$/, "")})`).join("; ")}. ${storyRules().map(r => r.text).join(" ")}`;
