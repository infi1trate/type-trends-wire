// Reads the facts behind freshness.ts from what is already stored, with the shared anonymous SELECT-only client:
// health_facts() (owner-rights facade), ingest_runs (ok rows are public), real forecast runs, job_steps, the newest story and crop.
// Cached per runtime for 60 s. Nothing here writes.
import { supabaseAnon } from "./mcp/supabase";
import { healthFactsSchema } from "./health";
import { freshness, freshnessLine, wireOnTime, type FreshRow, type JobFact, type JobId } from "./freshness";
import { progress, type StepRow } from "./jobs/steps";
import { fetchRealRuns } from "./real-runs";

export type FreshnessPayload = { now: string; rows: FreshRow[]; line: { text: string; late: boolean }; wire_on_time: boolean; follow_ups: ReturnType<typeof progress> };
let cache: { at: number; v: Promise<FreshnessPayload> } | null = null;

export function loadFreshness(): Promise<FreshnessPayload> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const v = build(); const entry = { at: Date.now(), v }; cache = entry;
  v.catch(() => { if (cache === entry) cache = null; });
  return v;
}

async function build(): Promise<FreshnessPayload> {
  const db = supabaseAnon(), now = Date.now();
  const lastOk = (job: string) => db.from("ingest_runs").select("started_at,finished_at").eq("job", job).order("started_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0] ?? null);
  const [hf, wire, gfonts, ph, real, steps, story, crop] = await Promise.all([
    db.rpc("health_facts").then(r => (r.error ? null : healthFactsSchema.safeParse(r.data).data ?? null)),
    lastOk("ingest-wire"), lastOk("ingest-gfonts"), lastOk("ingest-producthunt"),
    fetchRealRuns(db).catch(() => []),
    db.from("job_steps").select("*").order("queued_at", { ascending: false }).limit(60).then(r => (r.data ?? []) as StepRow[]),
    db.from("stories").select("created_at").order("created_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0]?.created_at ?? null),
    db.from("site_crops").select("last_seen_at").order("last_seen_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0]?.last_seen_at ?? null),
  ]);
  const ing = (key: string) => hf?.ingest[key] ?? {};
  const fact = (okRow: { started_at: string; finished_at: string | null } | null, key: string): JobFact => {
    const i = ing(key), ran = [okRow?.started_at ?? null, i.last_run_at ?? null].filter((x): x is string => !!x).sort().at(-1) ?? null;
    return { ran, finished: okRow?.finished_at ?? null, failing: i.last_ok === false };
  };
  const fullRun = (hf?.crawl_runs ?? []).filter(r => r.finished_at).sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))[0];
  const runs = progress(steps), open = runs.filter(r => r.open.length).sort((a, b) => a.queued_at.localeCompare(b.queued_at))[0];
  const lastSteps = runs[0];
  const latestReal = real.at(-1) ?? null;
  const facts: Partial<Record<JobId, JobFact>> = {
    wire: fact(wire, "ingest-wire"),
    gfonts: fact(gfonts, "ingest-gfonts"),
    producthunt: { ...fact(ph, "ingest-producthunt"), dormant: ph ? null : "Waiting for a Product Hunt developer token" },
    library_ai: { ran: hf?.ai_jobs?.last_activity_at ?? null, finished: hf?.ai_jobs?.last_done_at ?? null, idle: !(hf?.ai_jobs?.pending ?? 0), waiting_since: (hf?.ai_jobs?.pending ?? 0) > 0 ? hf?.ai_jobs?.oldest_pending_at ?? null : null, dormant: hf?.ai_jobs?.paused ? "Paused by the owner" : null },
    library_check: { ran: hf?.library_check_at ?? null },
    library_full: { ran: hf?.library_full_at ?? null },
    crawl: { ran: fullRun?.started_at ?? null, finished: fullRun?.finished_at ?? null },
    crops: { ran: crop },
    discourse: { ran: hf?.bluesky_window_end ?? null },
    forecast: { ran: latestReal?.at ?? null, finished: latestReal?.at ?? null },
    follow_ups: lastSteps ? { ran: lastSteps.queued_at, finished: lastSteps.finished_at, waiting_since: open?.queued_at ?? null, failing: lastSteps.failed.length > 0 } : { ran: null },
    stories: { ran: story },
    digest: { ran: hf?.brief?.created_at ?? null },
  };
  const rows = freshness(facts, now);
  return { now: new Date(now).toISOString(), rows, line: freshnessLine(rows, now), wire_on_time: wireOnTime(rows), follow_ups: runs.slice(0, 3) };
}
