// L2b · rewrite requests: a desk (standards, copy desk, editor in chief) or the owner asks the story writer to rewrite a published story
// at its next allowance, first in its queue. Append-only `rewrite_requests` (service role only); a request is honoured by the writer's
// next version after it (`openRewrites` in rewrite.ts), so nothing here changes a story.
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Db = Pick<Admin, "from">;

/** Requests from the last 60 days (older ones are long honoured or moot). */
export async function rewriteRequests(db: Db): Promise<{ id: number; story_id: string; at: string; actor: string; reason: string }[]> {
  const { data, error } = await db.from("rewrite_requests").select("id,story_id,at,actor,reason").gte("at", new Date(Date.now() - 60 * 864e5).toISOString()).order("id").limit(500);
  if (error) throw new Error("rewrite_requests_read_failed");
  return data ?? [];
}

/** Records a request unless one for the same story is still open. */
export async function insertRewriteRequest(db: Db, r: { story_id: string; actor: string; reason: string }): Promise<{ id: number } | { refused: string }> {
  const [asks, texts] = await Promise.all([
    db.from("rewrite_requests").select("story_id,at").eq("story_id", r.story_id).order("id", { ascending: false }).limit(20),
    db.from("story_texts").select("created_at,model,attempts").eq("story_id", r.story_id).order("created_at", { ascending: false }).limit(1),
  ]);
  if (asks.error || texts.error) throw new Error("rewrite_request_read_failed");
  const { openRewrites } = await import("./rewrite");
  const newest = texts.data?.[0], open = openRewrites(asks.data ?? [], new Map(newest ? [[r.story_id, newest]] : []));
  if (open.has(r.story_id)) return { refused: `A rewrite of this story is already requested (${open.get(r.story_id)!.slice(0, 16).replace("T", " ")} UTC); the writer takes it at its next allowance.` };
  const { data, error } = await db.from("rewrite_requests").insert({ story_id: r.story_id, actor: r.actor, reason: r.reason }).select("id").single();
  if (error || !data) throw new Error("rewrite_request_insert_failed");
  return { id: data.id };
}

/** V3 · store each story's pre-rewrite text again as its newest version (pure `restoreRows`); "all" for every V3-rewritten story. */
export async function restoreTexts(db: Db, id: string): Promise<{ restored: string[] }> {
  const { restoreRows, isV3Request } = await import("./restore");
  let q = db.from("rewrite_requests").select("story_id,at,reason").like("reason", "V3 ·%").order("id").limit(1000);
  if (id !== "all") q = q.eq("story_id", id);
  const { data: asks, error } = await q;
  if (error) throw new Error("rewrite_requests_read_failed");
  const ids = [...new Set((asks ?? []).filter(a => isV3Request(a.reason)).map(a => a.story_id))], texts: import("./restore").TextVersion[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e } = await db.from("story_texts").select("story_id,version,headline,deck,body,how_we_know,created_at,model,checked").in("story_id", ids.slice(i, i + 200));
    if (e) throw new Error("story_texts_read_failed");
    texts.push(...((data ?? []) as unknown as import("./restore").TextVersion[]));
  }
  const rows = restoreRows(texts, asks ?? []);
  if (rows.length) { const { error: e } = await db.from("story_texts").insert(rows as never); if (e) throw new Error("story_texts_insert_failed"); }
  return { restored: rows.map(r => r.story_id) };
}
