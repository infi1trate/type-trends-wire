// Crawler-secret wire endpoints: Bluesky items/mention windows, discourse vocabulary, curated seed candidates.
// The scheduled RSS/HN callback keeps using the managed cron credential with an empty JSON body.
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { authenticateQueueCaller, boundedText } from "./crawl-requests.server";
import { WIRE_INGEST_BODY_LIMIT, blueskyRows, mentionRows, wireIngestPayload } from "./wire-payload";
import { FATIGUE_PHRASES } from "./discourse";
import { loadTerms, mergeCounts } from "./discourse.server";
import { SEED_SOURCES, SEED_WINDOW_DAYS, seedCandidates } from "./sources";

const noStore = { "cache-control": "no-store" };
const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
const internal = (where: string, error: unknown) => { console.error(where, error instanceof Error ? error.name : "UnknownError"); return Response.json({ error: "Internal error" }, { status: 500, headers: noStore }); };

export async function handleIngestWire(request: Request): Promise<Response> {
  const started = Date.now();
  try {
    if (!await authenticateQueueCaller(request)) {
      // Not the crawler: only the managed schedule may trigger the RSS/HN poll (empty JSON object body).
      const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
      const denied = await authenticateCronRequest(request);
      if (denied) return denied;
      const text = await boundedText(request, 1024);
      let body: unknown = null; try { body = text ? JSON.parse(text) : null; } catch { /* invalid */ }
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) return Response.json({ error: "Expected empty JSON object" }, { status: 400 });
      const { ingestWire } = await import("./ingest.server"), res = await ingestWire();
      if (res.ok) await (await import("./stories/build.server")).afterJob("wire", started);
      return res;
    }
    const text = await boundedText(request, WIRE_INGEST_BODY_LIMIT);
    if (text === null) return Response.json({ error: "Body exceeds 256 KB" }, { status: 413, headers: noStore });
    let json: unknown;
    try { json = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStore }); }
    const parsed = wireIngestPayload.safeParse(json);
    if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues.slice(0, 10).map(i => ({ path: i.path.join("."), message: i.message })) }, { status: 400, headers: noStore });
    const payload = parsed.data;
    if (payload.kind === "items") {
      const { rows, skipped } = blueskyRows(payload.items, Date.now());
      let written = 0;
      if (rows.length) {
        const { data, error } = await db.from("wire_items").upsert(rows, { onConflict: "url", ignoreDuplicates: true }).select("id");
        if (error) throw new Error("Wire item write failed");
        written = data?.length ?? 0;
      }
      if (written) await (await import("./stories/build.server")).afterJob("wire-items", started);
      return Response.json({ ok: true, received: payload.items.length, written, duplicates: rows.length - written, skipped }, { headers: noStore });
    }
    const rows = mentionRows(payload);
    const written = await mergeCounts(db, rows, false);
    return Response.json({ ok: true, window_start: rows[0]!.window_start, window_end: rows[0]!.window_end, terms: rows.length - 1, written }, { headers: noStore });
  } catch (error) { return internal("Wire ingestion failed", error); }
}

export async function handleDiscourseTerms(request: Request): Promise<Response> {
  try {
    if (!await authenticateQueueCaller(request)) return unauthorized();
    const { version, terms } = await loadTerms(db);
    return Response.json({ version, terms, fatigue: FATIGUE_PHRASES }, { headers: noStore });
  } catch (error) { return internal("Discourse terms failed", error); }
}

export async function handleSeedCandidates(request: Request): Promise<Response> {
  try {
    if (!await authenticateQueueCaller(request)) return unauthorized();
    const since = new Date(Date.now() - SEED_WINDOW_DAYS * 864e5).toISOString(), rows: { link: string | null; source_kind: string; fetched_at: string }[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await db.from("wire_items").select("link,source_kind,fetched_at").in("source_kind", [...SEED_SOURCES]).not("link", "is", null)
        .gte("fetched_at", since).order("id").range(from, from + 999);
      if (error) throw new Error("Seed lookup failed");
      rows.push(...(data ?? [])); if (!data || data.length < 1000) break;
    }
    return Response.json({ domains: seedCandidates(rows) }, { headers: noStore });
  } catch (error) { return internal("Seed candidates failed", error); }
}
