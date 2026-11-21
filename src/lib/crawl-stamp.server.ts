// Per-instance caches for reads that only change when the library changes (a crawl stores captures, the AI worker stores tags):
// keyed on a cheap stamp of the newest capture and newest tag, so a page view does not re-run the summary views until data moves.
import { supabaseAnon } from "./mcp/supabase";
import { memo, memoBy } from "./memo";
import { crawlKey } from "./crawl-stamp";

/** The library's change stamp (two indexed/small reads), re-read at most once a minute per instance. */
export const crawlStamp = memo(60_000, async () => {
  const db = supabaseAnon();
  const [site, tag] = await Promise.all([
    db.from("library_sites").select("last_snapshot_at").not("last_snapshot_at", "is", null).order("last_snapshot_at", { ascending: false }).limit(1),
    db.from("library_tags").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);
  if (site.error || tag.error) throw site.error ?? tag.error;
  return crawlKey(site.data?.[0]?.last_snapshot_at ?? null, tag.data?.[0]?.created_at ?? null);
});
/** `load` cached until the library's stamp changes (and at most `maxAge`; the summaries also age with the clock). When the stamp
 *  can't be read, the key is the current minute, so nothing is served stale for long. */
export function byCrawl<T>(load: () => Promise<T>, maxAge = 3_600_000): (() => Promise<T>) & { clear: () => void } {
  const m = memoBy(maxAge, (_stamp: string) => load(), { max: 4, key: s => s });
  const fn = async () => m(await crawlStamp().catch(() => `minute:${Math.floor(Date.now() / 60_000)}`));
  return Object.assign(fn, { clear: () => { m.clear(); crawlStamp.clear(); } });
}
