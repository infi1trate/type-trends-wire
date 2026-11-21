// U2b · one count per claim, once: every published white-space story is re-judged on its own forecast run's latest-quarter sample (the
// run that gave its signal its stage). Still passing with other numbers → one `correct` edit with the run's count, base and share
// elsewhere (the scheduled job rewrites its text, since its facts changed); no longer passing → a `kill` with the count in the note.
// Append-only (story_edits); no writer call; thresholds unchanged. Idempotent: a story already showing the run's numbers gets nothing.
// Usage: bun scripts/u2b-white-space.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { applyEdits } = await import("../src/lib/stories/edits");
const { whiteSpaceRecheck } = await import("../src/lib/stories/retire");
const { storyRunId } = await import("../src/lib/stories/sheet");
const { stageName } = await import("../src/lib/labels");
const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const st = await supabaseAdmin.from("stories").select(cols).eq("type", "white_space");
if (st.error) throw new Error(st.error.message);
const ids = (st.data ?? []).map(s => s.id);
const ed = await supabaseAdmin.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id");
if (ed.error) throw new Error(ed.error.message);
const out: unknown[] = [];
for (const raw of st.data ?? []) {
  const s = applyEdits(raw as never, (ed.data ?? []) as never, Date.now()) as unknown as { id: string; state: string; sector: string | null; signal_keys: string[]; headline: string; deck: string | null; facts: unknown; source_ids: string[] };
  if (s.state !== "published") continue;
  const run = storyRunId(s.source_ids), key = s.signal_keys[0];
  if (run == null || !key || !s.sector) { out.push({ id: s.id, verdict: "unknown (no run)" }); continue; }
  const [dim, val] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const r = await supabaseAdmin.from("forecasts").select("scope,stage,current_share,sample:evidence->quarters->-1").eq("run_id", run).eq("dimension", dim).eq("value", val).in("scope", ["all", s.sector]);
  if (r.error) throw new Error(r.error.message);
  const all = (r.data ?? []).find(x => x.scope === "all") as never, sec = (r.data ?? []).find(x => x.scope === s.sector) as never;
  const v = whiteSpaceRecheck(s, all, sec, stageName((all as { stage?: string } | undefined)?.stage) ?? "Rising");
  const before = { headline: s.headline, deck: s.deck };
  if ("kill" in v) {
    if (!dry) { const { error } = await supabaseAdmin.from("story_edits").insert({ story_id: s.id, action: "kill", payload: { reason: v.kill }, note: v.kill } as never); if (error) throw new Error(error.message); }
    out.push({ id: s.id, run, before, verdict: "retired", note: v.kill });
  } else if ("correct" in v) {
    if (!dry) { const { error } = await supabaseAdmin.from("story_edits").insert({ story_id: s.id, action: "correct", payload: v.correct, note: v.note } as never); if (error) throw new Error(error.message); }
    out.push({ id: s.id, run, before, verdict: "corrected", after: { headline: v.correct.headline, deck: v.correct.deck } });
  } else out.push({ id: s.id, run, before, verdict: "keep" in v ? "unchanged" : "unknown (no sample)" });
}
console.log(JSON.stringify({ dry, stories: out }, null, 2));
process.exit(0);
