// D1 Part 2 · work marks I/O (rules in marks.ts). Service role only; `work_marks` has no public policy.
import type { Mark } from "./marks";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const admin = async (): Promise<Admin> => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Mark topics out of date (newest mark wins; a done topic opens again). Throws when the marks cannot be written, so the crawler's
 *  post fails and is sent again: nothing it stored is left without its follow-up work. */
export async function markWork(topics: readonly string[], db?: Admin): Promise<void> {
  const want = [...new Set(topics)];
  if (!want.length) return;
  const d = db ?? await admin(), at = new Date().toISOString();
  const { error } = await d.from("work_marks").upsert(want.map(topic => ({ topic, marked_at: at, done_at: null })), { onConflict: "topic" });
  if (error) throw new Error("work_marks_write_failed");
}
/** Open marks, oldest first (at most `limit`). */
export async function openMarks(db?: Admin, limit = 200): Promise<Mark[]> {
  const d = db ?? await admin();
  const { data, error } = await d.from("work_marks").select("topic,marked_at").is("done_at", null).order("marked_at").limit(limit);
  if (error) throw new Error("work_marks_read_failed");
  return (data ?? []) as Mark[];
}
/** Done: cleared only if nobody marked it again since it was read (a newer mark stays open for the next pass). */
export async function clearMark(m: Mark, db?: Admin): Promise<void> {
  const d = db ?? await admin();
  const { error } = await d.from("work_marks").update({ done_at: new Date().toISOString() }).eq("topic", m.topic).eq("marked_at", m.marked_at);
  if (error) throw new Error("work_marks_clear_failed");
}
