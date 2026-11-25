// E5 · the digest writer's I/O. A closed week's issue is written once after the week ends and again only when its facts sheet changes
// within REWRITE_DAYS (a story retired, a new story dated into the week); at most DIGEST_PER_DAY calls a day in all, counted from
// digest_texts apart from the story writer's twelve and the studies' four, through the story writer's own budget-guarded gateway call
// under the same cost-ledger purpose. The plan is the shared one (writer, writer again with its failures, text model) carried across
// days for one sheet; one insert-only version per attempt. Injected I/O so tests run in memory; nothing here ever throws into a job.
import { pagedRows } from "../paged";
import { AI_MODELS } from "../ai-models";
import { retryGuard, structuredAttempts } from "../ai-retries";
import { WRITER_PLAN, tryModels, type Attempt, type Known } from "../stories/writer";
import { gatewayCall, providerCanRun } from "../stories/writer.server";
import { DIGEST_PER_DAY, DIGEST_SCHEMA, DIGEST_SYSTEM, DIGEST_TOOL, REWRITE_DAYS, checkDigestText, digestUser, parseDigest, type DigestSheet, type DigestWritten } from "./writer";
import { weekRange } from "./week";

export type DigestInsert = { week: string; facts_hash: string; headline: string; deck: string; argument: string[]; changes: string[]; chart_caption: string | null; use_text: string | null; model: string; passed: boolean; checked_at: string | null; attempts: number; cost: number; failures: string[]; log: Attempt[] };
export type DigestMeta = { week: string; facts_hash: string; passed: boolean; created_at: string; attempts: number; failures: string[] | null; log: unknown };
export type DigestIO = {
  metas: (weeks: string[]) => Promise<DigestMeta[]>;
  runs: (model: string) => boolean;
  call: (model: string, sheet: DigestSheet, failures: string[], signal: AbortSignal) => Promise<{ raw: unknown; cost: number; refused?: boolean } | null>;
  insert: (row: DigestInsert) => Promise<boolean>;
};
export type DigestJob = { week: string; sheet: DigestSheet; hash: string; subject: string[]; fallback: DigestWritten };
export const DIGEST_CALL_MIN_MS = 25_000;
const dayOf = (iso: string) => iso.slice(0, 10);
const logOf = (m: DigestMeta): Attempt[] => (Array.isArray(m.log) ? (m.log as Attempt[]).filter(x => x && typeof x.model === "string") : []);
export const callsOn = (metas: readonly DigestMeta[], day: string) => metas.filter(m => dayOf(m.created_at) === day).reduce((a, m) => a + (m.attempts ?? 0), 0);
export const writerCallsOn = (metas: readonly DigestMeta[], day: string) => metas.filter(m => dayOf(m.created_at) === day).reduce((a, m) => a + logOf(m).filter(x => x.model === AI_MODELS.writer).length, 0);
/** Calls already spent on this sheet (every stored attempt for this week and fingerprint). */
export const spentOn = (metas: readonly DigestMeta[], week: string, hash: string) => {
  const mine = metas.filter(m => m.week === week && m.facts_hash === hash);
  // T2 · D: answers not in the fixed shape count against RETRIES.writer across runs too; once spent, nothing more is called for this sheet.
  const unusable = mine.reduce((a, m) => a + logOf(m).filter(x => Array.isArray(x.failures) && x.failures.includes("no usable answer")).length, 0);
  return unusable >= structuredAttempts("writer") ? WRITER_PLAN.length : mine.reduce((a, m) => a + (m.attempts ?? 0), 0);
};
/** The rest of the shared plan for this sheet: the writer, the writer again with its failures, then the text model; nothing after that. */
export const planFor = (spent: number): readonly string[] => WRITER_PLAN.slice(Math.min(spent, WRITER_PLAN.length));
/** Owed a text: the week has closed and is still within REWRITE_DAYS of its end, no version passed from this sheet, and the plan for
 *  this sheet is not used up (the two-a-day cap is applied by the caller). */
