// W1d · retire every published quiet change the W1d rule would not run (an accent, palette or theme change alone on another page, or a
// page change with no before-and-after picture) with an appended kill edit (append-only: the story keeps its row, number and page; its
// change stays on the tape). Idempotent: a story already killed gets no second edit. No model calls.
// Usage: bun scripts/w1d-retire-quiet.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const [{ applyEdits }, { quietRetire, W1D_RETIRE }] = await Promise.all([import("../src/lib/stories/edits"), import("../src/lib/stories/retire")]);
const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const st = await supabaseAdmin.from("stories").select(cols).like("id", "quiet:event:%");
if (st.error) throw new Error("stories read failed");
const out: { id: string; was: string; reason: string | null; wrote: number }[] = [];
for (const s of st.data ?? []) {
  const ed = await supabaseAdmin.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", s.id).order("id");
  if (ed.error) throw new Error("edits read failed");
  const shown = applyEdits(s as never, (ed.data ?? []) as never, Date.now());
  const eventId = Number(/^quiet:event:(\d+)$/.exec(s.id)?.[1]);
  const ev = Number.isFinite(eventId) ? await supabaseAdmin.from("library_events").select("type").eq("id", eventId).maybeSingle() : null;
  const why = quietRetire(s as never, (ev?.data as { type: string } | null) ?? null);
  if (shown.state !== "published" || !why) { out.push({ id: s.id, was: shown.state, reason: why, wrote: 0 }); continue; }
  const note = W1D_RETIRE[why];
  if (!dry) { const { error } = await supabaseAdmin.from("story_edits").insert({ story_id: s.id, action: "kill", payload: { reason: note }, note } as never); if (error) throw new Error(`kill insert failed: ${error.message}`); }
  out.push({ id: s.id, was: shown.state, reason: why, wrote: dry ? 0 : 1 });
}
console.log(JSON.stringify(out));
