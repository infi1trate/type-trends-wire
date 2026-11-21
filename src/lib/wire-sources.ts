// The wire's source list: the news sites and blogs it reads by RSS. Pure and dependency-free, so the story engine can count "the
// outlets we read" from the same list the ingest reads. Hacker News (a link aggregator) and Bluesky accounts (social posts) are read
// too, but they are not outlets: they are never counted as one or named in an outlet sentence.
export const FEEDS = [
  { name: "It's Nice That", url: "https://feeds2.feedburner.com/itsnicethat/SlXC" },
  { name: "Dezeen", url: "https://www.dezeen.com/feed/" },
  { name: "Design Milk", url: "http://feeds.feedburner.com/design-milk" },
  { name: "Codrops", url: "http://feeds2.feedburner.com/tympanus" },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/" },
  { name: "Nielsen Norman Group", url: "https://www.nngroup.com/feed/rss/" },
  { name: "UX Collective", url: "https://uxdesign.cc/feed" },
  { name: "Colossal", url: "http://www.thisiscolossal.com/feed/" },
  { name: "designboom", url: "https://www.designboom.com/feed/" },
] as const;
export const OUTLET_NAMES: readonly string[] = FEEDS.map(f => f.name);
const OUTLETS = new Set<string>(OUTLET_NAMES);
/** A wire item from a publication on the source list (an RSS item from one of the FEEDS); social posts and aggregators are not. */
export const isOutletItem = (w: { source: string; source_kind: string }) => w.source_kind === "rss" && OUTLETS.has(w.source);
