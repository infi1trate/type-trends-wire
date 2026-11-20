// POST /api/public/ingest-crops and GET /crops/<path>. Crawler-secret auth runs before the body is read; never logs payloads or bytes.
// Storage and row writes go through an injectable store (tests use memory; nothing is written to the shared database or bucket).
import { boundedText } from "./thumbs-ingest.server";
import { CROP_LIMITS, checkCrop, cropEvictions, cropPath, cropPayload, decodeCrop, isCropSection, parseCropPath, planCrop, plainIssue, type CropRefusal, type CropRow, type CropSection } from "./crops";
import { ASSET_LIMITS, assetPath, checkAsset, isAssetKind, parseAssetPath, type AssetKind, type AssetRefusal, type AssetRow } from "./brand-assets";

export const CROP_BUCKET = "site-crops";
export type StoredCrop = CropRow & { id: number };
export type StoredAsset = AssetRow & { id: number };
export type CropStore = {
  authenticate(request: Request): Promise<boolean>;
  /** Active library sites among `domains`. */
  trackedDomains(domains: string[]): Promise<Set<string>>;
  optedOut(domains: string[]): Promise<Set<string>>;
  /** Stored versions of one domain + section + viewport. */
  versions(domain: string, section: CropSection, viewport: string): Promise<StoredCrop[]>;
  touch(id: number, lastSeenAt: string): Promise<void>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  insert(row: Omit<CropRow, "id">): Promise<"ok" | "exists" | "opted_out">;
  removeObjects(paths: string[]): Promise<void>;
  deleteRows(ids: number[]): Promise<void>;
  /** E2c · crop ids among `ids` that a published story cites (never evicted by history). Absent = none. */
  keptIds?(ids: number[]): Promise<Set<number>>;
  /** Every stored version of a domain (opt-out cleanup). */
  domainRows(domain: string): Promise<StoredCrop[]>;
  /** The visible row at `path` (hidden when the domain opted out), for serving. */
  visibleRow(path: string): Promise<{ domain: string } | null>;
  download(path: string): Promise<Uint8Array | null>;
  // I1 · brand assets (site icon, social card): their own table, the same bucket under assets/.
  assetVersions(domain: string, kind: AssetKind): Promise<StoredAsset[]>;
  touchAsset(id: number, lastSeenAt: string): Promise<void>;
  insertAsset(row: Omit<AssetRow, "id">): Promise<"ok" | "exists" | "opted_out">;
  deleteAssetRows(ids: number[]): Promise<void>;
  domainAssets(domain: string): Promise<StoredAsset[]>;
  /** The visible asset row at `path` (hidden when the domain opted out), for serving. */
  visibleAsset(path: string): Promise<{ domain: string } | null>;
};

