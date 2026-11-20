import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { CRAWL_BODY_LIMIT, crawlPayload } from "./crawl-payload";
import { HISTORY_BACKGROUND_MS, HISTORY_JOB_MS } from "./history-refresh";
import { CALL_BUDGET_MS } from "./jobs/steps";

/** The history step before a job's records sweep: at most HISTORY_JOB_MS, never past the call budget. Never throws. */
export async function refreshHistoryForJob(job: string, started: number): Promise<void> {
  try {
    const deadline = Math.min(started + CALL_BUDGET_MS - 5_000, Date.now() + HISTORY_JOB_MS);
    await (await import("./history-refresh.server")).refreshLibraryHistory({ deadline, job });
  } catch { /* best effort */ }
}

const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeHashEqual(actual: string, expected: string): boolean {
  let difference = expected.length ^ 64;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0);
  return difference === 0;
}

export async function authenticateCrawler(request: Request): Promise<boolean> {
  const secret = request.headers.get("x-crawl-secret");
  if (!secret) return false;
  const { data: configured, error } = await db.from("crawl_secrets").select("secret_sha256").eq("id", 1).maybeSingle();
  if (error) throw new Error("Crawler secret lookup failed");
  return !!configured && constantTimeHashEqual(await sha256Hex(secret), configured.secret_sha256);
}

export async function handleLibraryState(request: Request, deps: { vanguard?: () => Promise<string[]> } = {}): Promise<Response> {
  try {
    if (!await authenticateCrawler(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
    const source=new URL(request.url).searchParams.get("source");
    if(source!==null&&source!=="live"&&source!=="wayback")return Response.json({error:"Invalid source"},{status:400});
    const { data, error } = await db.rpc(source==="wayback"?"library_archive_state":"library_state");
    if (error) throw new Error("Library state lookup failed");
    if (source === "wayback") return Response.json(data, { headers: { "cache-control": "no-store" } });
    // Additive: the brands worth a full daily look (vanguard.ts). Existing fields are unchanged.
    const vanguard = await (deps.vanguard ?? (async () => (await import("./vanguard.server")).loadVanguard()))();
    const body = data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>), vanguard } : data;
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

async function boundedBody(request: Request): Promise<string | null> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > CRAWL_BODY_LIMIT) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CRAWL_BODY_LIMIT) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function refreshAggregates(): Promise<void> {
  const { error } = await db.rpc("refresh_crawl_aggregates");
  if (error) throw new Error("Crawler aggregate refresh failed");
}

/** A crawl batch's card refresh gets at most this long, measured from when its snapshots were stored. */
export const BATCH_REFRESH_MS = 8_000;
export type IngestContext = { waitUntil?: (p: Promise<unknown>) => void };
const pause = (ms: number) => new Promise<void>(r => setTimeout(r, Math.max(0, ms)));

