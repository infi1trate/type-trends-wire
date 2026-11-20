// Reads public health_facts() (owner-rights facade: timestamps, counts and statuses only) with the shared
// anonymous client and applies the pure rules in health.ts. Cached per isolate for 60 s.
import { supabaseAnon } from "./mcp/supabase";
import { buildHealth, unavailableHealth, type HealthPayload } from "./health";
let cache: { at: number; value: HealthPayload } | null = null;
export async function healthPayload(): Promise<HealthPayload> {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) return cache.value;
  let value: HealthPayload;
  try {
    const db = supabaseAnon();
    const [{ data, error }, pause, indicators] = await Promise.all([db.rpc("health_facts"), db.rpc("ai_pause_facts").then(r => (r.error ? null : r.data), () => null),
      // W2: the newest leading-indicator run; unreadable reads as not started rather than failing health.
      import("./indicators/read.server").then(m => m.indicatorsHealthFacts()).catch(() => null)]);
    // The pause reason and probe times only add to the library_ai note; when they can't be read the job reads as before.
    value = error ? unavailableHealth(new Date(now)) : buildHealth({ ...(data as object), ...(pause && typeof pause === "object" && Object.keys(pause).length ? { ai_pause: pause } : {}), ...(indicators ? { indicators } : {}) } as never, new Date(now));
  } catch { value = unavailableHealth(new Date(now)); }
  cache = { at: now, value };
  return value;
}
