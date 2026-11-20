// E2e · judge every live library change against the stored live captures and append the verdicts that changed (change_checks).
// The story build does the same for its window on every run; this covers every live change once. Append-only; idempotent.
// Usage: bun scripts/check-changes.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAnon } = await import("../src/lib/mcp/supabase");
const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const { computeChecks, recordChecks } = await import("../src/lib/integrity.server");
const db = supabaseAnon(), events: never[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("library_events").select("id,domain,type,before,after,detected_at,source,page_type,viewport,snapshot_id,prev_snapshot_id").eq("source", "live").order("id").range(from, from + 999);
  if (error) throw error; events.push(...((data ?? []) as never[])); if (!data || data.length < 1000) break;
}
const checks = await computeChecks(db, events);
const tally = [...checks.values()].reduce<Record<string, number>>((m, c) => ((m[c.verdict] = (m[c.verdict] ?? 0) + 1), m), {});
const written = dry ? 0 : await recordChecks(supabaseAdmin as never, checks);
console.log(JSON.stringify({ dry, events: events.length, tally, written }));
