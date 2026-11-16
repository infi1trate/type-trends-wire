// RSS 2.0 for the Digest: latest 20 issues, full standfirst + link. Pure.
import { SITE_URL, DIGEST_NAME } from "../site";
import { weekMonday } from "./week";
import { rssImage } from "../feed-image";
import { BRAND_NAME } from "../brand";
export type FeedItem = { week: string; number: number; headline: string; standfirst: string; dates: string };
export const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
/** Issues publish on the Sunday that closes their week. */
export const pubDate = (week: string) => { const m = weekMonday(week); return m ? new Date(+m + 6 * 864e5 + 18 * 36e5).toUTCString() : new Date(0).toUTCString(); };
export function rssXml(items: FeedItem[], now = new Date()): string {
  const list = [...items].sort((a, b) => b.week.localeCompare(a.week)).slice(0, 20);
  const self = `${SITE_URL}/digest/rss.xml`;
  const body = list.map(i => {
    const url = `${SITE_URL}/digest/${i.week}`;
    return `<item><title>${xmlEscape(`No. ${i.number} · ${i.headline}`)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${pubDate(i.week)}</pubDate><description>${xmlEscape(`${i.standfirst} (${i.dates})`)}</description></item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(DIGEST_NAME)} · ${BRAND_NAME}</title><link>${SITE_URL}/digest</link><description>${xmlEscape(`A weekly issue on what is moving in type, color, layout and vibe, built from the ${BRAND_NAME} data.`)}</description><language>en</language>${rssImage(`${DIGEST_NAME} · ${BRAND_NAME}`, `${SITE_URL}/digest`)}<lastBuildDate>${(list[0] ? new Date(pubDate(list[0].week)) : now).toUTCString()}</lastBuildDate><atom:link href="${self}" rel="self" type="application/rss+xml"/>${body}</channel></rss>`;
}
export const RSS_HEADERS = { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=3600" };
