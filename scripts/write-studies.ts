// E4 · write the studies' text now (the same path the end-of-job hook takes): every live study whose facts sheet has no checked text and
// was not tried today, within the 4-a-day study allowance; insert-only versions in study_texts; then the stored Studies pages are rewritten.
// Usage: bun scripts/write-studies.ts [--dry] [--records]
//   --dry      prints each study's facts sheet and template text and calls nothing.
//   --records  calls nothing; only rewrites the stored Studies pages from the texts already stored.
const dry = process.argv.includes("--dry"), recordsOnly = process.argv.includes("--records");
const { studyJobs, computeDataIndex, computeDataStory } = await import("../src/lib/data-stories/page.server");
const { writeStudies, studyIO } = await import("../src/lib/data-stories/writer.server");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { jobs, known } = await studyJobs();
if (dry) { for (const j of jobs) console.log(JSON.stringify({ slug: j.slug, hash: j.hash, sheet: j.sheet, fallback: j.fallback }, null, 1)); process.exit(0); }
const r = recordsOnly ? { tried: [], calls: 0, skipped: jobs.length, rows: [] } : await writeStudies(jobs, studyIO(supabaseAdmin), known, { deadline: Date.now() + 9 * 60_000 });
console.log(JSON.stringify({ tried: r.tried, calls: r.calls, skipped: r.skipped, cost: r.rows.reduce((a, x) => a + x.cost, 0) }, null, 1));
for (const x of r.rows) console.log(JSON.stringify({ slug: x.slug, model: x.model, checked: !!x.checked_at, attempts: x.attempts, failures: x.failures, log: x.log }, null, 1));
const { writeRecords } = await import("../src/lib/records/store.server"), { pageKey } = await import("../src/lib/records/records");
const pages = await Promise.all(jobs.map(async j => ({ key: pageKey("data-story", j.slug), body: await computeDataStory(j.slug), source: "write-studies" })));
console.log("records", await writeRecords([...pages, { key: pageKey("data-index"), body: await computeDataIndex(), source: "write-studies" }]));
process.exit(0);
