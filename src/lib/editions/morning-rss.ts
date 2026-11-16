// RSS 2.0 for the Morning Line: finished editions only (an edition never changes after its UTC day ends), newest first. Pure.
import { SITE_URL } from "../site";
import { xmlEscape } from "../digest/rss";
import { RSS_EDITIONS, cutOf } from "./morning";
import { BRAND_NAME } from "../brand";
export type MorningFeedItem = { day: string; title: string; lead: string | null; count: number; href: string; final: boolean };
export function morningRss(items: MorningFeedItem[]): string {
  const list = items.filter(i => i.final).sort((a, b) => b.day.localeCompare(a.day)).slice(0, RSS_EDITIONS);
  const body = list.map(i => {
    const url = `${SITE_URL}${i.href}`;
    return `<item><title>${xmlEscape(i.lead ? `${i.title} — ${i.lead}` : i.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(cutOf(i.day)).toUTCString()}</pubDate><description>${xmlEscape(`${i.count} ${i.count === 1 ? "story" : "stories"} from the day, ranked by score, with the opening and what the desk held.`)}</description></item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>The Morning Line · ${BRAND_NAME}</title><link>${SITE_URL}/morning</link><description>${xmlEscape("The daily edition: the day's lead, the stories behind it, what is moving and one opening. Built from stored stories; no AI per view.")}</description><language>en</language><atom:link href="${SITE_URL}/morning/rss.xml" rel="self" type="application/rss+xml"/>${body}</channel></rss>`;
}
