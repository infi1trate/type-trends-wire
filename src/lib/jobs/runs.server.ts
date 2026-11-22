// N4c · writing job runs (rules in runs.ts): a start row before the job's work, one finish row after. Writing a row never fails the job:
// a failed write is logged by name and the job carries on. Service role only.
import { runNote, type RunJob, type RunRow } from "./runs";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const underTest = () => typeof process !== "undefined" && !!process.env["VITEST"];
const admin = async (): Promise<Admin> => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export type RunHandle = { id: number | null; job: RunJob; t0: number; finish: (ok: boolean, note?: string | null, detail?: unknown) => Promise<void> };
/** Writes the start row (with an optional unique slot and items) and returns the handle that writes the finish row once. */
export async function startRun(job: RunJob, o: { note?: string | null; slot?: string; items?: string[]; db?: Admin } = {}): Promise<RunHandle & { slotTaken?: boolean }> {
  const t0 = Date.now();
  let id: number | null = null, slotTaken = false;
  // Never from the test suite: tests drive the job handlers with fakes, and job_runs is the live record (shared database).
  if (!o.db && underTest()) return { id: null, job, t0, finish: async () => {}, slotTaken };
  try {
    const db = o.db ?? await admin();
    const { data, error } = await db.from("job_runs").insert({ job, phase: "start", note: runNote(o.note), ...(o.slot ? { slot: o.slot } : {}), ...(o.items ? { items: o.items as never } : {}) }).select("id").single();
    if (error) { slotTaken = error.code === "23505"; if (!slotTaken) console.error("job run start failed", job, error.code); } else id = data?.id ?? null;
  } catch { console.error("job run start failed", job); }
  let done = false;
  const finish = async (ok: boolean, note?: string | null, detail?: unknown) => {
    if (done || id == null) return; done = true;
    try {
      const db = o.db ?? await admin();
      const { error } = await db.from("job_runs").insert({ job, phase: "finish", start_id: id, ok, ms: Math.max(0, Date.now() - t0), note: runNote(note), ...(detail !== undefined ? { detail: detail as never } : {}) });
      if (error) console.error("job run finish failed", job, error.code);
    } catch { console.error("job run finish failed", job); }
  };
  return { id, job, t0, finish, slotTaken };
}
/** Runs `work` between a start and a finish row; the finish row says whether it threw and the note `noteOf` makes of its result. */
export async function withRun<T>(job: RunJob, work: () => Promise<T>, noteOf: (r: T) => { ok?: boolean; note?: string | null } = () => ({}), start: { note?: string | null } = {}): Promise<T> {
  const h = await startRun(job, start);
  try { const r = await work(); const n = noteOf(r); await h.finish(n.ok ?? true, n.note ?? null); return r; }
  catch (e) { await h.finish(false, e instanceof Error ? e.message.slice(0, 120) : "error"); throw e; }
}
/** The last `days` of run rows (oldest first), for the health run and /desk. */
export async function loadRunRows(db: Admin, o: { days: number; now?: number }): Promise<RunRow[]> {
  const since = new Date((o.now ?? Date.now()) - o.days * 864e5).toISOString(), out: RunRow[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await db.from("job_runs").select("id,at,job,phase,start_id,ok,ms,note").gte("at", since).order("id").range(from, from + 999);
    if (error) throw new Error("job_runs_read_failed");
    out.push(...((data ?? []) as RunRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
