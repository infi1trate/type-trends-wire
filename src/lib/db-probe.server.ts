// D1 · the database guard's one read (rules in db-guard.ts): the key of one stored page, by primary key, anonymous, cut at
// PROBE_LIMIT_MS. Never throws. Readings stay on this server instance for health.
import { PROBE_LIMIT_MS, PROBE_REUSE_MS, keepRecent, type Probe } from "./db-guard";

let recent: Probe[] = [];
let inFlight: Promise<Probe> | null = null;
const underTest = () => typeof process !== "undefined" && !!process.env["VITEST"];

export const probeHistory = (): readonly Probe[] => recent;
/** Tests only: set the readings (and so the next answer). */
export function setProbesForTest(list: Probe[]): void { recent = list; }

async function once(): Promise<Probe> {
  const t0 = Date.now();
  try {
    if (import.meta.env.DEV && await (await import("./dev-late.server")).devDbDown()) return { at: t0, ms: PROBE_LIMIT_MS, ok: false };
    const { supabaseAnon } = await import("./mcp/supabase");
    const { error } = await supabaseAnon().from("read_records").select("key").limit(1).abortSignal(AbortSignal.timeout(PROBE_LIMIT_MS));
    const ms = Date.now() - t0;
    return { at: t0, ms, ok: !error && ms < PROBE_LIMIT_MS };
  } catch { return { at: t0, ms: Date.now() - t0, ok: false }; }
}
/** Whether the database answered within a second (a reading under five seconds old is reused). Under test, "ok" unless set. */
export async function probeDb(): Promise<Probe> {
  const now = Date.now(), last = recent.at(-1);
  if (underTest()) return last ?? { at: now, ms: 0, ok: true };
  if (last && now - last.at < PROBE_REUSE_MS) return last;
  if (!inFlight) inFlight = once().then(p => { recent = keepRecent(recent, p, Date.now()); return p; }).finally(() => { inFlight = null; });
  return inFlight;
}
