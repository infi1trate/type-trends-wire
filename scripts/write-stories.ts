// E2b · write (or rewrite) the Read-side text of published stories: the ones published in the last seven days without a version newer
// than their last correction, best first. Same limits as a build (12 writer calls a day, 6 per run); insert-only versions in story_texts.
// Usage: bun scripts/write-stories.ts [--dry] [--limit N] [--per-run N]
//   --dry  prints the facts block of each story and calls nothing.
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const dry = process.argv.includes("--dry"), limit = Number(arg("--limit") ?? 12), perRun = Number(arg("--per-run") ?? 6);
const { loadInput, factSource, storiesToWrite, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates } = await import("../src/lib/stories/candidates");
const { writerFacts } = await import("../src/lib/stories/writer-facts");
const { writeStories, writerIO } = await import("../src/lib/stories/writer.server");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const input = await loadInput({ days: BUILD_DAYS + 7, allRuns: false, realRunIds: [] });
const { ctx } = allCandidates(input), src = factSource(input, ctx);
const stories = await storiesToWrite(supabaseAdmin, [], limit);
const jobs = stories.map(st => ({ story: st, ...writerFacts(st, src) }));
if (dry) { for (const j of jobs) console.log(JSON.stringify({ id: j.story.id, template: j.template, facts: j.facts }, null, 1)); process.exit(0); }
const r = await writeStories(jobs, writerIO(supabaseAdmin), { names: src.known }, { deadline: Date.now() + 9 * 60_000, perBuild: perRun });
console.log(JSON.stringify({ owed: stories.length, written: r.written, checked: r.checked, calls: r.calls, skipped: r.skipped, cost: r.rows.reduce((a, x) => a + x.cost, 0) }, null, 1));
for (const x of r.rows) { const t = jobs.find(j => j.story.id === x.story_id)!.template; console.log(JSON.stringify({ id: x.story_id, template: t.headline, headline: x.headline, deck: x.deck, body: x.body, how_we_know: x.how_we_know, checked: x.checked, attempts: x.attempts, model: x.model, cost: x.cost, log: x.log }, null, 1)); }
