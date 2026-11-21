// E5 · write The Digest's text now (the same path the end-of-job hook takes): every closed week within 14 days whose facts sheet has no
// passed text and was not tried today, within the 2-a-day digest allowance; insert-only versions in digest_texts; then the stored issue
// pages are rewritten. Usage: bun scripts/write-digest.ts [--dry] [--records]
//   --dry      prints each issue's facts sheet and fallback text and calls nothing.
//   --records  calls nothing; only rewrites the stored issue pages from the texts already stored.
const dry = process.argv.includes("--dry"), recordsOnly = process.argv.includes("--records");
const { digestJobs, writeDigests, digestIO, writeIssueRecords } = await import("../src/lib/digest/writer.server");
const { latestIssueWeeks } = await import("../src/lib/digest/digest.server");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { jobs, known } = await digestJobs();
if (dry) { for (const j of jobs) console.log(JSON.stringify({ week: j.week, hash: j.hash, subject: j.subject, sheet: j.sheet, fallback: j.fallback }, null, 1)); process.exit(0); }
const r = recordsOnly ? { tried: [], calls: 0, skipped: jobs.length, rows: [] } : await writeDigests(jobs, digestIO(supabaseAdmin), known, { deadline: Date.now() + 9 * 60_000 });
console.log(JSON.stringify({ tried: r.tried, calls: r.calls, skipped: r.skipped, cost: r.rows.reduce((a, x) => a + x.cost, 0) }, null, 1));
for (const x of r.rows) console.log(JSON.stringify({ week: x.week, model: x.model, passed: x.passed, attempts: x.attempts, failures: x.failures, log: x.log }, null, 1));
console.log("records", await writeIssueRecords(await latestIssueWeeks(8), "write-digest"));
process.exit(0);
