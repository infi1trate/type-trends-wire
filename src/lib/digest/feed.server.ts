// /digest/rss.xml: latest 20 issues with their standfirst, from stored briefs only.
import { supabaseAnon } from "../mcp/supabase";
import { DIGEST_FIRST_WEEK } from "../site";
import { untick } from "../labels";
import { issueNumber, weekRange } from "./week";
import { rssXml, RSS_HEADERS, type FeedItem } from "./rss";
import { standfirstOf, type StoredBrief } from "./issue";
export async function feedResponse() {
  try {
    const { data, error } = await supabaseAnon().from("weekly_briefs").select("week,brief").gte("week", DIGEST_FIRST_WEEK).order("week", { ascending: false }).limit(20);
    if (error) throw error;
    const items: FeedItem[] = (data ?? []).flatMap(r => {
      const b = r.brief as unknown as StoredBrief, n = issueNumber(r.week), range = weekRange(r.week);
      if (n === null || !range || !b?.headline) return [];
      return [{ week: r.week, number: n, headline: untick(b.headline), standfirst: standfirstOf({ standfirst: b.standfirst ?? null, sections: b.sections ?? [] }), dates: range.label }];
    });
    return new Response(rssXml(items), { headers: RSS_HEADERS });
  } catch {
    return new Response("Feed unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" } });
  }
}
