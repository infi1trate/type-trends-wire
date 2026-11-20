// E2b Part 0 · re-plan one UTC day on the live data under the new plan rules (measured first, weekly pieces outside the five, at most one
// AI-read roundup, against the grain backed by measured changes). Append-only: writes only `kill` and `restore` rows to story_edits; never
// deletes or rewrites a story, so every story keeps its number. Stories the new plan wants that do not exist yet are inserted by the next
// build. Idempotent: a story already in the planned state gets no edit.
// Usage: bun scripts/replan-day.ts --day 2026-11-20 [--dry]
import { replanEdits } from "../src/lib/stories/retire";
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const day = arg("--day"), dry = process.argv.includes("--dry");
if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("--day YYYY-MM-DD");
const { runBuild, dbDeps, loadInput } = await import("../src/lib/stories/build.server");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const base = dbDeps(supabaseAdmin, false);
const all = await base.existing(new Date(Date.parse(`${day}T00:00:00Z`) - 40 * 864e5).toISOString());
const onDay = all.filter(e => e.happened_at.slice(0, 10) === day);
// The day is decided afresh: its own stored stories do not hold places in the plan; everything before it does.
const r = await runBuild({ load: loadInput, existing: async () => all.filter(e => e.happened_at.slice(0, 10) !== day), insert: async () => 0, why: null }, { budgetMs: 120_000 });
const plan = (r.plan ?? []).filter(p => p.happenedAt.slice(0, 10) === day);
const stored = onDay.map(e => ({ id: e.id, type: e.type, state: (e.state ?? e.status) as "published" | "held" | "killed", happened_at: e.happened_at, basis: e.basis ?? null }));
const { kills, restores } = replanEdits(stored, plan.map(p => ({ id: p.id, status: p.status, reason: p.reason, type: p.type, basis: p.basis })), day);
const rows = [...kills.map(k => ({ story_id: k.id, action: "kill" as const, payload: { reason: k.note }, note: k.note })), ...restores.map(x => ({ story_id: x.id, action: "restore" as const, payload: {}, note: x.note }))];
if (!dry && rows.length) { const { error } = await supabaseAdmin.from("story_edits").insert(rows as never); if (error) throw new Error(`edit insert failed: ${error.message}`); }
const known = new Set(onDay.map(e => e.id));
console.log(JSON.stringify({ dry, day, stored: onDay.length, kills: kills.length, restores: restores.length, to_insert: plan.filter(p => p.status === "published" && !known.has(p.id)).map(p => p.id) }, null, 1));
for (const p of plan.filter(p => p.type !== "launch").sort((a, b) => b.score - a.score)) {
  const s = onDay.find(e => e.id === p.id), edit = rows.find(x => x.story_id === p.id);
  console.log(p.status.padEnd(9), String(p.score).padStart(3), (p.basis ?? "").padEnd(8), p.id, "|", p.headline, "|", s ? `stored ${s.state ?? s.status}` : "new", edit ? `→ ${edit.action}: ${edit.note}` : "", p.status === "held" ? `(${p.reason.slice(0, 60)})` : "");
}
for (const k of kills.filter(k => !plan.some(p => p.id === k.id))) console.log("retired  ", k.id, "|", k.note);
