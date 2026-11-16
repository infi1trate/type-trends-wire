// One-off maintenance (Phase 14b): retire stored stories the current rules would not produce, and reword stored stories whose wording the
// templates have since fixed. Append-only and idempotent: writes only `kill` and `correct` rows to story_edits, never touches a story row,
// skips stories that already have a kill, and only corrects when the shown text still differs from the current template.
// Usage: bun scripts/retire-stories.ts          (writes)
//        bun scripts/retire-stories.ts --dry    (prints what it would do)
import { applyEdits, type EditRow, type StoredStory } from "../src/lib/stories/edits";
import { archiveDepth, moveCandidate, rebrandDeck } from "../src/lib/stories/candidates";
import { retireReason, reword } from "../src/lib/stories/retire";
import { fetchRealRuns } from "../src/lib/real-runs";

const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { loadInput } = await import("../src/lib/stories/build.server");
async function all<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 500) { const { data, error } = await f(from, from + 499); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 500) return out; }
}
const COLS = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const [stories, edits, real, input] = await Promise.all([
  all<StoredStory>((f, t) => db.from("stories").select(COLS).order("id").range(f, t) as never),
  all<EditRow>((f, t) => db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never),
  fetchRealRuns(db, { limit: 60 }),
  loadInput({ days: 120, allRuns: false, realRunIds: [] }),
]);
const runAt = new Map(real.map(r => [r.id, r.at])), depth = archiveDepth(input.archive);
const events = new Map(input.events.map(e => [e.id, e]));
const rebrands = new Map(input.rebrands.map(r => [`${r.domain}|${r.confirmed_at}`, r]));
const killedAlready = new Set(edits.filter(e => e.action === "kill").map(e => e.story_id));
const now = Date.now(), byStory = new Map<string, EditRow[]>();
for (const e of edits) byStory.set(e.story_id, [...(byStory.get(e.story_id) ?? []), e]);

const kills: { story_id: string; action: "kill"; payload: { reason: string }; note: string }[] = [];
const corrects: { story_id: string; action: "correct"; payload: Record<string, unknown>; note: string }[] = [];
const tally = new Map<string, number>(), retiredIds = new Set<string>();
for (const s of stories) {
  if (killedAlready.has(s.id)) continue;
  const why = retireReason(s, { runAt: id => runAt.get(id) ?? null, depth });
  if (why) { kills.push({ story_id: s.id, action: "kill", payload: { reason: why }, note: why }); retiredIds.add(s.id); const k = `${s.type} · ${why.replace(/ \(.*\)\.?$/, "").replace(/ for [a-z &-]+ is/, " for <sector> is")}`; tally.set(k, (tally.get(k) ?? 0) + 1); }
}
const NOTE = "Reworded to the current template (wording only; the numbers and sources are unchanged).";
const correctedByType = new Map<string, number>();
for (const s of stories) {
  if (killedAlready.has(s.id) || retiredIds.has(s.id)) continue;
  const shown = applyEdits(s, byStory.get(s.id) ?? [], now);
  if (shown.state === "killed") continue;
  const w = reword({ ...s, headline: shown.headline, deck: shown.deck, facts: shown.facts }, {
    move: id => { const e = events.get(id); return e ? moveCandidate(e) : null; },
    rebrandDeck: (domain, at) => { const r = rebrands.get(`${domain}|${at}`); return r ? rebrandDeck(r) : null; },
  });
  if (!w) continue;
  const payload: Record<string, unknown> = { facts: w.facts };
  if (w.headline !== shown.headline) payload["headline"] = w.headline;
  if (w.deck !== shown.deck && w.deck != null) payload["deck"] = w.deck;
  corrects.push({ story_id: s.id, action: "correct", payload, note: NOTE });
  correctedByType.set(s.type, (correctedByType.get(s.type) ?? 0) + 1);
}
if (!dry) {
  for (let i = 0; i < kills.length; i += 200) { const { error } = await db.from("story_edits").insert(kills.slice(i, i + 200) as never); if (error) throw new Error(`kill insert failed: ${error.message}`); }
  for (let i = 0; i < corrects.length; i += 200) { const { error } = await db.from("story_edits").insert(corrects.slice(i, i + 200) as never); if (error) throw new Error(`correct insert failed: ${error.message}`); }
}
const byType = (rows: { story_id: string }[]) => { const m: Record<string, number> = {}; for (const r of rows) { const t = stories.find(s => s.id === r.story_id)!.type; m[t] = (m[t] ?? 0) + 1; } return m; };
console.log(JSON.stringify({ dry, stories: stories.length, already_killed: killedAlready.size, real_runs: real.map(r => `${r.id}@${r.at.slice(0, 16)}`), retired: kills.length, retired_by_type: byType(kills), retired_by_reason: [...tally].sort((a, b) => b[1] - a[1]), retired_published: kills.filter(k => stories.find(s => s.id === k.story_id)!.status === "published").length, corrected: corrects.length, corrected_by_type: Object.fromEntries(correctedByType) }, null, 1));
if (process.argv.includes("--list")) { for (const k of kills) console.log("KILL", k.story_id, "|", k.note); for (const c of corrects) console.log("CORRECT", c.story_id, "|", JSON.stringify(c.payload).slice(0, 300)); }
