// Ties registry entries to their builders and checks. Pure over DataInput + captures.
import { collectionForStory } from "../collections/registry";
import { CHECKS } from "./checks";
import { DATA_STORIES, WHERE_YOU_SIT, entryOf, relatedFor, seriesOf, studyLabel, templateName, withheld, type Entry } from "./registry";
import { bigTypeStory, mindsBrand, sectorMindsStory, softwareStory, whereYouSit, type Captures, type Meta } from "./stories";
import { softwareFigures } from "./checks";
import type { DataInput } from "./series";
import type { CaptureRaw } from "./templates/frames";
import type { StoryModel } from "./types";
import { MUSEUM_SLUG, museumStory } from "./museum";
import { accentStory } from "./museum-accent";
import { MUSEUM_ACCENT_SLUG } from "./registry";

type Builder = { domains: (i: DataInput) => string[]; build: (i: DataInput, caps: Captures, m: Meta) => StoryModel };
export const BUILDERS: Record<string, Builder> = {
  "software-homepage-five-years": { domains: i => softwareFigures(i).topBrands.map(b => b.domain), build: softwareStory },
  "who-went-big-first": { domains: () => [], build: bigTypeStory },
  "which-sector-changes-its-mind": { domains: i => { const d = mindsBrand(i); return d ? [d] : []; }, build: sectorMindsStory },
  [MUSEUM_SLUG]: { domains: () => [], build: museumStory },
  [MUSEUM_ACCENT_SLUG]: { domains: () => [], build: accentStory },
};
export type Status = { status: "live" | "draft"; reason: string | null };
/** The registry status, re-checked on current data: a live story whose check no longer passes, or that has no builder, reads as a draft. */
export function statusOf(e: Entry, i: DataInput | null): Status {
  if (e.status === "draft") return { status: "draft", reason: e.reason };
  if (withheld(e)) return { status: "draft", reason: "Withheld by the editor." };
  // W3a · a hidden study is live only when its check passes on data in hand (never assumed without data).
  if (e.hidden && !i) return { status: "draft", reason: "Withheld until its data is stored." };
  if (!BUILDERS[e.slug]) return { status: "draft", reason: "No builder for this story yet." };
  if (i && e.check) { const v = CHECKS[e.check](i); if (!v.pass) return { status: "draft", reason: `The check no longer passes on current data: ${v.reason}` }; }
  return { status: "live", reason: null };
}
export type IndexRow = { slug: string; number: number; series: string; question: string; deck: string; template: string; status: "live" | "draft"; reason: string | null; dataThrough: string | null; href: string | null };
/** Every study in number order (E4: the tool is not a study and is not listed; number 5 is retired). */
export function indexRows(i: DataInput | null, dataThrough: string | null): IndexRow[] {
  return DATA_STORIES.filter(e => !e.hidden || statusOf(e, i).status === "live").map(e => { const s = statusOf(e, i); return { slug: e.slug, number: e.number, series: e.series, question: e.question, deck: e.deck, template: templateName(e), ...s, dataThrough, href: s.status === "live" ? `/data/${e.slug}` : null }; }).sort((a, b) => a.number - b.number);
}
const metaOf = (e: Entry, live: Entry[]): Meta => ({ slug: e.slug, number: e.number, question: e.question, deck: e.deck, template: templateName(e), collection: collectionForStory(e.slug) ?? e.collection, related: relatedFor(e.slug, live), series: e.series, seriesTitle: seriesOf(e.series)?.title ?? "" });
export const liveNow = (i: DataInput | null) => DATA_STORIES.filter(e => statusOf(e, i).status === "live");
export function buildStory(slug: string, i: DataInput, caps: Captures): StoryModel | null {
  const e = entryOf(slug), b = BUILDERS[slug];
  if (!e || !b || statusOf(e, i).status !== "live") return null;
  return b.build(i, caps, metaOf(e, liveNow(i)));
}
export function buildWhereYouSit(i: DataInput, domain: string, cs: CaptureRaw[]): StoryModel | null {
  const live = liveNow(i);
  return whereYouSit(i, domain, cs, { slug: WHERE_YOU_SIT.slug, number: 0, question: WHERE_YOU_SIT.question, deck: WHERE_YOU_SIT.deck, template: templateName(WHERE_YOU_SIT),
    collection: { label: "Brand page", href: `/brands/${encodeURIComponent(domain)}` }, related: [...live.slice(0, 3).map(x => ({ label: `${studyLabel(x.number)}: ${x.question}`, href: `/data/${x.slug}` })), { label: "All studies", href: "/data" }] });
}
/** Only tracked brands can be picked: the picker list and the server both go through this. */
export const isTracked = (i: { sites: { domain: string; active: boolean }[] }, domain: string) => i.sites.some(s => s.active && s.domain === domain);
export const normDomain = (raw: string) => raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
/** The front page shelf without a stored Studies home: live studies by registry status, the question as the headline (no data load). */
export const dataShelf = () => DATA_STORIES.filter(e => statusOf(e, null).status === "live").map(e => ({ slug: e.slug, number: e.number, label: studyLabel(e.number), headline: e.question, question: e.question, href: `/data/${e.slug}` }));
