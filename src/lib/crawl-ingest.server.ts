import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { CRAWL_BODY_LIMIT, crawlPayload } from "./crawl-payload";

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

/** D1 Part 2 · the crawl intake stores what it was sent and answers. Nothing heavy runs inside the request any more (it took 35 to
 *  40 s while the crawler waited): the summaries, the archive replays and the forced sweep are marked out of date (work_marks) and the
 *  one follow-up worker does them in order. Story builds and brand cards follow from the stored captures themselves (the wire
 *  follow-ups pass builds every fifteen minutes; a card older than its brand's newest capture is due in the sweep). */
export type IngestContext = { waitUntil?: (p: Promise<unknown>) => void; mark?: (topics: string[]) => Promise<void> };
const markDefault = async (topics: string[]) => (await import("./jobs/marks.server")).markWork(topics);

export async function handleCrawlIngest(request: Request, ctx: IngestContext = {}): Promise<Response> {
  const started = Date.now();
  try {
    // D1 · a slow database refuses the post at once (before the secret lookup, which is itself a read), with the seconds to wait.
    const { probeDb, probeHistory } = await import("./db-probe.server");
    const probe = await probeDb();
    if (!probe.ok) { const { retryAfterS, tryLater } = await import("./db-guard"); return tryLater(retryAfterS(probeHistory(), Date.now())); }
    // D1 Part 6 · in safe mode posts are refused the same way (the crawler waits and posts again).
    const safe = await (await import("./safe-mode.server")).safeModeOn();
    if (safe.on) { const { tryLater } = await import("./db-guard"); return tryLater(120, `The site is in safe mode (${safe.why}); nothing was stored.`); }
    if (!await authenticateCrawler(request)) return forbidden();
    const text = await boundedBody(request);
    if (text === null) return Response.json({ error: "Body exceeds 2 MB" }, { status: 413 });
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const result = crawlPayload.safeParse(json);
    if (!result.success) return Response.json({ error: "Invalid input", issues: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, { status: 400 });
    const payload = result.data;
    // N4c · the batch's run row (start before the work, finish after).
    const { withRun } = await import("./jobs/runs.server");
    return await withRun("crawl-ingest", () => crawlWork(payload, started, ctx), r => ({ ok: r.status < 400, note: `${payload.kind} · ${r.status}` }), { note: payload.kind });
  } catch (error) {
    // Never log payloads, credentials, or provider errors that may contain input.
    console.error("Crawler ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
async function crawlWork(payload: import("zod").infer<typeof crawlPayload>, _started: number, ctx: IngestContext): Promise<Response> {
  const mark = ctx.mark ?? markDefault;
  {
    if (payload.kind === "library_sync" || payload.kind === "library_snapshots") {
      const { ingestLibrary } = await import("./library-ingest.server");
      const res = await ingestLibrary(payload);
      if (res.ok && payload.kind === "library_snapshots") {
        const { archiveTopic } = await import("./jobs/marks");
        // Archive captures need their brand's history replayed; that is the worker's job now (newest state once per brand).
        const archive = [...new Set(payload.snapshots.filter(x => x.source === "wayback").map(x => x.domain))];
        if (archive.length) await mark(archive.map(archiveTopic));
        const out = new Response(res.body, res);
        out.headers.set("x-followups", archive.length ? "marked" : "none");
        out.headers.set("x-history-refresh", "scheduled");
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
      // I3b: an address on file that belongs to a different business is not counted (site-corrections.ts).
      const { isWrongSite } = await import("./site-corrections");
      const rows = payload.sites.filter(entry => !isWrongSite(entry.domain)).map((entry) => ({
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
      if (currentRun?.status === "finished") await mark([(await import("./jobs/marks")).MARK_AGGREGATES]);
      return Response.json({ ok: true, written: rows.length });
    }
    const { data, error } = await db.from("crawl_runs").update({ status: "finished", finished_at: payload.finished_at, stats: payload.stats })
      .eq("id", payload.run_id).select("id");
    if (error) throw new Error("Crawler run finish failed");
    if (!data?.length) return Response.json({ error: "Unknown run" }, { status: 404 });
    const { MARK_AGGREGATES, MARK_RECORDS_FORCE } = await import("./jobs/marks");
    await mark([MARK_AGGREGATES, MARK_RECORDS_FORCE]);
    return Response.json({ ok: true, written: data.length, followups: "marked" });
  }
}