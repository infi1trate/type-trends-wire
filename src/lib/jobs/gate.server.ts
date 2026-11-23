// D1 Part 4 · every scheduled job asks the database guard first (one read, one-second limit). A slow database means the job stands
// down at once and records "skipped: database slow" (best effort, itself cut at a second), so jobs never queue up behind a slow
// database. Never throws. Under test it always lets the job run unless a reading was set (db-probe.server).
import type { RunJob } from "./runs";
import { SKIPPED_SLOW } from "../db-guard";

export type GateDeps = { probe?: () => Promise<{ ok: boolean; ms: number }>; record?: (job: RunJob, note: string) => Promise<void>; safe?: () => Promise<{ on: boolean; why: string }> };
async function recordSkip(job: RunJob, note: string): Promise<void> {
  const { startRun } = await import("./runs.server");
  const run = await startRun(job, { note });
  await run.finish(true, note);
}
/** The reason the job must stand down now, or null when it may run. `wire`: the wire ingest still runs in safe mode (Part 6). */
export async function standDown(job: RunJob | null, o: { wire?: boolean } & GateDeps = {}): Promise<string | null> {
  try {
    const probe = o.probe ?? (async () => (await import("../db-probe.server")).probeDb());
    const p = await probe();
    let why: string | null = null;
    if (!p.ok) why = `${SKIPPED_SLOW} (no answer within ${Math.round(p.ms)} ms)`;
    else if (!o.wire && o.safe) { const s = await o.safe(); if (s.on) why = `skipped: safe mode (${s.why})`; }
    if (!why) return null;
    console.info("job stood down", job ?? "unrecorded job", why);
    if (!job) return why;
    const record = o.record ?? recordSkip;
    await Promise.race([record(job, why).catch(() => undefined), new Promise(r => setTimeout(r, 1_000))]);
    return why;
  } catch { return null; }
}
/** The answer a scheduled caller gets from a job that stood down (200: nothing failed, nothing to retry). */
export const stoodDown = (why: string) => Response.json({ ran: false, why }, { headers: { "cache-control": "no-store" } });
