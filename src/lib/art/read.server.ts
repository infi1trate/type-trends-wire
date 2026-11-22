// W3a · what readers can be shown from the museum works: the stored (not removed) works, read anonymously so the "not removed" policy
// applies exactly as it does for readers, and every active brand's newest measured homepage palette. Cached; no writes, no AI.
// Nothing is shown until readyToShow passes on the stored works (200 works, 8 groups of 15).
import { supabaseAnon } from "../mcp/supabase";
import { memo, memoBy } from "../memo";
import { MUSEUM_NAME, nearestLine, type ArtSource } from "./contract";
import { groups, nearestFor, readyToShow, type Group, type Swatch, type Work } from "./palette";

export type StoredArt = Work & { link: string; thumb: string | null; width: number; height: number; credit_line: string };
const TTL = 10 * 60_000;
const COLS = "source,source_id,title,artist,date_display,year_start,tradition,movement,palette,link,thumb,width,height,credit_line";
const swatches = (v: unknown): Swatch[] => (Array.isArray(v) ? v : []).flatMap(p => { const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>; return typeof r["hex"] === "string" && typeof r["share"] === "number" ? [{ hex: r["hex"], share: r["share"] }] : []; });

/** Stored works (paged), or none. A cheap count first, so the empty case costs one head request. */
export const storedArt = memo(TTL, async (): Promise<{ works: StoredArt[]; groups: Group[]; ready: boolean }> => {
  const db = supabaseAnon();
  const head = await db.from("art_works").select("id", { count: "exact", head: true });
  if (head.error || !head.count) return { works: [], groups: [], ready: false };
  const works: StoredArt[] = [];
  for (let f = 0; ; f += 1000) {
    const r = await db.from("art_works").select(COLS).order("id").range(f, f + 999);
    if (r.error) throw r.error;
    works.push(...((r.data ?? []) as unknown as Record<string, unknown>[]).map(x => ({ ...(x as unknown as StoredArt), palette: swatches(x["palette"]) })));
    if ((r.data ?? []).length < 1000) break;
  }
  const ready = readyToShow(works).ready;
  return { works, groups: ready ? groups(works) : [], ready };
});

/** The palette read for a brand: its newest live desktop home capture's `signals.color.palette` (every stored swatch with its share). */
export const brandPalette = memoBy(TTL, async (domain: string): Promise<Swatch[] | null> => {
  const r = await supabaseAnon().from("library_snapshots").select("palette:signals->color->palette").eq("domain", domain).eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").order("captured_at", { ascending: false }).limit(1);
  if (r.error) throw r.error;
  const p = swatches((r.data?.[0] as { palette?: unknown } | undefined)?.palette);
  return p.length ? p : null;
}, { key: d => d, max: 400 });

/** Every active brand's newest palette (the study), paged over the live desktop home captures. */
export async function allBrandPalettes(sites: readonly { domain: string; sector: string; active: boolean }[]): Promise<{ domain: string; sector: string; palette: Swatch[] }[]> {
  const db = supabaseAnon(), latest = new Map<string, Swatch[]>();
  for (let f = 0; ; f += 1000) {
    const r = await db.from("library_snapshots").select("domain,palette:signals->color->palette").eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").order("captured_at", { ascending: false }).range(f, f + 999);
    if (r.error) throw r.error;
    for (const x of (r.data ?? []) as unknown as { domain: string; palette: unknown }[]) if (!latest.has(x.domain)) { const p = swatches(x.palette); if (p.length) latest.set(x.domain, p); }
    if ((r.data ?? []).length < 1000) break;
  }
  return sites.filter(s => s.active).flatMap(s => { const p = latest.get(s.domain); return p ? [{ domain: s.domain, sector: s.sector, palette: p }] : []; });
}

/** The brand page's one line and thumbnail: only when the stored works clear the line and the nearest work is near. */
export type ArtNear = { line: string; museum: string; href: string; thumb: string | null; width: number; height: number; distance: number; work: string; group: string | null; groupDistance: number | null };
/** The thumbnail is drawn at most this wide on the brand page. */
export const THUMB_MAX_W = 120;
export function nearView(w: StoredArt, distance: number, group: { g: Group; distance: number } | null): ArtNear {
  const width = Math.min(THUMB_MAX_W, w.width), height = Math.max(1, Math.round((w.height * width) / w.width));
  return { line: nearestLine({ artist: w.artist, title: w.title, date_display: w.date_display, source: w.source as ArtSource }), museum: MUSEUM_NAME[w.source as ArtSource], href: w.link,
    thumb: w.thumb ? `/crops/${w.thumb}` : null, width, height, distance: Math.round(distance * 1e4) / 1e4, work: `${w.source}:${w.source_id}`, group: group?.g.name ?? null, groupDistance: group ? Math.round(group.distance * 1e4) / 1e4 : null };
}
export async function brandArt(domain: string): Promise<ArtNear | null> {
  const art = await storedArt();
  if (!art.ready) return null;
  const p = await brandPalette(domain);
  if (!p) return null;
  const m = nearestFor(domain, p, art.works, art.groups);
  if (m.neutral || !m.work?.near) return null;
  return nearView(m.work.w as StoredArt, m.work.distance, m.group);
}
