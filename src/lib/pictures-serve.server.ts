// C1b Part 2 · /thumbs/* and /crops/* answered by `src/server.ts` before any page code loads. The host keeps no shared copy of a
// server response (its Cache API does nothing and `s-maxage` is not honoured), and the buckets are private (the workspace blocks
// public buckets; opt-outs and removals are enforced by the row checks below), so every picture request reaches an instance: on a
// cold one the old route loaded the app's server bundle and two database clients before it could pass 6 KB on.
// This module loads nothing but the dependency-free address rules: the same checks as serveThumb / serveCrop / serveArt (a visible
// row for exactly this address through the public read, the brand not opted out, then the stored bytes), with plain requests.
// A served picture is kept in this instance's memory for PICTURE_MEMORY_MS (well inside the hour a removal must take), never a 404.
import { cropRefOf, mainPathOf } from "./picture-paths";
import { restRows, storageBytes } from "./plain-rest.server";

/** A picture this instance served is served again from memory for at most this long (a removed picture stops within it). */
export const PICTURE_MEMORY_MS = 10 * 60_000;
/** The memory holds at most this many bytes of pictures (thumbnails are ~6–30 KB, crops ≤150 KB). */
export const PICTURE_MEMORY_BYTES = 8 * 1024 * 1024;
export const THUMB_BUCKET = "site-thumbs", CROP_BUCKET = "site-crops";

const NOSNIFF = { "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" } as const;
const HEADERS = {
  thumb: { ...NOSNIFF, "Cache-Control": "public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400" },
  crop: { ...NOSNIFF, "Cache-Control": "private, max-age=604800, immutable", "X-Robots-Tag": "noindex" },
  art: { ...NOSNIFF, "Cache-Control": "private, max-age=86400", "X-Robots-Tag": "noindex" },
} as const;
const notFound = (thumb: boolean) => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": thumb ? "public, max-age=300" : "private, max-age=300" } });

/** The reads this route makes, injectable for tests. `visible`: the public read of one table filtered by one column (RLS applies);
 *  `optedOut`: whether the brand opted out (service read, like serveCrop); `bytes`: the stored object, or null. */
export type PictureStore = {
  visible: (table: "site_thumbs" | "site_crops" | "brand_assets" | "surface_crops" | "art_works", column: "path" | "thumb", value: string, select: string) => Promise<Record<string, unknown> | null>;
  optedOut: (domain: string) => Promise<boolean>;
  bytes: (bucket: string, path: string) => Promise<Uint8Array | null>;
};

type Kept = { at: number; bytes: Uint8Array; kind: keyof typeof HEADERS };
const kept = new Map<string, Kept>();
let keptBytes = 0;
function keep(path: string, v: Kept, now: number) {
  if (v.bytes.length > PICTURE_MEMORY_BYTES / 8) return;
  const old = kept.get(path); if (old) { keptBytes -= old.bytes.length; kept.delete(path); }
  kept.set(path, v); keptBytes += v.bytes.length;
  for (const [k, x] of kept) { if (keptBytes <= PICTURE_MEMORY_BYTES && now - x.at < PICTURE_MEMORY_MS) break; kept.delete(k); keptBytes -= x.bytes.length; }
}
/** For tests: forget every kept picture. */
export const forgetPictures = () => { kept.clear(); keptBytes = 0; };

const answer = (v: Kept) => new Response(v.bytes as BodyInit, { headers: { ...HEADERS[v.kind], "Content-Length": String(v.bytes.length) } });

/** GET /thumbs/<path> or /crops/<path> (`route` names which). */
export async function servePicture(route: "thumbs" | "crops", path: string, store?: PictureStore, now = Date.now()): Promise<Response> {
  const thumb = route === "thumbs";
  const hit = kept.get(`${route}/${path}`);
  if (hit && now - hit.at < PICTURE_MEMORY_MS) return answer(hit);
  try {
    const db = store ?? plainStore();
    const found = thumb ? await thumbBytes(db, path) : await cropBytes(db, path);
    if (!found) return notFound(thumb);
    const v: Kept = { at: now, ...found };
    keep(`${route}/${path}`, v, now);
    return answer(v);
  } catch (error) {
    console.error("Picture serving failed", error instanceof Error ? error.name : "UnknownError");
    return notFound(thumb);
  }
}

async function thumbBytes(db: PictureStore, path: string): Promise<{ bytes: Uint8Array; kind: "thumb" } | null> {
  const main = mainPathOf(path);
  if (!main) return null;
  const row = await db.visible("site_thumbs", "path", main, "path,variants");
  if (!row) return null;
  const variants = Array.isArray(row["variants"]) ? (row["variants"] as { path?: unknown }[]) : [];
  if (path !== main && !variants.some(v => v?.path === path)) return null;
  const bytes = await db.bytes(THUMB_BUCKET, path);
  return bytes ? { bytes, kind: "thumb" } : null;
}

async function cropBytes(db: PictureStore, path: string): Promise<{ bytes: Uint8Array; kind: "crop" | "art" } | null> {
  const ref = cropRefOf(path);
  if (!ref) return null;
  if (ref.kind === "art") {
    if (!(await db.visible("art_works", "thumb", path, "id"))) return null;
    const bytes = await db.bytes(CROP_BUCKET, path);
    return bytes ? { bytes, kind: "art" } : null;
  }
  const table = ref.kind === "asset" ? "brand_assets" : ref.kind === "surface" ? "surface_crops" : "site_crops";
  const [row, opted] = await Promise.all([db.visible(table, "path", path, "domain"), db.optedOut(ref.domain)]);
  if (!row || row["domain"] !== ref.domain || opted) return null;
  const bytes = await db.bytes(CROP_BUCKET, path);
  return bytes ? { bytes, kind: "crop" } : null;
}

// PLAIN REQUESTS ------------------------------------------------------------------------------------------------------------------
function plainStore(): PictureStore {
  return {
    async visible(table, column, value, select) { return (await restRows("public", table, `select=${select}&${column}=eq.${encodeURIComponent(value)}&limit=1`))[0] ?? null; },
    async optedOut(domain) { return (await restRows("service", "thumb_optouts", `select=domain&domain=eq.${encodeURIComponent(domain)}&limit=1`)).length > 0; },
    bytes: storageBytes,
  };
}
