import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { DAY, FEEDS, HN_QUERIES, parseFeed, parseHn, recentUnique, snapshotRows, type Font, type WireItem } from "./ingest";

async function logRun(job: string, started: Date, ok: boolean, rows: number, detail: Record<string, unknown>) {
  const { error } = await db.from("ingest_runs").insert({ job, started_at: started.toISOString(), finished_at: new Date().toISOString(), ok, rows_written: rows, detail: JSON.parse(JSON.stringify(detail)) });
  if (error) throw new Error(`Run receipt: ${error.message}`);
}
export async function ingestFonts() {
  const started = new Date();
  let written = 0;
  try {
    const key = process.env['UDC_GOOGLE_FONTS_API_KEY'];
    const gatewayKey = process.env['LOVABLE_API_KEY'];
    if (!key || !gatewayKey) throw new Error("Google Fonts connection credentials not set");
    const list = async (sort: "popularity" | "trending") => {
      const r = await fetch(`https://connector-gateway.lovable.dev/udc_google_fonts/webfonts/v1/webfonts?sort=${sort}&capability=VF`, {
        headers: { Authorization: `Bearer ${gatewayKey}`, "X-Connection-Api-Key": key }, signal: AbortSignal.timeout(20000),
      });
      // Provider error bodies can echo credentials; persist only safe HTTP status.
      if (!r.ok) throw new Error(`Google Fonts ${sort}: HTTP ${r.status}`);
      const json = await r.json() as { items?: Font[] };
      if (!json.items?.length) throw new Error(`Google Fonts ${sort}: empty catalog`);
      return json.items;
    };
    const [pop, trend] = await Promise.all([list("popularity"), list("trending")]);
    const date = started.toISOString().slice(0, 10);
    const rows = snapshotRows(pop, trend, date);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db.from("gfont_snapshots").upsert(chunk, { onConflict: "captured_on,family" });
      if (error) throw new Error(error.message);
      written += chunk.length;
    }
    await logRun("ingest-gfonts", started, true, written, { date });
    return Response.json({ ok: true, date, families: written });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown ingestion error";
    await logRun("ingest-gfonts", started, false, written, { error });
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
export async function ingestWire() {
  const started = new Date();
  const failures: string[] = [];
  let written = 0;
  try {
    const since = Math.floor((started.getTime() - 7 * DAY) / 1000);
    const get = (url: string) => fetch(url, { headers: { "user-agent": "dsgn-terminal/0.1 (+https://brandon.wtf)" }, signal: AbortSignal.timeout(10000) });
    const jobs = [
      ...FEEDS.map((f) => ({ name: f.name, run: async () => {
        const r = await get(f.url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return parseFeed(await r.text(), f.name);
      } })),
      ...HN_QUERIES.map((q) => ({ name: `HN "${q}"`, run: async () => {
        const r = await get(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=50&numericFilters=created_at_i>${since}&query=${encodeURIComponent(q)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return parseHn(await r.json());
      } })),
    ];
    const collected: WireItem[] = [];
    // Six outbound connections maximum in the hosted runtime.
    for (let i = 0; i < jobs.length; i += 6) {
      await Promise.all(jobs.slice(i, i + 6).map(async (job) => {
        try { collected.push(...await job.run()); }
        catch (e) { failures.push(`${job.name}: ${e instanceof Error ? e.message : String(e)}`); }
      }));
    }
    const items = recentUnique(collected, started);
    if (failures.length === jobs.length) throw new Error("All wire sources failed");
    for (let i = 0; i < items.length; i += 500) {
      const { data, error } = await db.from("wire_items").upsert(items.slice(i, i + 500), { onConflict: "url", ignoreDuplicates: true }).select("id");
      if (error) throw new Error(error.message);
      written += data?.length ?? 0;
    }
    await logRun("ingest-wire", started, true, written, { failures, seen: items.length });
    return Response.json({ ok: true, seen: items.length, rows_written: written, failures });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown ingestion error";
    await logRun("ingest-wire", started, false, written, { failures, error });
    return Response.json({ ok: false, error, failures }, { status: 500 });
  }
}