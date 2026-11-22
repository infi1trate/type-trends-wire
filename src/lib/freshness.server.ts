// Reads the facts behind freshness.ts from what is already stored, with the shared anonymous SELECT-only client:
// health_facts() (owner-rights facade), ingest_runs (ok rows are public), real forecast runs, job_steps, the newest story and crop.
// Cached per runtime for 60 s. Nothing here writes.
import { healthFactsResult } from "./health-facts.server";
import { supabaseAnon } from "./mcp/supabase";
import { healthFactsSchema } from "./health";
import { VANGUARD_RUN_PREFIX, followUpsFact, freshness, freshnessLine, wireOnTime, type FreshRow, type JobFact, type JobId } from "./freshness";
import { progress, type StepRow } from "./jobs/steps";
import { fetchRealRuns } from "./real-runs";
import { memo } from "./memo";
import { indicatorsHealthFacts } from "./indicators/read.server";

export type FreshnessPayload = { now: string; rows: FreshRow[]; line: { text: string; late: boolean }; wire_on_time: boolean; follow_ups: ReturnType<typeof progress> };
const fresh = memo(60_000, () => build());
export const loadFreshness = (): Promise<FreshnessPayload> => fresh();

async function build(): Promise<FreshnessPayload> {
  const db = supabaseAnon(), now = Date.now();
  const lastOk = (job: string) => db.from("ingest_runs").select("started_at,finished_at").eq("job", job).order("started_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0] ?? null);
  const [hf, wire, gfonts, ph, real, steps, story, crop, vanguard, ind] = await Promise.all([
    healthFactsResult().then(r => (r.error ? null : healthFactsSchema.safeParse(r.data).data ?? null)),
    lastOk("ingest-wire"), lastOk("ingest-gfonts"), lastOk("ingest-producthunt"),
    fetchRealRuns(db).catch(() => []),
    db.from("job_steps").select("*").order("queued_at", { ascending: false }).limit(60).then(r => (r.data ?? []) as StepRow[]),
    db.from("stories").select("created_at").order("created_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0]?.created_at ?? null),
    db.from("site_crops").select("last_seen_at").order("last_seen_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0]?.last_seen_at ?? null),
    // Vanguard runs are recognised by their run id prefix on the public snapshot rows (read-only).
    db.from("library_snapshots").select("received_at").eq("source", "live").like("run_id", `${VANGUARD_RUN_PREFIX}%`).order("received_at", { ascending: false }).limit(1).then(r => (r.data ?? [])[0]?.received_at ?? null, () => null),
    indicatorsHealthFacts().catch(() => null),
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
    vanguard: { ran: vanguard },
    library_full: { ran: hf?.library_full_at ?? null },
    crawl: { ran: fullRun?.started_at ?? null, finished: fullRun?.finished_at ?? null },
    crops: { ran: crop },
    discourse: { ran: hf?.bluesky_window_end ?? null },
    wayback: { ran: hf?.wayback_received_at ?? null },
    forecast: { ran: latestReal?.at ?? null, finished: latestReal?.at ?? null },
    follow_ups: followUpsFact({ forecastAt: latestReal?.at ?? null, queuedAt: lastSteps?.queued_at ?? null, finishedAt: lastSteps?.finished_at ?? null, openSince: open?.queued_at ?? null, failed: (lastSteps?.failed.length ?? 0) > 0 }),
    stories: { ran: story },
    digest: { ran: hf?.brief?.created_at ?? null },
    // Before the first daily post the job is not late, just not started.
    indicators: ind?.last_run_at ? { ran: ind.last_run_at, finished: ind.last_run_at, note: `${ind.points} points in the last run` } : { ran: null, dormant: "Collection has not started" },
  };
  const rows = freshness(facts, now);
  return { now: new Date(now).toISOString(), rows, line: freshnessLine(rows, now), wire_on_time: wireOnTime(rows), follow_ups: runs.slice(0, 3) };
}
