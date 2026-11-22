// W3a · POST /api/public/ingest-art (crawler secret, checked before the body is read), the owner's removal, and the thumbnail served
// at /crops/art/<file> while its work is not removed. Never logs payloads or bytes. Writes go through an injectable store, so tests
// use memory and nothing is written to the shared database or bucket.
import { boundedText } from "../thumbs-ingest.server";
import { plainIssue } from "../crops";
import { ART_LIMITS, artPath, artPayload, checkWork, isArtPath, workFields, workHashInput, type ArtRefusal, type ArtRemove, type ArtSource } from "./contract";

export type StoredWork = { source: ArtSource; source_id: string; thumb: string | null; thumb_hash: string | null; removed_at: string | null };
export type ArtStore = {
  authenticate(request: Request): Promise<boolean>;
  /** Stored rows (removed ones included) for these keys. */
  existing(keys: { source: ArtSource; source_id: string }[]): Promise<StoredWork[]>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  removeObjects(paths: string[]): Promise<void>;
  /** Insert a new work or update a stored, not-removed one (never a removed one). */
  save(row: ReturnType<typeof workFields> & { thumb: string; thumb_hash: string; run_id: string; seen: string }, isNew: boolean): Promise<"ok" | "removed">;
  touch(source: ArtSource, sourceId: string, seen: string): Promise<void>;
  /** Sets removed_at and the reason and clears the thumbnail path; null when there is no such work. */
  markRemoved(source: ArtSource, sourceId: string, reason: string, at: string): Promise<{ thumb: string | null } | null>;
  /** The thumbnail row at `path` when its work is visible to readers. */
  visible(path: string): Promise<boolean>;
  download(path: string): Promise<Uint8Array | null>;
};
export type ArtRefused = { source: string; source_id: string; reason: ArtRefusal };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
export const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

export async function handleArtIngest(request: Request, store?: ArtStore, now = () => new Date().toISOString()): Promise<Response> {
  try {
    const db = store ?? (await adminArtStore());
    if (!await db.authenticate(request)) return json({ error: "Missing or wrong x-crawl-secret" }, 401);
    const text = await boundedText(request, ART_LIMITS.requestBytes);
    if (text === null) return json({ error: "Body exceeds 1 MB" }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Body is not valid JSON" }, 400); }
    const parsed = artPayload.safeParse(raw);
    if (!parsed.success) return json({ error: plainIssue(parsed.error.issues as never) }, 400);
    const { run_id, works } = parsed.data, seen = now();
    const stored = new Map((await db.existing(works.map(w => ({ source: w.source, source_id: w.source_id })))).map(r => [`${r.source}:${r.source_id}`, r]));
    let saved = 0, unchanged = 0; const refused: ArtRefused[] = [], done = new Set<string>();
    for (const w of works) {
      const key = `${w.source}:${w.source_id}`, refuse = (reason: ArtRefusal) => { refused.push({ source: w.source, source_id: w.source_id, reason }); };
      if (done.has(key)) { unchanged++; continue; }
      done.add(key);
      const old = stored.get(key);
      // A work removed on request is never stored again, whatever the crawler sends.
      if (old?.removed_at) { refuse("removed"); continue; }
      const check = checkWork(w);
      if (!check.ok) { refuse(check.reason); continue; }
      const hash = await sha256(workHashInput(w));
      if (old && old.thumb_hash === hash) { await db.touch(w.source, w.source_id, seen); unchanged++; continue; }
      const path = artPath(w.source, w.source_id, hash);
      await db.upload(path, check.bytes);
      const r = await db.save({ ...workFields(w), thumb: path, thumb_hash: hash, run_id, seen }, !old);
      if (r === "removed") { await db.removeObjects([path]); refuse("removed"); continue; }
      if (old?.thumb && old.thumb !== path) await db.removeObjects([old.thumb]).catch(() => null);
      saved++;
    }
    return json({ stored: saved, unchanged, refused });
  } catch (error) {
    console.error("Art ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Internal error" }, 500);
  }
}

