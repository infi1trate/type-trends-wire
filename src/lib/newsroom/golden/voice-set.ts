// V2 · the voice set (Voice guide 2's twelve worked examples, owner 25 Nov 2026): each "now" text against its rewrite. Pure. A writer
// change is scored on it with the shape scores (opens on something seen; numbers in the opening ≤ 2) and the word list; the gate
// fails a change whose texts score worse than the rewrites here.
import { numbersInOpening, opensOnSeen, OPENING_NUMBERS_MAX, SENTENCE_REFUSALS, VOICE_REFUSALS, sentencesOf } from "../../stories/voice-guide";

export type VoicePair = { id: string; what: string; now: string | null; rewrite: string };
export const VOICE_SET: readonly VoicePair[] = [
  { id: "v1", what: "Lead, No. 93", now: "More homepages animate their entrances. Entry animations appeared on 33 of 299 tracked homepages in the latest quarter, including Vercel, Letterboxd and Netlify.", rewrite: "Homepages have started making an entrance. Open Vercel, Letterboxd or Netlify and the page does not just load, it arrives: text slides up, pictures ease in. At the start of 2024 none of the homepages slug reads did this. Now 33 of 299 do." },
  { id: "v2", what: "No. 94", now: "Fintech homepages are using immersive 3D. Immersive 3D appeared on 5 of 30 tracked fintech homepages in the latest quarter, compared with 28 of 299 tracked homepages overall.", rewrite: "Fintech has discovered the third dimension. A bank's homepage is not where you expect to find something you can spin. Yet five of the 30 fintech homepages slug reads now open on a 3D scene, about one in six. Across the whole library it is fewer than one in ten." },
  { id: "v3", what: "No. 95", now: null, rewrite: "Fintech is animating faster than everyone else. Adyen, Mercury and Monzo now ease their homepages in instead of simply showing them. Five of 30 fintech homepages do, against 33 of 299 overall: the same shift as No. 93, moving quickest here. Our read: when the product is trust, a page that moves with care is part of the pitch." },
  { id: "v4", what: "No. 89", now: null, rewrite: "Sixteen homepages are now talking to your agents. A homepage headline used to be written for the person reading it. On 16 of them it is now also written for the software acting on that person's behalf: “agent”, “agents” or “agentic” sits in the biggest type on the page. Slack, Linear and Coinbase are among them. Counted on the 162 homepages whose headline slug can read." },
  { id: "v5", what: "No. 90", now: null, rewrite: "The sale has reached the buttons. It is that week. On 20 November eleven homepages were in full sale voice, and not only in the headline: the sale had made it onto the buttons too. Equinox, Brooklinen and Casper were among them." },
  { id: "v6", what: "No. 88", now: null, rewrite: "Coinbase's homepage is now for you and your agents. Coinbase's biggest line used to be a head count: “Trusted by millions worldwide.” Sometime between 11 and 14 November it became “The trusted financial account for you and your agents.” The millions are gone and the agents have arrived. The video behind the headline went too, swapped for a still." },
  { id: "v7", what: "No. 45", now: null, rewrite: "Developers, apparently, do not need to see people. Just over half the homepages outside the sector show somebody living their best life. Among developer tools, exactly one of 30 does. Everyone else shows you the terminal and trusts you to imagine the person." },
  { id: "v8", what: "Change-list line (Netlify)", now: "Netlify · headline font, Figtree to Systemia; body font, Instrument Sans to Systemia (about page)", rewrite: "Netlify's about page now speaks in one typeface, Systemia, where it used to use two: Figtree for headlines and Instrument Sans for text." },
  { id: "v9", what: "Change-list line (Rhode)", now: "Rhode · button corners, pill to 9–24 px (product page)", rewrite: "Rhode squared off its buttons a little. The pill on its product page is now a rounded rectangle." },
  { id: "v10", what: "Study No. 2 opening", now: null, rewrite: "Who went big first? We cannot say, and that is the interesting part. By the time the archive opens, 44 brands were already shouting. Webflow, Netlify and Parsley Health are the first ones we catch in the act. What the record does show is how far it spread: big type nearly doubled its share of homepages in five years, even while early adopters such as Mother and Wolff Olins went back to speaking at a normal volume." },
  { id: "v11", what: "Study No. 8", now: null, rewrite: "Your home screen is mostly white, blue and black. Look at the top 100 free apps in any App Store category and no single colour owns it. But the same three keep winning. White takes seven of 18 categories. Blue takes five, Travel, Business and Finance among them. Black takes the ones you open at night: Music, Entertainment and Social Networking." },
  { id: "v12", what: "Quiet day on Today", now: "Quiet: no new story in the last 24 hours. Below is the rest of this week, then the same week from the archive, each with the date it happened.", rewrite: "Nothing new today. The brands are behaving. Here is the rest of the week, and what was happening this same week in years past." },
];
/** The opening paragraph a text is scored on: its first two sentences after the headline-like first sentence (the examples put the
 *  headline first), or the whole text when it is short. */
const opening = (t: string) => { const s = sentencesOf(t); return s.length > 2 ? s.slice(1).join(" ") : t; };
/** One text's voice failures: opens on something seen, numbers in the opening ≤ 2, the word list. */
export function voiceSetFailures(t: string): string[] {
  const out: string[] = [], o = opening(t);
  if (!opensOnSeen(o)) out.push("opens on a count, not something seen");
  if (numbersInOpening(sentencesOf(o).slice(0, 2).join(" ")) > OPENING_NUMBERS_MAX) out.push("more than two numbers in the opening");
  for (const r of VOICE_REFUSALS) if (r.re.test(t)) out.push(r.name);
  for (const s of sentencesOf(t)) for (const r of SENTENCE_REFUSALS) if (r.test(s)) out.push(r.name);
  return [...new Set(out)];
}
export const voiceScore = (t: string) => Math.max(0, 100 - 25 * voiceSetFailures(t).length);
/** The gate: a writer's texts for the set must score at least the rewrites' mean. */
export const voiceSetMean = (texts: readonly string[]) => (texts.length ? Math.round(texts.reduce((a, t) => a + voiceScore(t), 0) / texts.length) : 0);
