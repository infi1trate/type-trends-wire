// POST /api/public/ingest-series (W2): the crawler's daily leading-indicator points. Crawler-secret auth (the same check as the
// crawl and crops ingests) runs before the body is read; payloads are never logged. Writes go through an injectable store so tests
// run in memory; the live store calls the service-role-only outside_series_store() function (insert or replace, with counts).
import { boundedText } from "../thumbs-ingest.server";
import { plainIssue } from "../crops";
import { SERIES_BODY_LIMIT, dedupePoints, seriesPayload, type SeriesPoint } from "./series";

export type SeriesStore = {
  authenticate(request: Request): Promise<boolean>;
  /** Insert or replace each point; how many were new and how many replaced a stored value. */
  store(points: SeriesPoint[], runId: string, capturedAt: string): Promise<{ inserted: number; replaced: number }>;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleSeriesIngest(request: Request, store?: SeriesStore): Promise<Response> {
  try {
    const db = store ?? (await adminSeriesStore());
    if (!await db.authenticate(request)) return json({ error: "Missing or wrong x-crawl-secret" }, 401);
    const text = await boundedText(request, SERIES_BODY_LIMIT);
    if (text === null) return json({ error: `Body exceeds ${SERIES_BODY_LIMIT / 1024} KB` }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Body is not valid JSON" }, 400); }
    const parsed = seriesPayload.safeParse(raw);
    if (!parsed.success) return json({ error: plainIssue(parsed.error.issues as never) }, 400);
    const { run_id, captured_at, points } = parsed.data, unique = dedupePoints(points);
    const r = await db.store(unique, run_id, captured_at);
    return json({ ok: true, run_id, accepted: unique.length, inserted: r.inserted, replaced: r.replaced });
  } catch (error) {
    console.error("Series ingest failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Ingest failed" }, 500);
  }
}

async function adminSeriesStore(): Promise<SeriesStore> {
  const [{ supabaseAdmin: db }, { authenticateCrawler }] = await Promise.all([import("@/integrations/supabase/client.server"), import("../crawl-ingest.server")]);
  return {
    authenticate: authenticateCrawler,
    async store(points, runId, capturedAt) {
      const { data, error } = await db.rpc("outside_series_store", { p_points: points as never, p_run_id: runId, p_captured_at: capturedAt });
      if (error) throw new Error("outside_series_store failed");
      const d = (data ?? {}) as { inserted?: number; replaced?: number };
      return { inserted: Number(d.inserted ?? 0), replaced: Number(d.replaced ?? 0) };
    },
  };
}
