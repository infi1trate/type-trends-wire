// Reads public health_facts() (owner-rights facade: timestamps, counts and statuses only) with the shared
// anonymous client and applies the pure rules in health.ts. Cached per isolate for 60 s.
import { healthFactsResult } from "./health-facts.server";
import { supabaseAnon } from "./mcp/supabase";
import { buildHealth, spendFacts, unavailableHealth, type HealthPayload } from "./health";
let cache: { at: number; value: HealthPayload } | null = null;
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
  value = { ...value, brand_names: names, spend, art, stored_pages };
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
