// I3b · part 4: Study No. 4 written once more after the ranked-list superlative rule (one writer call, no retry, no fallback model).
// Inserts one insert-only study_texts version (checked text, or the template when the check refuses) and rewrites its stored page.
// Usage: bun scripts/i3b-study4.ts
const SLUG = "which-sector-changes-its-mind";
const { studyJobs, computeDataStory, computeDataIndex } = await import("../src/lib/data-stories/page.server");
const { studyIO, callsOn } = await import("../src/lib/data-stories/writer.server");
const { checkStudyText, parseStudy, STUDY_PER_DAY } = await import("../src/lib/data-stories/writer");
const { tryModels } = await import("../src/lib/stories/writer");
const { AI_MODELS } = await import("../src/lib/ai-models");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { jobs, known } = await studyJobs();
const j = jobs.find(x => x.slug === SLUG);
if (!j) throw new Error("study not found");
const io = studyIO(supabaseAdmin), day = new Date().toISOString().slice(0, 10);
const used = callsOn(await io.metas(jobs.map(x => x.slug)), day);
if (used >= STUDY_PER_DAY) { console.log(JSON.stringify({ skipped: "study allowance used today", used })); process.exit(0); }
let calls = 0;
const r = await tryModels([AI_MODELS.writer], (model, failures) => io.call(model, j.sheet, failures, AbortSignal.timeout(170_000)), parseStudy, t => checkStudyText(t, j.sheet, known), m => { if (calls >= 1 || !io.runs(m)) return false; calls++; return true; });
const t = r.text ?? j.fallback;
await io.insert({ slug: j.slug, facts_hash: j.hash, headline: t.headline, deck: t.deck, opening: t.opening, scenes: t.scenes, use_text: r.text ? t.use || null : null, model: r.text ? r.model : "template",
  checked_at: r.text ? new Date().toISOString() : null, attempts: r.attempts, cost: Math.round(r.cost * 1e6) / 1e6, failures: r.failures.slice(0, 16), log: r.log });
console.log(JSON.stringify({ calls, used_before: used, checked: !!r.text, model: r.model, cost: r.cost, failures: r.failures, headline: t.headline, deck: t.deck, opening: t.opening, scenes: t.scenes, use: r.text ? t.use : null }, null, 1));
const { writeRecords } = await import("../src/lib/records/store.server"), { pageKey } = await import("../src/lib/records/records");
console.log("records", await writeRecords([{ key: pageKey("data-story", j.slug), body: await computeDataStory(j.slug), source: "i3b-study4" }, { key: pageKey("data-index"), body: await computeDataIndex(), source: "i3b-study4" }]));
process.exit(0);
