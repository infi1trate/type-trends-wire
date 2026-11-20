// E2c · keep the crops a published story cites (story_kept_crops): after each build, published stories of the last seven days that keep
// nothing yet get their before/after (or a gathered story's member heroes) recorded. Insert-only; never fails a build. Crop history
// (crops-ingest.server.ts) skips these crops while their story is published; an owner's removal still deletes them (ON DELETE CASCADE).
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Db = { from: Admin["from"] };
const COLS = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
export const KEEP_DAYS = 7, KEEP_PER_BUILD = 6;
export const KEEP_TYPES = ["move", "rebrand", "counter_move", "roundup"] as const;

/** Story ids among `ids` that are published now (the editor's overlay applied). */
export async function publishedStoryIds(db: Db, ids: string[]): Promise<Set<string>> {
  const { applyEdits } = await import("./edits"), out = new Set<string>(), now = Date.now();
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const [st, ed] = await Promise.all([db.from("stories").select(COLS).in("id", part), db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", part).order("id")]);
    if (st.error || ed.error) throw new Error("published_lookup_failed");
    const edits = (ed.data ?? []) as unknown as import("./edits").EditRow[];
    for (const s of (st.data ?? []) as unknown as import("./edits").StoredStory[]) if (applyEdits(s, edits.filter(e => e.story_id === s.id), now).state === "published") out.add(s.id);
  }
  return out;
}

export async function keepStoryCrops(admin: Admin, o: { days?: number; limit?: number } = {}): Promise<number> {
  const since = new Date(Date.now() - (o.days ?? KEEP_DAYS) * 864e5).toISOString();
  const { data, error } = await admin.from("stories").select("id,type,domains,source_ids,happened_at").in("type", [...KEEP_TYPES]).gte("happened_at", since).order("happened_at", { ascending: false }).limit(300);
  if (error) throw new Error("keep_stories_read_failed");
  const rows = (data ?? []) as { id: string; type: string; domains: string[]; source_ids: string[]; happened_at: string }[];
  if (!rows.length) return 0;
  const ids = rows.map(r => r.id), have = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const k = await admin.from("story_kept_crops").select("story_id").in("story_id", ids.slice(i, i + 200));
    if (k.error) throw new Error("keep_read_failed");
    for (const x of k.data ?? []) have.add(x.story_id);
  }
  const live = await publishedStoryIds(admin, ids.filter(id => !have.has(id)));
  const todo = rows.filter(r => live.has(r.id)).slice(0, o.limit ?? KEEP_PER_BUILD);
  if (!todo.length) return 0;
  const [{ evidenceOf }, { keepFromEvidence }] = await Promise.all([import("./page.server"), import("./evidence")]);
  let n = 0;
  for (const s of todo) {
    const want = keepFromEvidence(await evidenceOf(s, s.type, { kept: false }));
    if (!want.length) continue;
    const c = await admin.from("site_crops").select("id,path").in("path", want.map(w => w.path));
    if (c.error) throw new Error("keep_crop_lookup_failed");
    const idOf = new Map((c.data ?? []).map(x => [x.path, x.id]));
    const ins = want.filter(w => idOf.has(w.path)).map(w => ({ story_id: s.id, crop_id: idOf.get(w.path)!, path: w.path, domain: w.domain, role: w.role }));
    if (!ins.length) continue;
    const r = await admin.from("story_kept_crops").upsert(ins, { onConflict: "story_id,crop_id", ignoreDuplicates: true }).select("id");
    if (r.error) throw new Error("keep_insert_failed");
    n += r.data?.length ?? 0;
  }
  return n;
}
