// Reads public health_facts() (owner-rights facade: timestamps, counts and statuses only) with the shared
// anonymous client and applies the pure rules in health.ts. Cached per isolate for 60 s.
import { healthFactsResult } from "./health-facts.server";
import { supabaseAnon } from "./mcp/supabase";
import { buildHealth, spendFacts, unavailableHealth, type HealthPayload } from "./health";
let cache: { at: number; value: HealthPayload } | null = null;
let inFlight: Promise<HealthPayload> | null = null;
/** S1 · the health answer within HEALTH_DEADLINE_MS. When the database is slower, the answer is the last one this instance had (with
 *  its time) or "down", plus a `database` line saying it did not answer in time; the read keeps going so the next call has it. */
type DbBlock = import("./db-health").DbHealth & { safe_mode: { on: boolean; why: string } };
export async function healthWithin(): Promise<{ body: HealthPayload & { database?: { status: "slow"; note: string; last_answer_at: string | null }; db?: DbBlock }; slow: boolean }> {
  const { HEALTH_DEADLINE_MS, within } = await import("./deadline");
  if (!inFlight) inFlight = healthPayload().finally(() => { inFlight = null; });
  const SLOW = Symbol("slow");
  // D1 Part 6 · the database lines are worked out beside the facts, from this server's own readings plus the load counts (each cut
  // short), so a slow database is said in time without waiting on it.
  const [r, db] = await Promise.all([within<HealthPayload | typeof SLOW>(inFlight, HEALTH_DEADLINE_MS, "health", () => SLOW).catch(() => unavailableHealth(new Date())), dbWithin().catch(() => undefined)]);
  const extra = db ? { db } : {};
  if (r !== SLOW) return { body: { ...r, ...extra }, slow: false };
  const last = cache?.value ?? null;
  return { slow: true, body: { ...(last ?? unavailableHealth(new Date())), ...extra, database: { status: "slow", note: `The database did not answer within ${(HEALTH_DEADLINE_MS / 1000).toFixed(1)} s; ${last ? "these are the last facts this server had" : "no earlier facts on this server"}.`, last_answer_at: last ? new Date(cache!.at).toISOString() : null } } };
}
let load: { at: number; value: import("./db-health").LoadFacts } | null = null;
let loadInFlight: Promise<void> | null = null;
let warnSince: number | null = null;
let sentKey: string | null = null;
let pendingAlert: { level: "warn" | "bad"; key: string; line: string; reading: unknown } | null = null;
/** The load counts (anonymous db_load_facts(), counts only), at most once a minute per server; a late read leaves the last one. */
async function readLoad(): Promise<void> {
  if (load && Date.now() - load.at < 60_000) return;
  if (!loadInFlight) loadInFlight = Promise.resolve(supabaseAnon().rpc("db_load_facts").abortSignal(AbortSignal.timeout(1_200)))
    .then(r => { if (!r.error && r.data) load = { at: Date.now(), value: r.data as never }; }, () => undefined).finally(() => { loadInFlight = null; });
  await Promise.race([loadInFlight, new Promise(res => setTimeout(res, 1_300))]);
}
/** The database lines within 1.5 s: past that, worked out from this server's readings and the last load counts alone. */
async function dbWithin(): Promise<DbBlock> {
  const [{ probeHistory }, h, sm] = await Promise.all([import("./db-probe.server"), import("./db-health"), import("./safe-mode.server")]);
  const late = new Promise<DbBlock>(res => setTimeout(() => {
    const now = Date.now();
    res({ ...h.dbHealth(probeHistory(), load && now - load.at < 10 * 60_000 ? load.value : null, now), safe_mode: { on: sm.safeModeState().on, why: sm.safeModeState().why } });
  }, 1_500));
  return Promise.race([dbBlock(), late]);
}
async function dbBlock(): Promise<DbBlock> {
  const [{ probeDb, probeHistory }, h, sm] = await Promise.all([import("./db-probe.server"), import("./db-health"), import("./safe-mode.server")]);
  const [probe] = await Promise.all([probeDb(), readLoad()]);
  const now = Date.now(), facts = load && now - load.at < 10 * 60_000 ? load.value : null;
  const out = h.dbHealth(probeHistory(), facts, now);
  const safe = probe.ok ? await Promise.race([sm.safeModeOn(), new Promise<{ on: boolean; why: string }>(res => setTimeout(() => res({ on: sm.safeModeState().on, why: sm.safeModeState().why }), 400))]) : { on: sm.safeModeState().on, why: sm.safeModeState().why };
  warnSince = out.state === "ok" ? null : (warnSince ?? now);
  const due = h.alertDue(out.state, warnSince, now);
  // An alert due while the database can't take a write waits here and is written (with its own key) at the next good reading.
  if (due && due.key !== sentKey && pendingAlert?.key !== due.key) {
    const lines = [out.answer, out.connections, out.write_log, out.biggest_job, out.skipped_slow].filter(x => x.state !== "ok").map(x => x.line).join(" ");
    pendingAlert = { ...due, line: `Database ${due.level} at ${new Date(now).toISOString().slice(11, 16)} UTC: ${lines}`, reading: { answer: out.answer, connections: out.connections.open, mb_hour: out.write_log.mb_hour, biggest_job: out.biggest_job.job, skipped: out.skipped_slow.count } };
  }
  if (pendingAlert && probe.ok) { const a = pendingAlert; pendingAlert = null; sentKey = a.key; void import("./db-desk.server").then(m => m.writeDbAlert(a)); }
  return { ...out, safe_mode: safe };
}
export async function healthPayload(): Promise<HealthPayload> {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) return cache.value;
  let value: HealthPayload;
  try {
    const db = supabaseAnon();
    const [{ data, error }, pause, indicators, history, writer, calls, deskFacts] = await Promise.all([healthFactsResult(), db.rpc("ai_pause_facts").then(r => (r.error ? null : r.data), () => null),
      // W2: the newest leading-indicator run; unreadable reads as not started rather than failing health.
      import("./indicators/read.server").then(m => m.indicatorsHealthFacts()).catch(() => null),
      // When the library history series last finished refreshing; unreadable leaves the library_check note as before.
      db.rpc("library_history_facts").then(r => (r.error ? null : r.data), () => null),
      // E2b: the story writer's calls today; unreadable shows "writer facts unavailable" and changes nothing else.
      db.rpc("story_writer_facts").then(r => (r.error ? null : r.data), () => null),
      // N2: each writer's and desk's calls today against its own limit; unreadable falls back to the single count.
      db.rpc("newsroom_call_facts").then(r => (r.error ? null : r.data), () => null),
      // N3: every desk's calls today keyed desk:purpose; unreadable leaves the meter without the new desks.
      db.rpc("newsroom_desk_facts" as never).then(r => (r.error ? null : r.data), () => null)]);
    // The pause reason and probe times only add to the library_ai note; when they can't be read the job reads as before.
    value = error ? unavailableHealth(new Date(now)) : buildHealth({ ...(data as object), ...(pause && typeof pause === "object" && Object.keys(pause).length ? { ai_pause: pause } : {}), ...(indicators ? { indicators } : {}), ...(writer && typeof writer === "object" ? { story_writer: writer } : {}), ...(calls && typeof calls === "object" ? { newsroom_calls: calls } : {}), ...(deskFacts && typeof deskFacts === "object" ? { desk_calls: deskFacts } : {}), ...(history && typeof history === "object" ? { library_history: history } : {}) } as never, new Date(now));
  } catch { value = unavailableHealth(new Date(now)); }
  // I3b: the brand-name check is a fact beside the jobs; unreadable reads as null and never changes the status.
  const names = await import("./name-check.server").then(m => m.brandNameCheck()).catch(() => null);
  // N1: the weekly spend cap (set or not, reached or not; no amounts); unreadable reads as null and never changes the status.
  const spend = await supabaseAnon().rpc("spend_facts" as never).then(r => (r.error ? null : spendFacts(r.data)), () => null);
  // W3a: museum works stored by source and the newest last_seen (public rows only); unreadable reads as null and never changes the status.
  const art = await artHealth().catch(() => null);
  // T1 · each stored page's age against its limit (anonymous read of keys and times only); unreadable reads as null and never changes the status.
  const stored_pages = await import("./records/store.server").then(async m => (await import("./records/records")).storedAges(await m.recordMetas(), now)).catch(() => null);
  // T1 · this week's spend totals from the anonymous spend_week_facts() facade; unreadable reads as null and never changes the status.
  const spend_week = await import("./newsroom/ledger.server").then(m => m.healthSpend(supabaseAnon() as never)).catch(() => null);
  value = { ...value, brand_names: names, spend, art, stored_pages, spend_week };
  cache = { at: now, value };
  return value;
}

/** W3a · one line for the museum works: stored (not removed) by source, and when any was last seen. */
async function artHealth(): Promise<{ met: number; aic: number; newest_last_seen: string | null }> {
  const db = supabaseAnon();
  const count = (source: "met" | "aic") => db.from("art_works").select("id", { count: "exact", head: true }).eq("source", source).then(r => { if (r.error) throw r.error; return r.count ?? 0; });
  const [met, aic, newest] = await Promise.all([count("met"), count("aic"), db.from("art_works").select("last_seen").order("last_seen", { ascending: false }).limit(1).then(r => { if (r.error) throw r.error; return r.data?.[0]?.last_seen ?? null; })]);
  return { met, aic, newest_last_seen: newest };
}
