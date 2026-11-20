// Retire one published story with an appended kill edit (append-only: the story keeps its row and its number; its changes stay on the
// tape). Idempotent: a story already killed with the same note gets no second edit.
// Usage: bun scripts/retire-story.ts --id <story id> --note "Retired: …" [--dry]
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const id = arg("--id"), note = arg("--note"), dry = process.argv.includes("--dry");
if (!id || !note || !/^Retired: /.test(note) || note.length > 200) throw new Error('--id <story id> --note "Retired: …" (at most 200 characters)');
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { applyEdits } = await import("../src/lib/stories/edits");
const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const [st, ed] = await Promise.all([supabaseAdmin.from("stories").select(cols).eq("id", id).maybeSingle(), supabaseAdmin.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", id).order("id")]);
if (st.error || ed.error || !st.data) throw new Error(`story ${id} not found`);
const shown = applyEdits(st.data as never, (ed.data ?? []) as never, Date.now());
if (shown.state === "killed") { console.log(JSON.stringify({ id, state: "killed", note: shown.killReason, wrote: 0 })); process.exit(0); }
if (!dry) { const { error } = await supabaseAdmin.from("story_edits").insert({ story_id: id, action: "kill", payload: { reason: note }, note } as never); if (error) throw new Error(`kill insert failed: ${error.message}`); }
console.log(JSON.stringify({ id, was: shown.state, now: dry ? shown.state : "killed", note, wrote: dry ? 0 : 1 }));
