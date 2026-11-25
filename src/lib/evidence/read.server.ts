// Y2 · the newest passed "Why now" block for a subject (anonymous SELECT; RLS shows only passed blocks). Pages, the Terminal table and
// the MCP forecast output read this one function.
import type { WhyNow } from "./whynow";
export type StoredWhy = { kind: string; id: string; block: WhyNow; written_at: string };
export async function loadWhyNow(kind: "signal" | "study" | "story", id: string): Promise<StoredWhy | null> {
  const { supabaseAnon } = await import("../mcp/supabase");
  const r = await supabaseAnon().from("why_now_blocks").select("subject_kind,subject_id,block,written_at").eq("subject_kind", kind).eq("subject_id", id).eq("status", "passed").order("written_at", { ascending: false }).limit(1);
  const row = r.data?.[0];
  return row ? { kind: row.subject_kind, id: row.subject_id, block: row.block as unknown as WhyNow, written_at: row.written_at } : null;
}
/** Newest passed block per signal key (for the MCP forecast rows). */
export async function whyNowFor(keys: readonly string[]): Promise<Map<string, WhyNow>> {
  if (!keys.length) return new Map();
  const { supabaseAnon } = await import("../mcp/supabase");
  const r = await supabaseAnon().from("why_now_blocks").select("subject_id,block,written_at").eq("subject_kind", "signal").eq("status", "passed").in("subject_id", keys.slice(0, 300)).order("written_at", { ascending: false }).limit(1000);
  const m = new Map<string, WhyNow>(); for (const x of r.data ?? []) if (!m.has(x.subject_id)) m.set(x.subject_id, x.block as unknown as WhyNow);
  return m;
}