/** The owner's removal: the row keeps its record (removed_at, reason) and its thumbnail is deleted from storage. */
export async function removeArtWork(r: ArtRemove, store?: ArtStore, at = new Date().toISOString()): Promise<{ removed: true; thumb_deleted: boolean } | { refused: string } | null> {
  const db = store ?? (await adminArtStore());
  const [old] = await db.existing([{ source: r.source, source_id: r.source_id }]);
  if (!old) return null;
  if (old.removed_at) return { refused: `${r.source} ${r.source_id} was already removed on ${old.removed_at.slice(0, 10)}.` };
  const m = await db.markRemoved(r.source, r.source_id, r.reason, at);
  if (!m) return null;
  if (m.thumb) await db.removeObjects([m.thumb]);
  return { removed: true, thumb_deleted: !!m.thumb };
}

/** GET /crops/art/<file>: only while the work is visible (not removed). */
export async function serveArt(path: string, store?: ArtStore): Promise<Response> {
  const nf = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, max-age=300" } });
  if (!isArtPath(path)) return nf();
  try {
    const db = store ?? (await adminArtStore());
    if (!await db.visible(path)) return nf();
    const bytes = await db.download(path);
    if (!bytes) return nf();
    return new Response(bytes as BodyInit, { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    console.error("Art serving failed", error instanceof Error ? error.name : "UnknownError");
    return nf();
  }
}

export const ART_BUCKET = "site-crops";
async function adminArtStore(): Promise<ArtStore> {
  const [{ supabaseAdmin: db }, { authenticateCrawler }, { supabaseAnon }] = await Promise.all([import("@/integrations/supabase/client.server"), import("../crawl-ingest.server"), import("../mcp/supabase")]);
  const fail = (what: string): never => { throw new Error(what); };
  return {
    authenticate: authenticateCrawler,
    async existing(keys) {
      const out: StoredWork[] = [];
      for (const source of ["met", "aic"] as const) {
        const ids = keys.filter(k => k.source === source).map(k => k.source_id);
        if (!ids.length) continue;
        const r = await db.from("art_works").select("source,source_id,thumb,thumb_hash,removed_at").eq("source", source).in("source_id", ids);
        if (r.error) fail("Art lookup failed");
        out.push(...((r.data ?? []) as StoredWork[]));
      }
      return out;
    },
    async upload(path, bytes) { const r = await db.storage.from(ART_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true, cacheControl: "86400" }); if (r.error) fail("Art upload failed"); },
    async removeObjects(paths) { if (!paths.length) return; const r = await db.storage.from(ART_BUCKET).remove(paths); if (r.error) fail("Art delete failed"); },
    async save(row, isNew) {
      const { seen, palette, ...rest } = row, fields = { ...rest, palette: palette as never, last_seen: seen };
      if (isNew) {
        const r = await db.from("art_works").insert({ ...fields, first_seen: seen });
        if (r.error) { if (r.error.code === "23505") return (this as ArtStore).save(row, false); fail("Art row write failed"); }
        return "ok";
      }
      const r = await db.from("art_works").update(fields).eq("source", row.source).eq("source_id", row.source_id).is("removed_at", null).select("id");
      if (r.error) fail("Art row write failed");
      return r.data?.length ? "ok" : "removed";
    },
    async touch(source, sourceId, seen) { const r = await db.from("art_works").update({ last_seen: seen }).eq("source", source).eq("source_id", sourceId).is("removed_at", null); if (r.error) fail("Art touch failed"); },
    async markRemoved(source, sourceId, reason, at) {
      const cur = await db.from("art_works").select("thumb").eq("source", source).eq("source_id", sourceId).is("removed_at", null).maybeSingle();
      if (cur.error) fail("Art lookup failed");
      if (!cur.data) return null;
      const r = await db.from("art_works").update({ removed_at: at, removed_reason: reason, thumb: null }).eq("source", source).eq("source_id", sourceId).is("removed_at", null);
      if (r.error) fail("Art removal failed");
      return { thumb: cur.data.thumb };
    },
    // Visibility is read with the anonymous client, so the "not removed" policy applies exactly as it does for readers.
    async visible(path) { const r = await supabaseAnon().from("art_works").select("id").eq("thumb", path).limit(1); if (r.error) fail("Art lookup failed"); return !!r.data?.length; },
    async download(path) { const r = await db.storage.from(ART_BUCKET).download(path); if (r.error || !r.data) return null; return new Uint8Array(await r.data.arrayBuffer()); },
  };
}