export type CropRefused = { domain: string; section: string; reason: CropRefusal | AssetRefusal };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleCropIngest(request: Request, store?: CropStore): Promise<Response> {
  try {
    const db = store ?? (await adminCropStore());
    if (!await db.authenticate(request)) return json({ error: "Missing or wrong x-crawl-secret" }, 401);
    const text = await boundedText(request, CROP_LIMITS.requestBytes);
    if (text === null) return json({ error: "Body exceeds 4 MB" }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Body is not valid JSON" }, 400); }
    const parsed = cropPayload.safeParse(raw);
    if (!parsed.success) return json({ error: plainIssue(parsed.error.issues as never) }, 400);
    const { run_id, captures } = parsed.data, domains = [...new Set(captures.map(c => c.domain))];
    const [tracked, opted] = await Promise.all([db.trackedDomains(domains), db.optedOut(domains)]);
    let stored = 0, unchanged = 0; const refused: CropRefused[] = [], touched = new Set<string>(), touchedAssets = new Set<string>();
    for (const c of captures) {
      const refuse = (reason: CropRefusal | AssetRefusal) => { refused.push({ domain: c.domain, section: c.section, reason }); };
      if (opted.has(c.domain)) { refuse("opted_out"); continue; }
      if (!tracked.has(c.domain)) { refuse("untracked_domain"); continue; }
      const bytes = decodeCrop(c.webp_base64);
      // Each capture is accepted or refused on its own: a site icon or social card goes to brand assets, a section to crops.
      if (isAssetKind(c.section)) {
        const kind = c.section, check = checkAsset(kind, bytes, c);
        if (!check.ok) { refuse(check.reason); continue; }
        const path = assetPath(c.domain, kind, c.captured_at, c.hash);
        const plan = planCrop((await db.assetVersions(c.domain, kind)).map(a => ({ ...a, section: a.kind, viewport: "desktop" })), { hash: c.hash, captured_at: c.captured_at, path });
        if (plan.action === "unchanged") { await db.touchAsset(plan.row.id, plan.last_seen_at); unchanged++; continue; }
        await db.upload(path, bytes);
        const r = await db.insertAsset({ domain: c.domain, kind, captured_at: c.captured_at, first_seen_at: c.captured_at, last_seen_at: c.captured_at,
          path, width: check.width, height: check.height, bytes: check.bytes, hash: c.hash, run_id });
        if (r === "opted_out") { await db.removeObjects([path]); refuse("opted_out"); continue; }
        if (r === "exists") { unchanged++; continue; }
        stored++; touchedAssets.add(`${c.domain}|${kind}`);
        continue;
      }
      if (!isCropSection(c.section)) { refuse("bad_webp"); continue; }
      const section = c.section, check = checkCrop(bytes, c);
      if (!check.ok) { refuse(check.reason); continue; }
      const path = cropPath(c.domain, section, c.captured_at, c.hash);
      const plan = planCrop(await db.versions(c.domain, section, c.viewport), { hash: c.hash, captured_at: c.captured_at, path });
      if (plan.action === "unchanged") { await db.touch(plan.row.id, plan.last_seen_at); unchanged++; continue; }
      await db.upload(path, bytes);
      const r = await db.insert({ domain: c.domain, section, viewport: c.viewport, captured_at: c.captured_at, first_seen_at: c.captured_at, last_seen_at: c.captured_at,
        path, width: check.width, height: check.height, bytes: check.bytes, hash: c.hash, run_id });
      if (r === "opted_out") { await db.removeObjects([path]); refuse("opted_out"); continue; }
      if (r === "exists") { unchanged++; continue; }
      stored++; touched.add(`${c.domain}|${section}|${c.viewport}`);
    }
    for (const k of touched) {
      const [domain, section, viewport] = k.split("|") as [string, CropSection, string];
      const versions = await db.versions(domain, section, viewport);
      if (!cropEvictions(versions).length) continue;
      // E2c: crops a published story cites are kept; the 12 apply to the rest.
      // When that cannot be read, nothing is evicted this time (the next new version tries again).
      const kept = db.keptIds ? await db.keptIds(versions.map(v => v.id)).catch(() => null) : new Set<number>();
      if (!kept) continue;
      const old = cropEvictions(versions, CROP_LIMITS.keep, kept);
      if (!old.length) continue;
      await db.removeObjects(old.map(o => o.path)); await db.deleteRows(old.map(o => o.id));
    }
    // Brand assets keep the same history rule: the newest 12 versions per brand + kind.
    for (const k of touchedAssets) {
      const [domain, kind] = k.split("|") as [string, AssetKind];
      const old = cropEvictions((await db.assetVersions(domain, kind)).map(a => ({ ...a, section: a.kind, viewport: "desktop" })), ASSET_LIMITS.keep);
      if (!old.length) continue;
      await db.removeObjects(old.map(o => o.path)); await db.deleteAssetRows(old.map(o => o.id));
    }
    return json({ stored, unchanged, refused });
  } catch (error) {
    console.error("Crop ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Internal error" }, 500);
  }
}

/** Opt-out cleanup: deletes every stored crop and brand asset (objects, then rows) of a domain. Returns how many versions of each were removed. */
export async function deleteImagesFor(domain: string, store?: CropStore): Promise<{ crops: number; assets: number }> {
  const db = store ?? (await adminCropStore());
  const [rows, assets] = await Promise.all([db.domainRows(domain), db.domainAssets(domain)]);
  if (rows.length) { await db.removeObjects(rows.map(r => r.path)); await db.deleteRows(rows.map(r => r.id)); }
  if (assets.length) { await db.removeObjects(assets.map(r => r.path)); await db.deleteAssetRows(assets.map(r => r.id)); }
  return { crops: rows.length, assets: assets.length };
}
/** Opt-out cleanup, crops count only (assets are deleted with them). */
export const deleteCropsFor = async (domain: string, store?: CropStore): Promise<number> => (await deleteImagesFor(domain, store)).crops;

