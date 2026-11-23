// T2 · A: the loads behind the carry rule (vision-carry.ts): the previous live capture's reading, the domain's stored crop versions and
// the leading group. Service role, reads only; any failed read answers "read fresh".
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { tagsSchema } from "./ai-schema";
import { reliableVision } from "./ai-vision";
import { carryDecision, LEADING_GROUP, type CarryDecision, type CropVersion, type PreviousRead } from "./vision-carry";

let leading: { at: number; set: Set<string> } | null = null;
const LEADING_TTL_MS = 10 * 60_000;
/** The top LEADING_GROUP trendsetters of the reader run among active sites (cached ten minutes per instance). */
export async function leadingGroup(now = Date.now()): Promise<Set<string>> {
  if (leading && now - leading.at < LEADING_TTL_MS) return leading.set;
  const [{ readerRunId }, { supabaseAnon }] = await Promise.all([import("./real-runs"), import("./mcp/supabase")]);
  const run = await readerRunId(supabaseAnon());
  const [ts, sites] = await Promise.all([db.from("trendsetters").select("domain,rank").eq("run_id", run).order("rank").limit(100), db.from("library_sites").select("domain").eq("active", true).range(0, 1999)]);
  if (ts.error || sites.error) throw new Error("leading group read failed");
  const active = new Set((sites.data ?? []).map(s => s.domain));
  const set = new Set((ts.data ?? []).filter(t => active.has(t.domain)).slice(0, LEADING_GROUP).map(t => t.domain));
  leading = { at: now, set };
  return set;
}
export type PreviousTag = PreviousRead & { tags: unknown; model: string; read_version: string | null };
export async function carryFor(snapshot: { domain: string; captured_at: string; source: string }, now = Date.now()): Promise<{ decision: CarryDecision; previous: PreviousTag | null }> {
  if (snapshot.source !== "live") return { decision: { carry: false, reason: "archive capture" }, previous: null };
  try {
    const [lead, snaps, crops] = await Promise.all([
      leadingGroup(now),
      db.from("library_snapshots").select("id,captured_at").eq("domain", snapshot.domain).eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").lt("captured_at", snapshot.captured_at).order("captured_at", { ascending: false }).limit(10),
      db.from("site_crops").select("section,hash,first_seen_at,last_seen_at").eq("domain", snapshot.domain).eq("viewport", "desktop").limit(50),
    ]);
    if (snaps.error || crops.error) throw new Error("carry read failed");
    const ids = (snaps.data ?? []).map(x => x.id);
    const tags = ids.length ? await db.from("library_tags").select("snapshot_id,tags,model,read_version,carried_from").in("snapshot_id", ids) : { data: [], error: null };
    if (tags.error) throw new Error("carry read failed");
    // The newest earlier live capture that has a reading.
    const snap = (snaps.data ?? []).find(x => (tags.data ?? []).some(t => t.snapshot_id === x.id));
    const p = snap ? { ...((tags.data ?? []).find(t => t.snapshot_id === snap.id) as unknown as { tags: unknown; model: string; read_version: string | null; carried_from: string | null }), library_snapshots: { captured_at: snap.captured_at } } : undefined;
    const parsed = p ? tagsSchema.safeParse(p.tags) : null;
    const previous: PreviousTag | null = p ? { captured_at: p.library_snapshots.captured_at, carried_from: p.carried_from, usable: !!parsed?.success && reliableVision(parsed.data), tags: p.tags, model: p.model, read_version: p.read_version } : null;
    return { decision: carryDecision({ source: snapshot.source, captured_at: snapshot.captured_at, previous, crops: (crops.data ?? []) as CropVersion[], leading: lead.has(snapshot.domain), now }), previous };
  } catch {
    return { decision: { carry: false, reason: "carry facts unreadable" }, previous: null };
  }
}
