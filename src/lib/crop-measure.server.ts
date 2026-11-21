// I3b · each new section crop is measured once from its pixels and stored in crop_quality, the same way the I3 script measured the
// first 1,369: at intake while the request has time (CROP_MEASURE_MS), else by the scheduled sweep (newest crops without a row).
// Decoding is pure TypeScript (@stacksjs/ts-webp, bit-exact with libwebp for lossy VP8) and happens in memory; nothing is logged.
import { cropStats } from "./crop-stats";
import { leadQuality } from "./lead-picture";

/** Intake measures while the request is younger than this; the rest wait for the sweep. */
export const CROP_MEASURE_MS = 4_000;
/** The sweep's share of one scheduled worker call, and how many newest crops it looks at. */
export const CROP_SWEEP_MS = 5_000, CROP_SWEEP_LOOK = 300;
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export type CropMeta = { path: string; width: number; height: number; bytes: number; domain: string };

export async function measureCrop(db: Admin, c: CropMeta, data: Uint8Array, optedOut: ReadonlySet<string> = new Set()): Promise<{ ok: boolean; ms: number }> {
  const t = Date.now(), { decode } = await import("@stacksjs/ts-webp");
  const img = decode(data), s = cropStats(img.data, img.width, img.height, data.length), q = leadQuality({ width: c.width, height: c.height, bytes: c.bytes, domain: c.domain }, { stats: s, optedOut });
  const { error } = await db.from("crop_quality").upsert({ path: c.path, lead_ok: q.ok, reason: q.reason, luma_std: s.std, top_share: s.top, edge_mean: s.edges, bytes_per_px: s.bpp, method: "pixels" }, { onConflict: "path" });
  if (error) throw new Error("crop_quality write failed");
  return { ok: q.ok, ms: Date.now() - t };
}

/** The sweep: the newest crops without a measurement, measured until `limitMs` has passed. */
export async function measurePendingCrops(o: { limitMs?: number; look?: number } = {}): Promise<{ measured: number; pending: number; ms: number }> {
  const start = Date.now(), limit = o.limitMs ?? CROP_SWEEP_MS;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { CROP_BUCKET } = await import("./crops-ingest.server");
  // W1c: first screens of other pages (surface_crops) are swept the same way as homepage section crops.
  const [site, surf] = await Promise.all([
    db.from("site_crops").select("path,width,height,bytes,domain").order("id", { ascending: false }).limit(o.look ?? CROP_SWEEP_LOOK),
    db.from("surface_crops").select("path,width,height,bytes,domain").order("id", { ascending: false }).limit(o.look ?? CROP_SWEEP_LOOK),
  ]);
  if (site.error || surf.error) throw new Error("crop lookup failed");
  const crops = [...(surf.data ?? []), ...(site.data ?? [])];
  const paths = (crops ?? []).map(c => c.path), have = new Set<string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data, error: qe } = await db.from("crop_quality").select("path").in("path", paths.slice(i, i + 100));
    if (qe) throw new Error("crop_quality lookup failed");
    for (const r of data ?? []) have.add(r.path);
  }
  const todo = (crops ?? []).filter(c => !have.has(c.path));
  const { data: opt } = await db.from("thumb_optouts").select("domain");
  const opted = new Set((opt ?? []).map(r => r.domain as string));
  let measured = 0;
  for (const c of todo) {
    if (Date.now() - start > limit) break;
    const f = await db.storage.from(CROP_BUCKET).download(c.path);
    if (f.error || !f.data) continue;
    await measureCrop(db, c as CropMeta, new Uint8Array(await f.data.arrayBuffer()), opted).then(() => { measured++; }).catch(() => null);
  }
  return { measured, pending: todo.length - measured, ms: Date.now() - start };
}
