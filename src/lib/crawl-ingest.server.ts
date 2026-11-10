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

export async function handleCrawlIngest(request: Request): Promise<Response> {
  const secret = request.headers.get("x-crawl-secret");
  if (!secret) return forbidden();
  try {
    const { data: configured, error: secretError } = await db.from("crawl_secrets").select("secret_sha256").eq("id", 1).maybeSingle();
    if (secretError) throw new Error("Crawler secret lookup failed");
    if (!configured || !constantTimeHashEqual(await sha256Hex(secret), configured.secret_sha256)) return forbidden();
    const text = await boundedBody(request);
    if (text === null) return Response.json({ error: "Body exceeds 2 MB" }, { status: 413 });
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const result = crawlPayload.safeParse(json);
    if (!result.success) return Response.json({ error: "Invalid input", issues: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, { status: 400 });
    const payload = result.data;
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
      }));
      const { error } = await db.from("crawl_sites").upsert(rows, { onConflict: "run_id,domain" });
      if (error) throw new Error("Crawler site write failed");
      return Response.json({ ok: true, written: rows.length });
    }
    const { data, error } = await db.from("crawl_runs").update({ status: "finished", finished_at: payload.finished_at, stats: payload.stats })
      .eq("id", payload.run_id).select("id");
    if (error) throw new Error("Crawler run finish failed");
    if (!data?.length) return Response.json({ error: "Unknown run" }, { status: 404 });
    return Response.json({ ok: true, written: data.length });
  } catch (error) {
    // Never log payloads, credentials, or provider errors that may contain input.
    console.error("Crawler ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}