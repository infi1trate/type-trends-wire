// Story backfill: builds the last 30 days from existing data (insert-only, idempotent; AI lines only for the top stories, inside the caps).
// Usage: bun scripts/build-stories.ts            (writes)
//        bun scripts/build-stories.ts --dry      (plans only: no inserts, no AI)
import { STORY_KINDS } from "../src/lib/stories/types";
const dry = process.argv.includes("--dry");
const { runBuild, dbDeps, loadInput } = await import("../src/lib/stories/build.server");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const deps = dry ? { load: loadInput, existing: dbDeps(supabaseAdmin, false).existing, insert: async () => 0, why: null } : dbDeps(supabaseAdmin, true);
const r = await runBuild(deps, { days: 30, allRuns: true, budgetMs: 300_000 });
const plan = r.plan ?? [];
const by = Object.fromEntries(STORY_KINDS.map(k => [k, { published: plan.filter(p => p.type === k && p.status === "published").length, held: plan.filter(p => p.type === k && p.status === "held").length }]));
const reasons = new Map<string, number>();
for (const p of plan) if (p.status === "held") { const k = p.reason.replace(/\d+/g, "N").replace(/(told in|merged into|duplicate of) \S+/, "$1 …"); reasons.set(k, (reasons.get(k) ?? 0) + 1); }
console.log(JSON.stringify({ dry, considered: r.considered, inserted: r.inserted, published: r.published, held: r.held, why_lines: r.why_lines, news_kept: r.news_kept, news_dropped: r.news_dropped, by_type: by, held_reasons: [...reasons].sort((a, b) => b[1] - a[1]) }, null, 1));
console.log("TOP");
for (const p of plan.filter(p => p.status === "published").sort((a, b) => b.score - a.score).slice(0, 15)) console.log(p.score, p.type, p.id, "|", p.headline, "|", Object.entries(p.components).map(([k, v]) => `${k}=${v.value}`).join(" "));
if (process.argv.includes("--all")) for (const p of plan) console.log(p.status, p.score, p.type, p.id, "|", p.headline, "|", p.deck, "|", p.reason);
if (process.argv.includes("--days")) { const m = new Map<string, Record<string, number>>(); for (const p of plan.filter(p => p.status === "published")) { const d = p.happenedAt.slice(0, 10), o = m.get(d) ?? {}; o[p.type] = (o[p.type] ?? 0) + 1; m.set(d, o); } console.log([...m].sort()); }
