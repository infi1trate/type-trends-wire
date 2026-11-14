// Crawler-secret endpoints for the LITE render queue. Privileged writes only after secret verification.
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { constantTimeHashEqual, sha256Hex } from "./crawl-ingest.server";
import { CRAWL_REQUESTS_BODY_LIMIT, crawlResultsSchema, nextCrawlRequestState, parseRequestLimit, urlKey } from "./crawl-requests";
import { invalidateCacheTags } from "./taste/cache.server";
import type { Json } from "@/integrations/supabase/types";

const noStore = { "cache-control": "no-store" };
const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

/** Same crawler secret as library-state/library-tag: `Authorization: Bearer <secret>` (or the existing `x-crawl-secret` header). */
export async function authenticateQueueCaller(request: Request): Promise<boolean> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  const secret = bearer || request.headers.get("x-crawl-secret");
  if (!secret) return false;
  const { data, error } = await db.from("crawl_secrets").select("secret_sha256").eq("id", 1).maybeSingle();
  if (error) throw new Error("Crawler secret lookup failed");
  return !!data && constantTimeHashEqual(await sha256Hex(secret), data.secret_sha256);
}

export async function boundedText(request: Request, limit: number): Promise<string | null> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function handleCrawlRequestsGet(request: Request): Promise<Response> {
  try {
    if (!await authenticateQueueCaller(request)) return unauthorized();
    const limit = parseRequestLimit(new URL(request.url).searchParams.get("limit"));
    if (limit === null) return Response.json({ error: "limit must be an integer from 1 to 25" }, { status: 400, headers: noStore });
    const { data, error } = await db.from("crawl_requests").select("url,domain,requested_at").eq("status", "pending")
      .order("requested_at", { ascending: true }).order("url", { ascending: true }).limit(limit);
    if (error) throw new Error("Queue lookup failed");
    return Response.json({ requests: data ?? [] }, { headers: noStore });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500, headers: noStore });
  }
}

export async function handleCrawlRequestsPost(request: Request): Promise<Response> {
  try {
    if (!await authenticateQueueCaller(request)) return unauthorized();
    const text = await boundedText(request, CRAWL_REQUESTS_BODY_LIMIT);
    if (text === null) return Response.json({ error: "Body exceeds 64 KB" }, { status: 413, headers: noStore });
    let json: unknown;
    try { json = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStore }); }
    const parsed = crawlResultsSchema.safeParse(json);
    if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues.slice(0, 10).map(i => ({ path: i.path.join("."), message: i.message })) }, { status: 400, headers: noStore });
    const results = parsed.data.results;
    const { data: rows, error } = await db.from("crawl_requests").select("url,status,attempts").in("url", results.map(r => r.url));
    if (error) throw new Error("Queue lookup failed");
    const byUrl = new Map((rows ?? []).map(r => [r.url, r]));
    const now = new Date().toISOString(), updated: { url: string; status: string; attempts: number }[] = [], skipped: { url: string; reason: string }[] = [];
    for (const result of results) {
      const row = byUrl.get(result.url);
      if (!row) { skipped.push({ url: result.url, reason: "unknown" }); continue; }
      if (row.status !== "pending") { skipped.push({ url: result.url, reason: "not_pending" }); continue; }
      const next = nextCrawlRequestState(row.attempts, result, now);
      // Optimistic guard: only the attempt count we read may be advanced, so concurrent posts cannot double-count.
      const { signals, ...fields } = next;
      const { data: changed, error: updateError } = await db.from("crawl_requests").update({ ...fields, ...(signals ? { signals: signals as Json } : {}) })
        .eq("url", result.url).eq("status", "pending").eq("attempts", row.attempts).select("url");
      if (updateError) throw new Error("Queue update failed");
      if (changed?.length) {
        updated.push({ url: result.url, status: next.status, attempts: next.attempts });
        // A new rendered result supersedes cached LITE-based critiques/differentiations for this URL.
        if (signals) await invalidateCacheTags([urlKey(result.url)]);
      }
      else skipped.push({ url: result.url, reason: "conflict" });
    }
    return Response.json({ updated, skipped }, { headers: noStore });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500, headers: noStore });
  }
}
