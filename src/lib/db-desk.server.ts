// D1 Part 6 · what the desk shows above the fold about the database: open engineering alerts (newest first, last 48 hours), this
// server's safe mode and the newest safe-mode changes. Service role; the desk is staff only.
import type { DbDesk } from "./db-health";
export type { DbDesk };
export async function dbDeskFacts(): Promise<DbDesk> {
  const [{ supabaseAdmin }, sm] = await Promise.all([import("@/integrations/supabase/client.server"), import("./safe-mode.server")]);
  const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const [alerts, changes, on] = await Promise.all([
    supabaseAdmin.from("db_alerts").select("at,level,line").gte("at", since).order("at", { ascending: false }).limit(10).then(r => (r.data ?? []) as DbDesk["alerts"]),
    sm.safeModeLog(5).catch(() => []),
    sm.safeModeOn(),
  ]);
  return { alerts, safe_mode: { on: on.on, by: sm.safeModeState().by, why: on.why }, changes: changes.map(c => ({ at: c.at, is_on: c.is_on, actor: c.actor, reason: c.reason })) };
}
/** One engineering alert, once per key (the unique key makes a second write a no-op). Never throws. */
export async function writeDbAlert(a: { level: "warn" | "bad"; key: string; line: string; reading: unknown }): Promise<void> {
  try {
    if (import.meta.env.DEV) { console.info("db alert (preview, not written)", a.key, a.line); return; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("db_alerts").upsert({ level: a.level, key: a.key, line: a.line.slice(0, 600), reading: a.reading as never }, { onConflict: "key", ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(1_000));
  } catch { /* the next reading tries again */ }
}
