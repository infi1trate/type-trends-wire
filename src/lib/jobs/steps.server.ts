// Follow-up step queue IO: queue a run's remaining work, and advance one step per scheduled call within its budget.
// The store is injectable so tests run in memory; the default uses the service role (scheduled callbacks only).
import { FOLLOW_UP_START_MS, STEP_LEASE_MS, nextStep, queueRows, type StepRow } from "./steps";

export type StepStore = {
  open(): Promise<StepRow[]>;
  insert(rows: StepRow[]): Promise<void>;
  /** Atomically mark a step running (only if it is still pending, or running with an expired lease). True when this call won it. */
  claim(row: StepRow, nowIso: string, leaseIso: string): Promise<boolean>;
  finish(row: StepRow, status: "done" | "error", nowIso: string, detail: string | null): Promise<void>;
};
export type StepRunner = (runKey: string) => Promise<unknown>;
export type AdvanceResult = { step: string; run_key: string; status: "done" | "error" | "given_up" } | { idle: true; reason: "no_open_steps" | "busy" | "late_start" | "lost_claim" };

const short = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).replace(/\s+/g, " ").slice(0, 280);

export async function queueFollowUps(job: string, runKey: string, steps: readonly string[], store?: StepStore): Promise<string[]> {
  const db = store ?? (await adminStepStore());
  await db.insert(queueRows(job, runKey, steps, new Date().toISOString()));
  return [...steps];
}

/** Run at most one follow-up step, and only if the carrier call started less than FOLLOW_UP_START_MS ago. Never throws. */
export async function advanceFollowUps(callStartedAt: number, runners: Record<string, Record<string, StepRunner>>, store?: StepStore, now: () => number = Date.now): Promise<AdvanceResult> {
  try {
    if (now() - callStartedAt >= FOLLOW_UP_START_MS) return { idle: true, reason: "late_start" };
    const db = store ?? (await adminStepStore());
    const plan = nextStep(await db.open(), now());
    if (!plan) return { idle: true, reason: "no_open_steps" };
    const { row } = plan, iso = new Date(now()).toISOString();
    if (plan.action === "give_up") { await db.finish(row, "error", iso, "cut off on every attempt"); return { step: row.step, run_key: row.run_key, status: "given_up" }; }
    if (!await db.claim(row, iso, new Date(now() + STEP_LEASE_MS).toISOString())) return { idle: true, reason: "lost_claim" };
    const run = runners[row.job]?.[row.step];
    if (!run) { await db.finish(row, "error", iso, "no runner for this step"); return { step: row.step, run_key: row.run_key, status: "error" }; }
    // N4c · the step's run row (start before, finish after; not when a test injects its own store).
    const jr = store ? null : await (await import("./runs.server")).startRun("follow-up", { note: `${row.job} ${row.step} ${row.run_key}` });
    try {
      const out = await run(row.run_key);
      const failed = !!out && typeof out === "object" && (out as { ok?: unknown }).ok === false;
      const code = failed ? String((out as { code?: unknown }).code ?? "failed").slice(0, 280) : null;
      await db.finish(row, failed ? "error" : "done", new Date(now()).toISOString(), code);
      await jr?.finish(!failed, `${row.job} ${row.step} ${row.run_key}${code ? `: ${code}` : ""}`);
      return { step: row.step, run_key: row.run_key, status: failed ? "error" : "done" };
    } catch (e) {
      await db.finish(row, "error", new Date(now()).toISOString(), short(e));
      await jr?.finish(false, `${row.job} ${row.step} ${row.run_key}: ${short(e)}`);
      return { step: row.step, run_key: row.run_key, status: "error" };
    }
  } catch (e) {
    console.error("follow-up step failed", e instanceof Error ? e.name : "UnknownError");
    return { idle: true, reason: "busy" };
  }
}

/** The weekly forecast's follow-ups, each the same call the single long request used to make. */
export const forecastRunners: Record<string, StepRunner> = {
  "designer-kit": async () => (await import("../designer-kit-refresh.server")).refreshDesignerKit(),
  // J1 · structure records and counts from new HOME captures (no AI; resumes from its bookmark).
  // B2 · then the lead-and-lag counts and (Y1) the evidence desk's dossiers (stored site history, no AI); a failure there never fails the structure step.
  structure: async () => { const s = await (await import("../structure.server")).refreshStructure(); const leadlag = await (await import("../leadlag.server")).refreshLeadLag().catch(() => ({ ok: false, code: "leadlag_failed" })); const evidence = await (await import("../evidence/evidence.server")).buildDossiers().catch(() => ({ built: 0, error: "evidence_failed" })); return { ...s, leadlag, evidence }; },
  taste: async () => { const { refreshTaste } = await import("../taste/refresh.server"); await refreshTaste(); return { ok: true }; },
  brief: async k => (await import("../forecast-brief.server")).generateWeeklyBrief(Number(k)),
  vibe: async k => (await import("../vibe.server")).computeVibe(Number(k)),
  chart: async () => (await import("../chart/chart.server")).generateChartCard(),
  ledger: async k => { const { nonFatal } = await import("../ledger/ledger"); return nonFatal("ledger", async () => (await import("../ledger/store.server")).ledgerStep(Number(k))); },
  stories: async k => { const { buildStories, BUILD_BUDGET_MS } = await import("../stories/build.server"); const r = await buildStories({ realRunIds: [Number(k)], budgetMs: BUILD_BUDGET_MS }); return { ok: true, inserted: r.inserted, timed_out: r.timed_out }; },
};

async function adminStepStore(): Promise<StepStore> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const must = (r: { error: unknown }) => { if (r.error) throw new Error("job_steps write failed"); };
  return {
    async open() {
      const r = await db.from("job_steps").select("*").in("status", ["pending", "running"]).order("queued_at").limit(50);
      if (r.error) throw new Error("job_steps read failed");
      const keys = [...new Set((r.data ?? []).map(x => `${x.job}|${x.run_key}`))];
      if (!keys.length) return [];
      // Whole runs, so step order can be checked against finished steps too.
      const all = await db.from("job_steps").select("*").in("run_key", [...new Set((r.data ?? []).map(x => x.run_key))]);
      if (all.error) throw new Error("job_steps read failed");
      return (all.data ?? []).filter(x => keys.includes(`${x.job}|${x.run_key}`)) as StepRow[];
    },
    async insert(rows) { must(await db.from("job_steps").upsert(rows, { onConflict: "job,run_key,step", ignoreDuplicates: true })); },
    async claim(row, nowIso, leaseIso) {
      const r = await db.from("job_steps").update({ status: "running", started_at: nowIso, lease_until: leaseIso, attempts: row.attempts + 1 })
        .eq("job", row.job).eq("run_key", row.run_key).eq("step", row.step).eq("attempts", row.attempts)
        .or(`status.eq.pending,and(status.eq.running,lease_until.lt.${nowIso})`).select("step");
      if (r.error) throw new Error("job_steps claim failed");
      return (r.data ?? []).length === 1;
    },
    async finish(row, status, nowIso, detail) { must(await db.from("job_steps").update({ status, finished_at: nowIso, lease_until: null, detail }).eq("job", row.job).eq("run_key", row.run_key).eq("step", row.step)); },
  };
}