export function owed(job: { week: string; hash: string }, metas: readonly DigestMeta[], now: number): boolean {
  const r = weekRange(job.week); if (!r) return false;
  const end = Date.parse(r.endIso), mine = metas.filter(m => m.week === job.week);
  if (now < end || now > end + REWRITE_DAYS * 864e5) return false;
  if (mine.some(m => m.facts_hash === job.hash && m.passed)) return false;
  return planFor(spentOn(metas, job.week, job.hash)).length > 0;
}
export type DigestResult = { tried: string[]; rows: DigestInsert[]; calls: number; skipped: number };
export async function writeDigests(jobs: DigestJob[], io: DigestIO, known: Known, o: { deadline: number; now?: () => number; perDay?: number }): Promise<DigestResult> {
  const clock = o.now ?? Date.now, day = new Date(clock()).toISOString().slice(0, 10), cap = Math.min(o.perDay ?? DIGEST_PER_DAY, DIGEST_PER_DAY);
  const metas = await io.metas(jobs.map(j => j.week)).catch(() => null);
  const out: DigestResult = { tried: [], rows: [], calls: 0, skipped: 0 };
  if (!metas) { out.skipped = jobs.length; return out; }
  const used = callsOn(metas, day);
  // The newest week first: it is the issue on /digest.
  for (const j of [...jobs].sort((a, b) => b.week.localeCompare(a.week))) {
    if (!owed(j, metas, clock()) || used + out.calls >= cap || o.deadline - clock() < DIGEST_CALL_MIN_MS) { out.skipped++; continue; }
    const prior = metas.filter(m => m.week === j.week && m.facts_hash === j.hash).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.failures ?? [];
    const canCall = (model: string) => { if (!io.runs(model) || used + out.calls >= cap || o.deadline - clock() < DIGEST_CALL_MIN_MS) return false; out.calls++; return true; };
    const g = retryGuard("writer", parseDigest);
    const r = await tryModels(planFor(spentOn(metas, j.week, j.hash)), (model, failures) => g.call(io.call(model, j.sheet, failures.length ? failures : prior, AbortSignal.timeout(Math.max(1000, o.deadline - clock() - 2000)))),
      parseDigest, t => checkDigestText(t, j.sheet, j.subject, known), m => g.open() && canCall(m));
    if (!r.attempts) { out.skipped++; continue; }
    out.tried.push(j.week);
    const t = r.text ?? j.fallback;
    const row: DigestInsert = { week: j.week, facts_hash: j.hash, headline: t.headline, deck: t.deck, argument: t.argument, changes: t.changes, chart_caption: t.chart_caption || null, use_text: r.text ? t.use || null : null,
      model: r.text ? r.model : "template", passed: !!r.text, checked_at: r.text ? new Date(clock()).toISOString() : null, attempts: r.attempts, cost: Math.round(r.cost * 1e6) / 1e6, failures: r.failures.slice(0, 16), log: r.log };
    if (await io.insert(row).catch(() => false)) out.rows.push(row);
  }
  return out;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const META_COLS = "week,facts_hash,passed,created_at,attempts,failures,log";
/** Writer-model calls the digest writer made today (the story writer subtracts these from the shared ledger count). */
export async function digestWriterCallsToday(admin: Pick<Admin, "from">): Promise<number> {
  const { data, error } = await admin.from("digest_texts").select(META_COLS).gte("created_at", dayStart());
  if (error) throw new Error("digest_texts_read_failed");
  return writerCallsOn((data ?? []) as DigestMeta[], dayStart().slice(0, 10));
}
export function digestIO(admin: Admin): DigestIO {
  return {
    metas: async weeks => {
      const ok = weeks.filter(w => /^\d{4}-W\d{2}$/.test(w));
      if (!ok.length) return [];
      const { data, error } = await admin.from("digest_texts").select(META_COLS).in("week", ok).order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error("digest_texts_read_failed");
      return (data ?? []) as DigestMeta[];
    },
    runs: providerCanRun,
    call: (model, sheet, failures, signal) => gatewayCall(admin, { model, system: DIGEST_SYSTEM, user: digestUser(sheet, failures), schema: DIGEST_SCHEMA as unknown as Record<string, unknown>, schemaName: "digest_text", tool: DIGEST_TOOL, maxTokens: 4000, textMaxTokens: 2500 }, signal),
    insert: async row => { const { error } = await admin.from("digest_texts").insert(row as never); if (error) throw new Error("digest_texts_insert_failed"); return true; },
  };
}
/** The writable jobs: closed weeks still inside REWRITE_DAYS, each with its sheet, fingerprint and fallback. */
export async function digestJobs(now = Date.now()): Promise<{ jobs: DigestJob[]; known: Known }> {
  const [{ latestIssueWeeks, issueJob }, { seededNames }, { supabaseAnon }] = await Promise.all([import("./digest.server"), import("../brand-names"), import("../mcp/supabase")]);
  const weeks = (await latestIssueWeeks(3)).filter(w => { const r = weekRange(w); return !!r && now <= Date.parse(r.endIso) + REWRITE_DAYS * 864e5; });
  const jobs: DigestJob[] = [];
  for (const w of weeks) {
    const j = await issueJob(w).catch(() => null);
    if (!j) continue;
    const f = j.parts.fallback;
    jobs.push({ week: w, sheet: j.sheet, hash: j.edition.hash, subject: j.edition.cover.terms, fallback: { headline: f.headline, deck: f.deck, argument: f.argument, changes: f.changes, chart_caption: f.chart_caption ?? "", use: "" } });
  }
  const sites = await pagedRows((f, t) => supabaseAnon().from("library_sites").select("name").not("name", "is", null).order("domain").range(f, t));
  return { jobs, known: { names: [...new Set([...seededNames(), ...((sites.data ?? []) as { name: string | null }[]).map(s => s.name).filter((n): n is string => !!n)])] } };
}
/** The end of a job: write what is owed while the time allows, then rewrite the issue records that got a checked text. Never throws. */
export const DIGEST_LOOK_MS = 30 * 60_000;
let lastLook = 0;
export async function runDigestWriter(job: string, deadline: number): Promise<DigestResult | null> {
  try {
    const now = Date.now();
    if (deadline - now < DIGEST_CALL_MIN_MS || now - lastLook < DIGEST_LOOK_MS) return null;
    lastLook = now;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = await supabaseAdmin.from("digest_texts").select(META_COLS).gte("created_at", dayStart());
    if (today.error || callsOn((today.data ?? []) as DigestMeta[], dayStart().slice(0, 10)) >= DIGEST_PER_DAY) return null;
    const { jobs, known } = await digestJobs(now);
    const r = await writeDigests(jobs, digestIO(supabaseAdmin), known, { deadline });
    if (r.rows.some(x => x.passed)) await writeIssueRecords([...new Set(r.rows.filter(x => x.passed).map(x => x.week))], job);
    console.info("digest writer", job, { tried: r.tried, calls: r.calls, passed: r.rows.filter(x => x.passed).length, skipped: r.skipped });
    return r;
  } catch (e) { console.error("digest writer failed", job, e instanceof Error ? e.message.slice(0, 80) : "UnknownError"); return null; }
}
/** Rewrite the stored issue records for these weeks (no model call). */
export async function writeIssueRecords(weeks: string[], source: string): Promise<string[]> {
  const [{ pageKey }, { writeRecords }, { computeIssue }] = await Promise.all([import("../records/records"), import("../records/store.server"), import("./digest.server")]);
  const bodies = await Promise.all(weeks.map(async w => ({ key: pageKey("digest", w), body: await computeIssue(w), source })));
  return writeRecords(bodies.filter(b => b.body)).catch(() => []);
}
