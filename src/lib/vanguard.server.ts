// Loads the vanguard list from public reads (reader-run trendsetters, overlaid stories, active sites). Never throws: [] on failure.
import { vanguardList } from "./vanguard";
export async function loadVanguard(): Promise<string[]> {
  try {
    const [{ supabaseAnon }, { readerRunId }, { storyIndex }] = await Promise.all([import("./mcp/supabase"), import("./real-runs"), import("./stories/read.server")]);
    const db = supabaseAnon(), run = await readerRunId(db);
    const [ts, sites, stories] = await Promise.all([
      db.from("trendsetters").select("domain,rank").eq("run_id", run).order("rank").limit(100),
      db.from("library_sites").select("domain").eq("active", true).range(0, 999),
      storyIndex(),
    ]);
    if (ts.error || sites.error) throw ts.error ?? sites.error;
    return vanguardList({ trendsetters: ts.data ?? [], active: (sites.data ?? []).map(s => s.domain), stories, now: Date.now() });
  } catch (e) {
    console.error("vanguard load failed", e instanceof Error ? e.name : "UnknownError");
    return [];
  }
}
