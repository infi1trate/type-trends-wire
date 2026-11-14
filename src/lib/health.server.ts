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
    const { data, error } = await supabaseAnon().rpc("health_facts");
    value = error ? unavailableHealth(new Date(now)) : buildHealth(data as never, new Date(now));
  } catch { value = unavailableHealth(new Date(now)); }
  cache = { at: now, value };
  return value;
}
