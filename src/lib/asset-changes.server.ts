// W1b · icon and card changes: measure each stored version once (asset_grids, at intake while the request has time, else the AI worker's
// sweep), and read every brand's versions with their verdicts (pure asset-diff.ts) for the latest changes, the brand page and the story engine.
// Reads are anonymous SELECTs (brand_assets hides opted-out brands by policy); writes use the service role. Nothing is logged.
import { assetComparisons, assetGrid, decodeGrid, encodeGrid, gridSpread, type AssetComparison, type AssetVersion, type Grid } from "./asset-diff";
import { memo } from "./memo";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export const ASSET_SWEEP_MS = 4_000;

export async function measureAsset(db: Admin, path: string, data: Uint8Array): Promise<void> {
  const { decode } = await import("@stacksjs/ts-webp");
  const img = decode(data), g = assetGrid(img.data, img.width, img.height);
  const { error } = await db.from("asset_grids").upsert({ path, grid: encodeGrid(g), spread: gridSpread(g), method: "rgb32-white" }, { onConflict: "path" });
  if (error) throw new Error("asset_grids write failed");
}
/** The sweep: stored icons and cards without a grid, measured until `limitMs` has passed. */
export async function measurePendingAssets(o: { limitMs?: number } = {}): Promise<{ measured: number; pending: number }> {
  const start = Date.now(), limit = o.limitMs ?? ASSET_SWEEP_MS;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [a, g] = await Promise.all([db.from("brand_assets").select("path").order("id", { ascending: false }).limit(2000), db.from("asset_grids").select("path").limit(5000)]);
  if (a.error || g.error) throw new Error("asset lookup failed");
  const have = new Set((g.data ?? []).map(r => r.path)), todo = (a.data ?? []).map(r => r.path).filter(p => !have.has(p));
  let measured = 0;
  for (const path of todo) {
    if (Date.now() - start > limit) break;
    const f = await db.storage.from("site-crops").download(path);
    if (f.error || !f.data) continue;
    await measureAsset(db, path, new Uint8Array(await f.data.arrayBuffer())).then(() => { measured++; }).catch(() => null);
  }
  return { measured, pending: todo.length - measured };
}

export type AssetHistory = { versions: AssetVersion[]; comparisons: AssetComparison[] };
/** Every visible icon and card version of active brands, and the verdict for each consecutive pair. Cached ten minutes. */
export const assetHistory = memo(10 * 60_000, async (): Promise<AssetHistory> => {
  const { supabaseAnon } = await import("./mcp/supabase"), db = supabaseAnon();
  const versions: AssetVersion[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await db.from("brand_assets").select("id,domain,kind,path,first_seen_at,last_seen_at,width,height").order("id").range(from, from + 999);
    if (error) throw error;
    versions.push(...((data ?? []) as AssetVersion[]));
    if (!data || data.length < 1000) break;
  }
  const { data: sites, error } = await db.from("library_sites").select("domain,sector,active");
  if (error) throw error;
  const active = new Set((sites ?? []).filter(s => s.active).map(s => s.domain)), editorial = new Set((sites ?? []).filter(s => s.sector === "media").map(s => s.domain));
  const mine = versions.filter(v => active.has(v.domain)), count = new Map<string, number>();
  for (const v of mine) count.set(`${v.domain}|${v.kind}`, (count.get(`${v.domain}|${v.kind}`) ?? 0) + 1);
  const paths = mine.filter(v => (count.get(`${v.domain}|${v.kind}`) ?? 0) > 1).map(v => v.path), grids = new Map<string, Grid>();
  for (let i = 0; i < paths.length; i += 100) {
    const r = await db.from("asset_grids").select("path,grid,spread").in("path", paths.slice(i, i + 100));
    if (r.error) throw r.error;
    for (const x of r.data ?? []) grids.set(x.path, { grid: decodeGrid(x.grid), spread: Number(x.spread) });
  }
  return { versions: mine, comparisons: assetComparisons(mine, grids, editorial) };
});
/** Confirmed icon and card changes whose new picture was first seen within `days`. */
export async function confirmedAssetChanges(days: number, now = Date.now()): Promise<AssetComparison[]> {
  const h = await assetHistory().catch(() => null);
  return (h?.comparisons ?? []).filter(c => c.verdict === "change" && Date.parse(c.between.new_first) > now - days * 864e5);
}
