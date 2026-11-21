// Reads public health_facts() (owner-rights facade: timestamps, counts and statuses only) with the shared
// anonymous client and applies the pure rules in health.ts. Cached per isolate for 60 s.
import { healthFactsResult } from "./health-facts.server";
import { supabaseAnon } from "./mcp/supabase";
import { buildHealth, unavailableHealth, type HealthPayload } from "./health";
let cache: { at: number; value: HealthPayload } | null = null;
export async function healthPayload(): Promise<HealthPayload> {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) return cache.value;
  let value: HealthPayload;
  try {
    const db = supabaseAnon();
    const [{ data, error }, pause, indicators, history, writer] = await Promise.all([healthFactsResult(), db.rpc("ai_pause_facts").then(r => (r.error ? null : r.data), () => null),
      // W2: the newest leading-indicator run; unreadable reads as not started rather than failing health.
      import("./indicators/read.server").then(m => m.indicatorsHealthFacts()).catch(() => null),
      // When the library history series last finished refreshing; unreadable leaves the library_check note as before.
      db.rpc("library_history_facts").then(r => (r.error ? null : r.data), () => null),
      // E2b: the story writer's calls today; unreadable shows "writer facts unavailable" and changes nothing else.
      db.rpc("story_writer_facts").then(r => (r.error ? null : r.data), () => null)]);
    // The pause reason and probe times only add to the library_ai note; when they can't be read the job reads as before.
    value = error ? unavailableHealth(new Date(now)) : buildHealth({ ...(data as object), ...(pause && typeof pause === "object" && Object.keys(pause).length ? { ai_pause: pause } : {}), ...(indicators ? { indicators } : {}), ...(writer && typeof writer === "object" ? { story_writer: writer } : {}), ...(history && typeof history === "object" ? { library_history: history } : {}) } as never, new Date(now));
  } catch { value = unavailableHealth(new Date(now)); }
  cache = { at: now, value };
  return value;
}
