// /digest/rss.xml: the latest 20 issues by their written headline and deck (E5), from the stored issue records.
import { untick } from "../labels";
import { rssXml, RSS_HEADERS, type FeedItem } from "./rss";
export async function feedResponse() {
  try {
    const { latestIssueWeeks, storedIssue } = await import("./digest.server");
    const issues = await Promise.all((await latestIssueWeeks(20)).map(w => storedIssue(w).catch(() => null)));
    const items: FeedItem[] = issues.flatMap(i => (i ? [{ week: i.week, number: i.number, headline: untick(i.text.headline), standfirst: i.text.deck, dates: i.dates.label }] : []));
    return new Response(rssXml(items), { headers: RSS_HEADERS });
  } catch {
    return new Response("Feed unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" } });
  }
}
