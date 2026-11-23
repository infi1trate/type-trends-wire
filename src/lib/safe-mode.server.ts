// D1 Part 6 · SAFE MODE, per server instance (rules in db-health.ts). Each database reading moves it; while on, crawler posts are
// refused with "try later", every job but the wire stands down, and readers get last good copies. Each change is logged (time, actor,
// reason, reading) to the service-role db_safe_mode table, best effort: a change made while the database is down waits in memory and
// is written, with its own time, once a reading is good again. The owner's switch is the newest owner row (read at most every 30 s).
import { answerLine, nextSafeMode, SAFE_OFF, type SafeMode } from "./db-health";
import type { Probe } from "./db-guard";

let state: SafeMode = { ...SAFE_OFF };
let owner: { on: boolean; why: string; at: number } | null = null;
let pending: { at: string; is_on: boolean; actor: "auto" | "owner"; reason: string; reading: Record<string, unknown> }[] = [];
const underTest = () => typeof process !== "undefined" && !!process.env["VITEST"];
export const safeModeState = (): SafeMode => state;
/** Tests only. */
export function setSafeModeForTest(s: SafeMode): void { state = s; }

async function readOwner(now: number): Promise<void> {
  if (owner && now - owner.at < 30_000) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("db_safe_mode").select("is_on,reason").eq("actor", "owner").order("id", { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(1_000));
    if (!error) owner = { on: !!data?.[0]?.is_on, why: data?.[0]?.reason ?? "", at: now };
  } catch { /* keep the last reading */ }
}
async function flush(): Promise<void> {
  if (!pending.length) return;
  // The preview shares the live database: its rehearsals (?__dbdown=1) are logged to the console only.
  if (import.meta.env.DEV) { pending = []; return; }
  const rows = pending; pending = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("db_safe_mode").insert(rows as never).abortSignal(AbortSignal.timeout(1_000));
    if (error) pending = [...rows, ...pending].slice(-20);
  } catch { pending = [...rows, ...pending].slice(-20); }
}
/** One more reading: move safe mode, log a change, and (when the database answered) write what is waiting. Never throws. */
export async function observeReading(history: readonly Probe[], last: Probe): Promise<void> {
  if (underTest()) return;
  try {
    const now = Date.now();
    if (last.ok) await readOwner(now);
    const a = answerLine(history, now);
    const { next, changed } = nextSafeMode(state, a.state, last.ok, now, owner && { on: owner.on, why: owner.why });
    if (changed) {
      const reading = { answer_state: a.state, median_ms: a.median_ms, worst_ms: a.worst_ms, failed: a.failed, readings: a.readings };
      pending.push({ at: new Date(now).toISOString(), is_on: next.on, actor: next.by === "owner" || state.by === "owner" ? "owner" : "auto",
        reason: changed === "entered" ? `entered: ${next.why || "the database is not answering in time"}` : "left: five minutes with every reading good", reading });
      console.info("safe mode", changed, JSON.stringify(reading));
    }
    state = next;
    if (last.ok) await flush();
  } catch { /* never in the way */ }
}
/** Whether this server is in safe mode now (the owner's switch read at most every 30 s). Under test: off unless set. */
export async function safeModeOn(): Promise<{ on: boolean; why: string }> {
  if (underTest()) return { on: state.on, why: state.why };
  await readOwner(Date.now()).catch(() => undefined);
  if (owner?.on && !state.on) state = { on: true, by: "owner", since: Date.now(), goodSince: null, why: owner.why };
  if (!owner?.on && state.by === "owner") state = { ...SAFE_OFF };
  return { on: state.on, why: state.why };
}
/** The owner's switch from the desk: one owner row; this server follows at once, the others within 30 s. */
export async function setOwnerSafeMode(on: boolean, reason: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("db_safe_mode").insert({ is_on: on, actor: "owner", reason, reading: {} } as never);
  if (error) throw new Error("safe mode switch not saved");
  owner = { on, why: reason, at: Date.now() };
  state = on ? { on: true, by: "owner", since: Date.now(), goodSince: null, why: reason } : (state.by === "owner" ? { ...SAFE_OFF } : state);
}
/** The newest changes, for the desk. */
export async function safeModeLog(limit = 10): Promise<{ at: string; is_on: boolean; actor: string; reason: string; reading: unknown }[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("db_safe_mode").select("at,is_on,actor,reason,reading").order("id", { ascending: false }).limit(limit);
  return (data ?? []) as never;
}