export async function handleCrawlIngest(request: Request, ctx: IngestContext = {}): Promise<Response> {
  const started = Date.now();
  try {
    if (!await authenticateCrawler(request)) return forbidden();
    const text = await boundedBody(request);
    if (text === null) return Response.json({ error: "Body exceeds 2 MB" }, { status: 413 });
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const result = crawlPayload.safeParse(json);
    if (!result.success) return Response.json({ error: "Invalid input", issues: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, { status: 400 });
    const payload = result.data;
    if (payload.kind === "library_sync" || payload.kind === "library_snapshots") {
      const { ingestLibrary } = await import("./library-ingest.server");
      const res = await ingestLibrary(payload);
      if (res.ok && payload.kind === "library_snapshots") {
        const stored = Date.now();
        await (await import("./stories/build.server")).afterJob("library", started);
        // Only the brands this batch captured get fresh identity cards, within BATCH_REFRESH_MS of storing; the wire poll's sweep
        // does everything else. With waitUntil the crawler gets its answer now and the cards are written after; without it they are
        // written inline, and a slow refresh is abandoned at the limit so a stored batch always answers with its counts.
        const domains = [...new Set(payload.snapshots.map(s => s.domain))];
        const refresh = import("./records/refresh.server")
          .then(m => m.refreshAfterJob("library", stored, { domains, only: "captured", limitMs: BATCH_REFRESH_MS }))
          .catch(() => null);
        let mode: "background" | "inline" = "inline";
        if (typeof ctx.waitUntil === "function") {
          try { ctx.waitUntil(refresh); mode = "background"; } catch { /* fall back to inline */ }
        }
        if (mode === "inline") await Promise.race([refresh, pause(stored + BATCH_REFRESH_MS + 500 - Date.now())]);
        console.info("crawl batch card refresh", mode, domains.length);
        // History series: only in the background after the answer (never inline on a batch); without waitUntil the wire poll's
        // follow-up and the crawl finish pick it up within 15 minutes.
        let history: "background" | "skipped" = "skipped";
        if (typeof ctx.waitUntil === "function") {
          const step = import("./history-refresh.server")
            .then(m => m.refreshLibraryHistory({ deadline: Date.now() + HISTORY_BACKGROUND_MS, job: "library" }))
            .catch(() => null);
          try { ctx.waitUntil(step); history = "background"; } catch { /* left for the wire poll */ }
        }
        const out = new Response(res.body, res);
        out.headers.set("x-records-refresh", mode);
        out.headers.set("x-history-refresh", history);
        return out;
      }
      return res;
    }
    if (payload.kind === "start") {
      const { error } = await db.from("crawl_runs").upsert({ id: payload.run_id, started_at: payload.started_at,
        status: "running", target_per_index: payload.target_per_index, seeds_meta: payload.seeds_meta }, { onConflict: "id" });
      if (error) throw new Error("Crawler run start failed");
      const { error: staleError } = await db.from("crawl_runs").update({ status: "failed" }).eq("status", "running")
        .neq("id", payload.run_id).lt("started_at", new Date(Date.now() - 24 * 3600000).toISOString());
      if (staleError) throw new Error("Stale crawler run cleanup failed");
      return Response.json({ ok: true, written: 1 });
    }
    if (payload.kind === "sites") {
      const { data: run, error: lookupError } = await db.from("crawl_runs").select("id").eq("id", payload.run_id).maybeSingle();
      if (lookupError) throw new Error("Crawler run lookup failed");
      if (!run) return Response.json({ error: "Unknown run" }, { status: 404 });
      const rows = payload.sites.map((entry) => ({
        run_id: entry.run_id, domain: entry.domain, index_name: entry.index,
        crawled_at: entry.crawled_at, ok: entry.ok,
        error: entry.error ?? null, final_url: entry.final_url ?? null,
        title: entry.title ?? null, lang: entry.lang ?? null,
        type: entry.type ?? null, color: entry.color ?? null, layout: entry.layout ?? null,
        composition: entry.composition ?? null, lexicon: entry.lexicon ?? null, tech: entry.tech ?? null,
        galleries: entry.galleries ? [...new Set(entry.galleries)] : null,
      }));
      const { error } = await db.from("crawl_sites").upsert(rows, { onConflict: "run_id,domain" });
      if (error) throw new Error("Crawler site write failed");
      // Check after writing: a finish request may have completed while this batch was in flight.
      const { data: currentRun, error: statusError } = await db.from("crawl_runs").select("status").eq("id", payload.run_id).maybeSingle();
      if (statusError) throw new Error("Crawler run status lookup failed");
      if (currentRun?.status === "finished") await refreshAggregates();
      return Response.json({ ok: true, written: rows.length });
    }
    const { data, error } = await db.from("crawl_runs").update({ status: "finished", finished_at: payload.finished_at, stats: payload.stats })
      .eq("id", payload.run_id).select("id");
    if (error) throw new Error("Crawler run finish failed");
    if (!data?.length) return Response.json({ error: "Unknown run" }, { status: 404 });
    await refreshAggregates();
    await (await import("./stories/build.server")).afterJob("crawl-finish", started);
    await refreshHistoryForJob("crawl-finish", started);
    await (await import("./records/refresh.server")).refreshAfterJob("crawl-finish", started, { force: true });
    return Response.json({ ok: true, written: data.length });
  } catch (error) {
    // Never log payloads, credentials, or provider errors that may contain input.
    console.error("Crawler ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}