// POST /api/public/ingest-thumbs and /api/public/thumb-optout. Crawler-secret auth runs before the body is read.
// Never logs payloads or image bytes; storage writes and row writes go through an injectable store (tests use memory).
import { checkImage, decodeB64, optoutPayload, pruneOld, allPaths, thumbPath, thumbPayload, THUMB_LIMITS, type ThumbRow, type ThumbVariant, type Viewport } from "./thumbs";

export const BUCKET = "site-thumbs";
export type ThumbStore = {
  authenticate(request: Request): Promise<boolean>;
  activeDomains(domains: string[]): Promise<Set<string>>;
  optedOut(domains: string[]): Promise<Set<string>>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  upsertRow(row: Omit<ThumbRow, "id"> & { source_run_id: string | null }): Promise<"ok" | "opted_out">;
  rows(domain: string, viewport?: string): Promise<(ThumbRow & { id: number })[]>;
  removeObjects(paths: string[]): Promise<void>;
  deleteRows(ids: number[]): Promise<void>;
  addOptout(domain: string, note: string | null): Promise<void>;
  removeOptout(domain: string): Promise<void>;
};

export async function boundedText(request: Request, limit: number): Promise<string | null> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return null; } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(size); let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(out);
}

type Result = { domain: string; viewport: Viewport; captured_at: string; status: "stored" | "rejected"; reason?: string; path?: string };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleThumbIngest(request: Request, store?: ThumbStore): Promise<Response> {
  try {
    const db = store ?? (await adminStore());
    if (!await db.authenticate(request)) return json({ error: "forbidden" }, 403);
    const text = await boundedText(request, THUMB_LIMITS.requestBytes);
    if (text === null) return json({ error: "Body exceeds 4 MB" }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
    const parsed = thumbPayload.safeParse(raw);
    if (!parsed.success) return json({ error: "Invalid input", issues: parsed.error.issues.slice(0, 20).map(({ path, message }) => ({ path: path.join("."), message })) }, 400);
    const { captures, run_id } = parsed.data, domains = [...new Set(captures.map(c => c.domain))];
    const [active, opted] = await Promise.all([db.activeDomains(domains), db.optedOut(domains)]);
    const results: Result[] = [], touched = new Set<string>();
    for (const c of captures) {
      const base = { domain: c.domain, viewport: c.viewport, captured_at: c.captured_at };
      const reject = (reason: string) => results.push({ ...base, status: "rejected", reason });
      if (opted.has(c.domain)) { reject("opted_out"); continue; }
      if (!active.has(c.domain)) { reject("unknown_domain"); continue; }
      const full = checkImage(decodeB64(c.images.full), THUMB_LIMITS.maxWidth, THUMB_LIMITS.maxHeight);
      if (!full.ok) { reject(`full:${full.reason}`); continue; }
      const variants: (ThumbVariant & { data: Uint8Array })[] = []; let bad: string | null = null;
      for (const w of THUMB_LIMITS.variants) {
        const b = c.images[`w${w}` as "w640" | "w320"]; if (!b) continue;
        const data = decodeB64(b), v = checkImage(data, w, THUMB_LIMITS.maxHeight);
        if (!v.ok) { bad = `w${w}:${v.reason}`; break; }
        if (Math.abs(v.width / v.height - full.width / full.height) > 0.03) { bad = `w${w}:aspect_mismatch`; break; }
        variants.push({ w: v.width, h: v.height, bytes: v.bytes, path: thumbPath(c.domain, c.captured_at, c.viewport, w), data });
      }
      if (bad) { reject(bad); continue; }
      const path = thumbPath(c.domain, c.captured_at, c.viewport);
      await db.upload(path, decodeB64(c.images.full));
      for (const v of variants) await db.upload(v.path, v.data);
      const r = await db.upsertRow({ domain: c.domain, captured_at: c.captured_at, viewport: c.viewport, path, width: full.width, height: full.height, bytes: full.bytes,
        variants: variants.map(({ data: _d, ...v }) => v), removed_at: null, source_run_id: run_id ?? null });
      if (r === "opted_out") { await db.removeObjects([path, ...variants.map(v => v.path)]); reject("opted_out"); continue; }
      results.push({ ...base, status: "stored", path }); touched.add(`${c.domain}|${c.viewport}`);
    }
    let pruned = 0;
    for (const k of touched) {
      const [domain, viewport] = k.split("|") as [string, string];
      const old = pruneOld(await db.rows(domain, viewport));
      if (!old.length) continue;
      await db.removeObjects(old.flatMap(allPaths)); await db.deleteRows(old.map(r => r.id)); pruned += old.length;
    }
    const stored = results.filter(r => r.status === "stored").length;
    return json({ ok: true, stored, rejected: results.length - stored, pruned, results });
  } catch (error) {
    console.error("Thumbnail ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Internal error" }, 500);
  }
}

