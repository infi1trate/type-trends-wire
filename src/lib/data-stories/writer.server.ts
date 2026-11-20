// E4 · the study writer's I/O: at most once a day per study and only when its facts sheet changed, at most STUDY_PER_DAY calls a day in
// all (counted from study_texts, apart from the story writer's twelve), through the story writer's own budget-guarded gateway call
// under the same cost-ledger purpose; one insert-only version per attempt. The orchestration takes injected I/O so tests run in memory;
// nothing here ever throws into a job.
import { AI_MODELS } from "../ai-models";
import { WRITER_PLAN, tryModels, type Attempt, type Known } from "../stories/writer";
import { gatewayCall, providerCanRun } from "../stories/writer.server";
import { STUDY_PER_DAY, STUDY_SCHEMA, STUDY_SYSTEM, STUDY_TOOL, checkStudyText, parseStudy, studyUser, type FactsSheet, type StudyWritten } from "./writer";

export type StudyInsert = { slug: string; facts_hash: string; headline: string; deck: string; opening: string; scenes: { lead: string; body: string }[]; use_text: string | null; model: string; checked_at: string | null; attempts: number; cost: number; failures: string[]; log: Attempt[] };
export type StudyMeta = { slug: string; facts_hash: string; checked_at: string | null; created_at: string; attempts: number; log: unknown };
export type StudyIO = {
  /** Every stored version's meta for these studies (checked or not; service role). */
  metas: (slugs: string[]) => Promise<StudyMeta[]>;
  runs: (model: string) => boolean;
  call: (model: string, sheet: FactsSheet, failures: string[], signal: AbortSignal) => Promise<{ raw: unknown; cost: number } | null>;
  insert: (row: StudyInsert) => Promise<boolean>;
};
export type StudyJob = { slug: string; number: number; sheet: FactsSheet; hash: string; fallback: StudyWritten };
/** Leave this long before the deadline unused: a study call is longer than a story's. */
export const STUDY_CALL_MIN_MS = 25_000;
const dayOf = (iso: string) => iso.slice(0, 10);
/** A PostgREST `or` filter matching these studies (registry slugs are lowercase letters and hyphens only). */
export const slugOr = (slugs: readonly string[]) => slugs.filter(s => /^[a-z0-9-]+$/.test(s)).map(s => `slug.eq.${s}`).join(",");
/** Study calls made on a UTC day: every attempt stored that day. */
export const callsOn = (metas: readonly StudyMeta[], day: string) => metas.filter(m => dayOf(m.created_at) === day).reduce((a, m) => a + (m.attempts ?? 0), 0);
/** Writer-model calls among them (the story writer's daily count leaves these out). */
export const writerCallsOn = (metas: readonly StudyMeta[], day: string) => metas.filter(m => dayOf(m.created_at) === day).reduce((a, m) => a + (Array.isArray(m.log) ? m.log.filter(x => (x as { model?: unknown })?.model === AI_MODELS.writer).length : 0), 0);
/** A study is owed a text when no checked version was written from its current sheet and nothing was tried for it today. */
export function owed(job: { slug: string; hash: string }, metas: readonly StudyMeta[], day: string): boolean {
  const mine = metas.filter(m => m.slug === job.slug);
  return !mine.some(m => m.facts_hash === job.hash && m.checked_at) && !mine.some(m => dayOf(m.created_at) === day);
}
/** Studies with no checked text at all first, then by number. */
export function writeOrder(jobs: readonly StudyJob[], metas: readonly StudyMeta[]): StudyJob[] {
  const has = (slug: string) => metas.some(m => m.slug === slug && m.checked_at);
  return [...jobs].sort((a, b) => Number(has(a.slug)) - Number(has(b.slug)) || a.number - b.number);
}
export type StudyResult = { tried: string[]; rows: StudyInsert[]; calls: number; skipped: number };
export async function writeStudies(jobs: StudyJob[], io: StudyIO, known: Known, o: { deadline: number; now?: () => number; perDay?: number }): Promise<StudyResult> {
  const clock = o.now ?? Date.now, day = new Date(clock()).toISOString().slice(0, 10), cap = Math.min(o.perDay ?? STUDY_PER_DAY, STUDY_PER_DAY);
  const metas = await io.metas(jobs.map(j => j.slug)).catch(() => null);
  const out: StudyResult = { tried: [], rows: [], calls: 0, skipped: 0 };
  if (!metas) { out.skipped = jobs.length; return out; }
  const used = callsOn(metas, day);
  for (const j of writeOrder(jobs, metas)) {
    if (!owed(j, metas, day)) { out.skipped++; continue; }
    if (used + out.calls >= cap || o.deadline - clock() < STUDY_CALL_MIN_MS) { out.skipped++; continue; }
    const canCall = (model: string) => { if (!io.runs(model) || used + out.calls >= cap || o.deadline - clock() < STUDY_CALL_MIN_MS) return false; out.calls++; return true; };
    const r = await tryModels(WRITER_PLAN, (model, failures) => io.call(model, j.sheet, failures, AbortSignal.timeout(Math.max(1000, o.deadline - clock() - 2000))), parseStudy, t => checkStudyText(t, j.sheet, known), canCall);
    if (!r.attempts) { out.skipped++; continue; }
    out.tried.push(j.slug);
    const t = r.text ?? j.fallback;
    const row: StudyInsert = { slug: j.slug, facts_hash: j.hash, headline: t.headline, deck: t.deck, opening: t.opening, scenes: t.scenes, use_text: r.text ? t.use || null : null, model: r.text ? r.model : "template",
      checked_at: r.text ? new Date(clock()).toISOString() : null, attempts: r.attempts, cost: Math.round(r.cost * 1e6) / 1e6, failures: r.failures.slice(0, 16), log: r.log };
    if (await io.insert(row).catch(() => false)) out.rows.push(row);
  }
  return out;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
/** Writer-model calls the study writer made today (the story writer subtracts these from the shared ledger count). */
export async function studyWriterCallsToday(admin: Pick<Admin, "from">): Promise<number> {
  const { data, error } = await admin.from("study_texts").select("slug,facts_hash,checked_at,created_at,attempts,log").gte("created_at", dayStart());
  if (error) throw new Error("study_texts_read_failed");
  return writerCallsOn((data ?? []) as StudyMeta[], dayStart().slice(0, 10));
}
export function studyIO(admin: Admin): StudyIO {
  return {
    metas: async slugs => {
      const { data, error } = await admin.from("study_texts").select("slug,facts_hash,checked_at,created_at,attempts,log").or(slugOr(slugs)).order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error("study_texts_read_failed");
      return (data ?? []) as StudyMeta[];
    },
    runs: providerCanRun,
    call: (model, sheet, failures, signal) => gatewayCall(admin, { model, system: STUDY_SYSTEM, user: studyUser(sheet, failures), schema: STUDY_SCHEMA as unknown as Record<string, unknown>, schemaName: "study_text", tool: STUDY_TOOL, maxTokens: 4000, textMaxTokens: 2500 }, signal),
    insert: async row => { const { error } = await admin.from("study_texts").insert(row as never); if (error) throw new Error("study_texts_insert_failed"); return true; },
  };
}

/** The end of a job: write what is owed while the time allows, then rewrite the pages that got a checked text. Never throws. */
// Loading the sheets reads the whole study input, so an isolate looks at most every STUDY_LOOK_MS, and not at all once the day's calls are used.
export const STUDY_LOOK_MS = 30 * 60_000;
let lastLook = 0;
export async function runStudyWriter(job: string, deadline: number): Promise<StudyResult | null> {
  try {
    const now = Date.now();
    if (deadline - now < STUDY_CALL_MIN_MS || now - lastLook < STUDY_LOOK_MS) return null;
    lastLook = now;
    const [{ supabaseAdmin }, { studyJobs }] = await Promise.all([import("@/integrations/supabase/client.server"), import("./page.server")]);
    const today = await supabaseAdmin.from("study_texts").select("slug,facts_hash,checked_at,created_at,attempts,log").gte("created_at", dayStart());
    if (today.error || callsOn((today.data ?? []) as StudyMeta[], dayStart().slice(0, 10)) >= STUDY_PER_DAY) return null;
    const { jobs, known } = await studyJobs();
    const r = await writeStudies(jobs, studyIO(supabaseAdmin), known, { deadline });
    if (r.rows.some(x => x.checked_at)) {
      const [{ pageKey }, { writeRecords }, page] = await Promise.all([import("../records/records"), import("../records/store.server"), import("./page.server")]);
      const done = [...new Set(r.rows.filter(x => x.checked_at).map(x => x.slug))];
      const bodies = await Promise.all(done.map(async s => ({ key: pageKey("data-story", s), body: await page.computeDataStory(s), source: job })));
      await writeRecords([...bodies, { key: pageKey("data-index"), body: await page.computeDataIndex(), source: job }]).catch(() => []);
    }
    console.info("study writer", job, { tried: r.tried, calls: r.calls, checked: r.rows.filter(x => x.checked_at).length, skipped: r.skipped });
    return r;
  } catch (e) { console.error("study writer failed", job, e instanceof Error ? e.message.slice(0, 80) : "UnknownError"); return null; }
}