/** GET /crops/<path>: serves a stored crop only while its row is visible and its domain has not opted out. */
export async function serveCrop(path: string, store?: CropStore): Promise<Response> {
  const nf = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, max-age=300" } });
  const asset = parseAssetPath(path), ref = asset ?? parseCropPath(path);
  if (!ref) return nf();
  try {
    const db = store ?? (await adminCropStore());
    const [row, opted] = await Promise.all([asset ? db.visibleAsset(path) : db.visibleRow(path), db.optedOut([ref.domain])]);
    if (!row || row.domain !== ref.domain || opted.has(ref.domain)) return nf();
    const bytes = await db.download(path);
    if (!bytes) return nf();
    // Paths are content-addressed (date + hash), so readers may keep a copy; `private` keeps shared caches out because the page is gated.
    return new Response(bytes as BodyInit, { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Cache-Control": "private, max-age=604800, immutable", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    console.error("Crop serving failed", error instanceof Error ? error.name : "UnknownError");
    return nf();
  }
}

async function adminCropStore(): Promise<CropStore> {
  const [{ supabaseAdmin: db }, { authenticateCrawler }, { supabaseAnon }] = await Promise.all([import("@/integrations/supabase/client.server"), import("./crawl-ingest.server"), import("./mcp/supabase")]);
  const fail = (what: string) => { throw new Error(what); };
  const COLS = "id,domain,section,viewport,captured_at,first_seen_at,last_seen_at,path,width,height,bytes,hash,run_id";
  const ACOLS = "id,domain,kind,captured_at,first_seen_at,last_seen_at,path,width,height,bytes,hash,run_id";
  return {
    authenticate: authenticateCrawler,
    async trackedDomains(domains) { const r = await db.from("library_sites").select("domain").in("domain", domains).eq("active", true); if (r.error) fail("Library lookup failed"); return new Set((r.data ?? []).map(x => x.domain)); },
    async optedOut(domains) { const r = await db.from("thumb_optouts").select("domain").in("domain", domains); if (r.error) fail("Opt-out lookup failed"); return new Set((r.data ?? []).map(x => x.domain)); },
    async versions(domain, section, viewport) {
      const r = await db.from("site_crops").select(COLS).eq("domain", domain).eq("section", section).eq("viewport", viewport).order("captured_at", { ascending: false }).limit(100);
      if (r.error) fail("Crop lookup failed"); return (r.data ?? []) as StoredCrop[];
    },
    async touch(id, lastSeenAt) { const r = await db.from("site_crops").update({ last_seen_at: lastSeenAt }).eq("id", id); if (r.error) fail("Crop touch failed"); },
    async upload(path, bytes) { const r = await db.storage.from(CROP_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true, cacheControl: "604800" }); if (r.error) fail("Crop upload failed"); },
    async insert(row) {
      const r = await db.from("site_crops").insert(row);
      if (r.error) { if (r.error.code === "23514" && /opt-out/.test(r.error.message)) return "opted_out"; if (r.error.code === "23505") return "exists"; fail("Crop row write failed"); }
      return "ok";
    },
    async removeObjects(paths) { for (let i = 0; i < paths.length; i += 100) { const r = await db.storage.from(CROP_BUCKET).remove(paths.slice(i, i + 100)); if (r.error) fail("Crop delete failed"); } },
    async deleteRows(ids) { const r = await db.from("site_crops").delete().in("id", ids); if (r.error) fail("Crop row delete failed"); },
    async keptIds(ids) {
      if (!ids.length) return new Set();
      const r = await db.from("story_kept_crops").select("crop_id,story_id").in("crop_id", ids);
      if (r.error) fail("Kept crop lookup failed");
      const rows = r.data ?? []; if (!rows.length) return new Set();
      const { publishedStoryIds } = await import("./stories/kept-crops.server");
      const live = await publishedStoryIds(db, [...new Set(rows.map(x => x.story_id))]);
      return new Set(rows.filter(x => live.has(x.story_id)).map(x => x.crop_id));
    },
    async domainRows(domain) { const r = await db.from("site_crops").select(COLS).eq("domain", domain).limit(1000); if (r.error) fail("Crop lookup failed"); return (r.data ?? []) as StoredCrop[]; },
    // Serving checks visibility with the anonymous client, so the opt-out policy applies exactly as it does for readers.
    async visibleRow(path) { const r = await supabaseAnon().from("site_crops").select("domain").eq("path", path).maybeSingle(); if (r.error) fail("Crop lookup failed"); return r.data ?? null; },
    async assetVersions(domain, kind) {
      const r = await db.from("brand_assets").select(ACOLS).eq("domain", domain).eq("kind", kind).order("captured_at", { ascending: false }).limit(100);
      if (r.error) fail("Asset lookup failed"); return (r.data ?? []) as StoredAsset[];
    },
    async touchAsset(id, lastSeenAt) { const r = await db.from("brand_assets").update({ last_seen_at: lastSeenAt }).eq("id", id); if (r.error) fail("Asset touch failed"); },
    async insertAsset(row) {
      const r = await db.from("brand_assets").insert(row);
      if (r.error) { if (r.error.code === "23514" && /opt-out/.test(r.error.message)) return "opted_out"; if (r.error.code === "23505") return "exists"; fail("Asset row write failed"); }
      return "ok";
    },
    async deleteAssetRows(ids) { const r = await db.from("brand_assets").delete().in("id", ids); if (r.error) fail("Asset row delete failed"); },
    async domainAssets(domain) { const r = await db.from("brand_assets").select(ACOLS).eq("domain", domain).limit(1000); if (r.error) fail("Asset lookup failed"); return (r.data ?? []) as StoredAsset[]; },
    async visibleAsset(path) { const r = await supabaseAnon().from("brand_assets").select("domain").eq("path", path).maybeSingle(); if (r.error) fail("Asset lookup failed"); return r.data ?? null; },
    async download(path) { const f = await db.storage.from(CROP_BUCKET).download(path); if (f.error || !f.data) return null; return new Uint8Array(await f.data.arrayBuffer()); },
  };
}
