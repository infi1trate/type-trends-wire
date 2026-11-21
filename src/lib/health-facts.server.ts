// One health_facts() read per instance per minute, shared by /status, the freshness line and /status/launch (each was reading it
// separately within its own 60 s cache).
import { supabaseAnon } from "./mcp/supabase";
import { memo } from "./memo";

export const healthFactsRpc = memo(60_000, async (): Promise<unknown> => {
  const { data, error } = await supabaseAnon().rpc("health_facts");
  if (error) throw error;
  return data;
});
/** The same shape the callers read from `db.rpc("health_facts")`. */
export const healthFactsResult = (): Promise<{ data: unknown; error: unknown }> => healthFactsRpc().then(data => ({ data, error: null }), error => ({ data: null, error }));
