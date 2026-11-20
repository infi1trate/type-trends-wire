// Backfill headline calls (stories/headline-call.ts) for live desktop homepage headline changes of the last N days (default 14).
// Insert-only into headline_calls; model calls go through the AI budget. Usage: bun scripts/headline-calls.ts [--days 14] [--limit 80] [--recheck-rules] [--list]
// --recheck-rules asks again where a stored rule call no longer matches the current rules (the newer row supersedes the older one).
import type { EventRow } from "../src/lib/agency/changes";
const arg = (k: string, d: number) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const days = arg("--days", 14), limit = arg("--limit", 80);
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { headlineCalls } = await import("../src/lib/stories/headline-call.server");
const since = new Date(Date.now() - days * 864e5).toISOString();
const { data: sites } = await db.from("library_sites").select("domain,sector");
const sector = new Map((sites ?? []).map(s => [s.domain, s.sector]));
const { data, error } = await db.from("library_events").select("id,domain,type,before,after,detected_at,snapshot_id,prev_snapshot_id,page_type,viewport,source").eq("source", "live").eq("viewport", "desktop").eq("type", "message_pivot").eq("page_type", "home").gte("detected_at", since).order("id");
if (error) throw error;
const events = (data ?? []).map(e => ({ ...e, sector: sector.get(e.domain) ?? null })) as EventRow[];
const calls = await headlineCalls(db, events, { limit, deadline: Date.now() + 280_000, recheckRules: process.argv.includes("--recheck-rules") });
const by: Record<string, number> = {};
for (const e of events) { const c = calls[e.id]; by[c?.call ?? "not called"] = (by[c?.call ?? "not called"] ?? 0) + 1; }
console.log(JSON.stringify({ days, events: events.length, by }));
if (process.argv.includes("--list")) for (const e of events) { const c = calls[e.id]; console.log(e.id, e.domain, "|", JSON.stringify((e.before as { headline?: string })?.headline), "→", JSON.stringify((e.after as { headline?: string })?.headline), "|", c?.call, "|", c?.reason); }