/** Opt-out admin path: add (hide + delete every stored capture: thumbnails, section crops, site icons and social cards) or remove (allow future captures). */
export async function handleThumbOptout(request: Request, store?: ThumbStore, cropStore?: import("./crops-ingest.server").CropStore | null): Promise<Response> {
  try {
    const db = store ?? (await adminStore());
    if (!await db.authenticate(request)) return json({ error: "forbidden" }, 403);
    const text = await boundedText(request, 4096);
    if (text === null) return json({ error: "Body exceeds 4 KB" }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
    const p = optoutPayload.safeParse(raw);
    if (!p.success) return json({ error: "Invalid input", issues: p.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, 400);
    const { domain, note, action } = p.data;
    if (action === "remove") { await db.removeOptout(domain); return json({ ok: true, domain, action, deleted: 0 }); }
    await db.addOptout(domain, note ?? null);
    const rows = await db.rows(domain);
    if (rows.length) { await db.removeObjects(rows.flatMap(allPaths)); await db.deleteRows(rows.map(r => r.id)); }
    // Section crops follow the same opt-out (an injected thumb store without a crop store skips them, as in older tests).
    const crops = cropStore === undefined && store ? null : cropStore;
    if (crops === null) return json({ ok: true, domain, action, deleted: rows.length });
    const { deleteImagesFor } = await import("./crops-ingest.server");
    const gone = await deleteImagesFor(domain, crops);
    return json({ ok: true, domain, action, deleted: rows.length, crops_deleted: gone.crops, assets_deleted: gone.assets, surfaces_deleted: gone.surfaces });
  } catch (error) {
    console.error("Thumbnail opt-out failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Internal error" }, 500);
  }
}

async function adminStore(): Promise<ThumbStore> {
  const [{ supabaseAdmin: db }, { authenticateCrawler }] = await Promise.all([import("@/integrations/supabase/client.server"), import("./crawl-ingest.server")]);
  const fail = (what: string) => { throw new Error(what); };
  return {
    authenticate: authenticateCrawler,
    async activeDomains(domains) {
      const lib = await db.from("library_sites").select("domain").in("domain", domains).or("active.eq.true,onboarding.eq.true"); // R2a-2 · onboarding brands are stored like any brand
      if (lib.error) fail("Library lookup failed");
      const run = await db.from("crawl_runs").select("id").eq("status", "finished").order("finished_at", { ascending: false }).limit(1).maybeSingle();
      if (run.error) fail("Crawl lookup failed");
      const crawl = run.data ? await db.from("crawl_sites").select("domain").eq("run_id", run.data.id).eq("ok", true).in("domain", domains) : { data: [], error: null };
      if (crawl.error) fail("Crawl site lookup failed");
      return new Set([...(lib.data ?? []), ...(crawl.data ?? [])].map(r => r.domain));
    },
    async optedOut(domains) { const r = await db.from("thumb_optouts").select("domain").in("domain", domains); if (r.error) fail("Opt-out lookup failed"); return new Set((r.data ?? []).map(x => x.domain)); },
    async upload(path, bytes) { const r = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true, cacheControl: "3600" }); if (r.error) fail("Thumbnail upload failed"); },
    async upsertRow(row) {
      const r = await db.from("site_thumbs").upsert({ ...row, variants: row.variants as never }, { onConflict: "path" });
      if (r.error) { if (r.error.code === "23514" && /opt-out/.test(r.error.message)) return "opted_out"; fail("Thumbnail row write failed"); }
      return "ok";
    },
    async rows(domain, viewport) {
      let q = db.from("site_thumbs").select("id,domain,captured_at,viewport,path,width,height,bytes,variants,removed_at").eq("domain", domain);
      if (viewport) q = q.eq("viewport", viewport);
      const r = await q.order("captured_at", { ascending: false }).limit(200); if (r.error) fail("Thumbnail lookup failed");
      return (r.data ?? []) as (ThumbRow & { id: number })[];
    },
    async removeObjects(paths) { for (let i = 0; i < paths.length; i += 100) { const r = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100)); if (r.error) fail("Thumbnail delete failed"); } },
    async deleteRows(ids) { const r = await db.from("site_thumbs").delete().in("id", ids); if (r.error) fail("Thumbnail row delete failed"); },
    async addOptout(domain, note) { const r = await db.from("thumb_optouts").upsert({ domain, note }, { onConflict: "domain" }); if (r.error) fail("Opt-out write failed"); },
    async removeOptout(domain) { const r = await db.from("thumb_optouts").delete().eq("domain", domain); if (r.error) fail("Opt-out delete failed"); },
  };
}

/** GET /thumbs/<path>: serves a stored capture only while its row is visible (not removed, not opted out). */
export async function serveThumb(path: string): Promise<Response> {
  const { mainPathOf } = await import("./thumbs");
  const main = mainPathOf(path);
  const nf = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  if (!main) return nf();
  const { supabaseAnon } = await import("./mcp/supabase");
  const row = await supabaseAnon().from("site_thumbs").select("path,variants").eq("path", main).maybeSingle();
  if (row.error || !row.data) return nf();
  if (path !== main && !((row.data.variants as ThumbVariant[] | null) ?? []).some(v => v.path === path)) return nf();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const file = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (file.error || !file.data) return nf();
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  return new Response(bytes as BodyInit, { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Cache-Control": "public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
}
