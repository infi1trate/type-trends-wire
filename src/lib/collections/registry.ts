// THE COLLECTIONS REGISTRY — the one list of collections: a saved gallery filter with a permanent number in its own series, a title,
// a one-line deck, the data story or signal it pairs with, and its status. A collection is LIVE only when its filter shows at least
// COLLECTION_MIN tiles on stored data (counts recorded below, re-checked at read time); otherwise it stays a DRAFT with the reason. Pure.
import { compositeKey } from "../composites";
import { CHANGED_DAYS, NO_FILTER, type GalleryFilter } from "../gallery";
import type { Link } from "../data-stories/types";

/** A collection needs at least this many tiles to go live. */
export const COLLECTION_MIN = 12;
export type CollectionStatus = { status: "live" | "draft"; reason: string | null };
/** Live when the count clears COLLECTION_MIN; otherwise a draft that says how many it has and how many it needs. */
export function collectionStatus(count: number): CollectionStatus {
  return count >= COLLECTION_MIN ? { status: "live", reason: null }
    : { status: "draft", reason: `${count} ${count === 1 ? "capture matches" : "captures match"} its filter so far; a collection needs at least ${COLLECTION_MIN}.` };
}

export type Collection = {
  slug: string; number: number; title: string; deck: string;
  filter: GalleryFilter;
  /** The data story or signal it pairs with (data stories link back to their live collection). */
  pairs: Link & { dataStory?: string };
  status: "live" | "draft"; reason: string | null;
  /** The tile count when the status was set (16 Nov 2026), for the report and the registry test. */
  recorded: number;
};
const F = (f: Partial<GalleryFilter>): GalleryFilter => ({ ...NO_FILTER, ...f });
const BIG_TYPE = compositeKey("big_type");

export const COLLECTIONS: readonly Collection[] = [
  { slug: "fintech-heroes-this-quarter", number: 1, title: "Fintech heroes, this quarter", deck: "The first screen of every fintech brand captured this quarter, newest first.",
    filter: F({ sectors: ["fintech"], period: "latest" }), pairs: { label: "Sector report: Fintech", href: "/sectors/fintech" }, status: "live", reason: null, recorded: 30 },
  { slug: "who-went-big", number: 2, title: "Who went big", deck: "Every capture showing big type: oversized headlines set in a heavy display face.",
    filter: F({ pattern: BIG_TYPE }), pairs: { label: "Data story 2: Who went big first?", href: "/data/who-went-big-first", dataStory: "who-went-big-first" }, status: "live", reason: null, recorded: 269 },
  { slug: "dark-pages-in-dev-tools", number: 3, title: "Dark pages in dev tools", deck: "Developer-tool homepages captured in dark mode.",
    filter: F({ sectors: ["dev-tools"], pattern: "theme:dark" }), pairs: { label: "Signal: Dark mode", href: `/signals/${encodeURIComponent("theme:dark")}` }, status: "live", reason: null, recorded: 54 },
  { slug: "changed-this-month", number: 4, title: "Changed this month", deck: `First screens either side of every change recorded in the last ${CHANGED_DAYS} days.`,
    filter: F({ changed: CHANGED_DAYS }), pairs: { label: "Brands: recent moves", href: "/brands?tab=moves" }, status: "live", reason: null, recorded: 144 },
  { slug: "software-homepage-2021-to-now", number: 5, title: "The software homepage, 2021 to now", deck: "Dev-tool and enterprise software homepages, one capture a quarter since 2021.",
    filter: F({ sectors: ["dev-tools", "enterprise-saas"], since: "2021Q1" }), pairs: { label: "Data story 1: What happened to the software homepage in five years?", href: "/data/software-homepage-five-years", dataStory: "software-homepage-five-years" }, status: "live", reason: null, recorded: 280 },
];
export const collectionOf = (slug: string) => COLLECTIONS.find(c => c.slug === slug) ?? null;
export const collectionPath = (slug: string) => `/collections/${slug}`;
/** Registry status alone (no data): what shelves and data-story links use without loading the gallery. */
export const liveCollections = () => COLLECTIONS.filter(c => c.status === "live");
/** The live collection a data story pairs with, as a link, or null. */
export function collectionForStory(dataStory: string): Link | null {
  const c = liveCollections().find(x => x.pairs.dataStory === dataStory);
  return c ? { label: `Collection ${c.number}: ${c.title}`, href: collectionPath(c.slug) } : null;
}
