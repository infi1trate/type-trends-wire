// D1c · the quick check's reads (rules in quick.ts): five newest-id reads, in parallel, each by its own index; and the last full build's
// print from job_runs. Service role (held stories and every edit count). Never throws: an unreadable print means a full build.
import type { BuildPrint, LastFull } from "./quick";
import { printOf } from "./quick";
/** BUILD_DAYS (7) plus the quiet change's QUIET_WINDOW_DAYS (14). */
const WIRE_LOOKBACK_DAYS = 21;
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function buildPrint(db: Admin): Promise<BuildPrint | null> {
  try {
    const one = <T>(p: PromiseLike<{ data: T[] | null; error: unknown }>) => Promise.resolve(p).then(r => (r.error ? null : r.data?.[0] ?? null));
    const [ev, wi, ru, st, ed] = await Promise.all([
      one(db.from("library_events").select("id").eq("source", "live").order("id", { ascending: false }).limit(1)),
      // Only items a build reads (published inside the window and the quiet change's 14 days before it): back-filled old items
      // arrive all day and must not force a full build.
      one(db.from("wire_items").select("id").gte("published_at", new Date(Date.now() - WIRE_LOOKBACK_DAYS * 864e5).toISOString()).lte("published_at", new Date(Date.now() + 3_600_000).toISOString()).order("id", { ascending: false }).limit(1)),
      one(db.from("forecast_runs").select("id").eq("status", "ok").order("id", { ascending: false }).limit(1)),
      one(db.from("stories").select("created_at").order("created_at", { ascending: false }).limit(1)),
      one(db.from("story_edits").select("id").order("id", { ascending: false }).limit(1)),
    ]);
    return { events: (ev as { id: number } | null)?.id ?? null, wire: (wi as { id: number } | null)?.id ?? null, runs: (ru as { id: number } | null)?.id ?? null, stories: (st as { created_at: string } | null)?.created_at ?? null, edits: (ed as { id: number } | null)?.id ?? null };
  } catch { return null; }
}
/** The newest story-build finish row that stored a full build's print. */
export async function lastFullBuild(db: Admin): Promise<LastFull> {
  try {
    const { data, error } = await db.from("job_runs").select("at,detail").eq("job", "story-build").eq("phase", "finish").eq("ok", true).eq("detail->>full", "true").order("id", { ascending: false }).limit(1);
    if (error || !data?.[0]) return null;
    const print = printOf(data[0].detail), full = (data[0].detail as { full?: unknown } | null)?.full === true;
    return print && full ? { print, at: data[0].at } : null;
  } catch { return null; }
}
