// D1 · the database guard's one read (rules in db-guard.ts): the key of one stored page, by primary key, anonymous, cut at
// PROBE_LIMIT_MS. Never throws. Readings stay on this server instance for health.
import { PROBE_LIMIT_MS, PROBE_REUSE_MS, keepRecent, type Probe } from "./db-guard";

let recent: Probe[] = [];
let inFlight: Promise<Probe> | null = null;
const underTest = () => typeof process !== "undefined" && !!process.env["VITEST"];

export const probeHistory = (): readonly Probe[] => recent;
/** Tests only: set the readings (and so the next answer). */
export function setProbesForTest(list: Probe[]): void { recent = list; }

async function read(): Promise<Probe> {
  // D1c · the second is the database's: loading this server's modules and client happens before the clock starts (on a just-started
  // server it took part of the second at 13:01 UTC on 23 Nov, while every other write that minute answered in ~200 ms).
  let client: ReturnType<(typeof import("./mcp/supabase"))["supabaseAnon"]>;
  try {
    if (import.meta.env.DEV && await (await import("./dev-late.server")).devDbDown()) return { at: Date.now(), ms: PROBE_LIMIT_MS, ok: false };
    client = (await import("./mcp/supabase")).supabaseAnon();
  } catch { return { at: Date.now(), ms: 0, ok: false }; }
  const t0 = Date.now();
  try {
    const { error } = await client.from("read_records").select("key").limit(1).abortSignal(AbortSignal.timeout(PROBE_LIMIT_MS));
    const ms = Date.now() - t0;
    return { at: t0, ms, ok: !error && ms < PROBE_LIMIT_MS };
  } catch { return { at: t0, ms: Date.now() - t0, ok: false }; }
}
/** D1c · this server's first reading also opens its first connection to the database; when that one misses, one more read decides
 *  (a slow database misses both). Later readings are single, as before. */
async function once(): Promise<Probe> {
  const first = !recent.length, p = await read();
  return p.ok || !first ? p : read();
}
/** Whether the database answered within a second (a reading under five seconds old is reused). Under test, "ok" unless set. */
export async function probeDb(): Promise<Probe> {
  const now = Date.now(), last = recent.at(-1);
  if (underTest()) return last ?? { at: now, ms: 0, ok: true };
  if (last && now - last.at < PROBE_REUSE_MS) return last;
  if (!inFlight) inFlight = once().then(async p => {
    recent = keepRecent(recent, p, Date.now());
    // D1 Part 6 · each reading moves this server's safe mode (capped so the answer is never held behind its log write).
    await Promise.race([import("./safe-mode.server").then(m => m.observeReading(recent, p)), new Promise(r => setTimeout(r, 1_200))]).catch(() => undefined);
    return p;
  }).finally(() => { inFlight = null; });
  return inFlight;
}
