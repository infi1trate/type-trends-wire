// W3a · what readers can be shown from the museum works: the stored (not removed) works, read anonymously so the "not removed" policy
// applies exactly as it does for readers, and every active brand's newest measured homepage palette. Cached; no writes, no AI.
// Nothing is shown until readyToShow passes on the stored works (200 works, 8 groups of 15).
import { supabaseAnon } from "../mcp/supabase";
import { memo, memoBy } from "../memo";
import { MUSEUM_NAME, nearestLine, type ArtSource } from "./contract";
import { groups, nearestFor, readyToShow, type Group, type Hero, type Swatch, type Work } from "./palette";

export type StoredArt = Work & { link: string; thumb: string | null; width: number; height: number; credit_line: string; /** W3c · painting, print, drawing… (the method note counts them). */ kind: string };
const TTL = 10 * 60_000;
const COLS = "source,source_id,title,artist,date_display,year_start,tradition,movement,palette,link,thumb,width,height,credit_line,kind";
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

/** W3b · the capture's hero as measured (what it is, how much of the first screen media covers). */
const HERO_COLS = "hero:signals->layout->>hero_media,coverage:signals->composition->>media_coverage";
const heroOf = (x: { hero?: unknown; coverage?: unknown }): Hero => ({ media: typeof x.hero === "string" ? x.hero : null, coverage: x.coverage == null || x.coverage === "" ? null : Number(x.coverage) });
/** The palette read for a brand: its newest live desktop home capture's `signals.color.palette` (every stored swatch with its share) and hero. */
export const brandPalette = memoBy(TTL, async (domain: string): Promise<{ palette: Swatch[]; hero: Hero } | null> => {
  const r = await supabaseAnon().from("library_snapshots").select(`palette:signals->color->palette,${HERO_COLS}`).eq("domain", domain).eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").order("captured_at", { ascending: false }).limit(1);
  if (r.error) throw r.error;
  const row = (r.data?.[0] ?? {}) as { palette?: unknown; hero?: unknown; coverage?: unknown }, p = swatches(row.palette);
  return p.length ? { palette: p, hero: heroOf(row) } : null;
}, { key: d => d, max: 400 });

/** Every active brand's newest palette (the study), paged over the live desktop home captures. */
export async function allBrandPalettes(sites: readonly { domain: string; sector: string; active: boolean }[]): Promise<{ domain: string; sector: string; palette: Swatch[]; hero: Hero; accent: string | null }[]> {
  const db = supabaseAnon(), latest = new Map<string, { palette: Swatch[]; hero: Hero; accent: string | null }>();
  for (let f = 0; ; f += 1000) {
    const r = await db.from("library_snapshots").select(`domain,palette:signals->color->palette,accent:signals->color->>accent,${HERO_COLS}`).eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").order("captured_at", { ascending: false }).range(f, f + 999);
    if (r.error) throw r.error;
    // W3c · the newest capture's accent (the Data view's ACCENT) rides along: a capture with an accent and no palette still counts.
    for (const x of (r.data ?? []) as unknown as { domain: string; palette: unknown; accent?: unknown; hero?: unknown; coverage?: unknown }[]) if (!latest.has(x.domain)) { const p = swatches(x.palette), accent = typeof x.accent === "string" && x.accent ? x.accent : null; if (p.length || accent) latest.set(x.domain, { palette: p, hero: heroOf(x), accent }); }
    if ((r.data ?? []).length < 1000) break;
  }
  return sites.filter(s => s.active).flatMap(s => { const p = latest.get(s.domain); return p ? [{ domain: s.domain, sector: s.sector, palette: p.palette, hero: p.hero, accent: p.accent }] : []; });
}

/** The brand page's one line and thumbnail: only when the stored works clear the line and the nearest work is near. */
export type ArtNear = { line: string; /** W3b · the Data view's one line: the title (cut to TITLE_MAX; the only link), the museum's short name, then artist and date. */ title: string; short: string; credit: string; museum: string; href: string; thumb: string | null; width: number; height: number; distance: number; work: string; group: string | null; groupDistance: number | null };
/** W3b · the thumbnail is drawn inside this square at most (the brand line is one line of text, not a picture block). */
export const THUMB_MAX = 64;
/** W3b · a title longer than this is cut with an ellipsis on the line (the full credit is the link's tooltip), so the line stays within two lines at 390 px. */
export const TITLE_MAX = 36;
const MUSEUM_SHORT: Record<ArtSource, string> = { met: "The Met", aic: "Art Institute of Chicago" };
export function nearView(w: StoredArt, distance: number, group: { g: Group; distance: number } | null): ArtNear {
  const k = Math.min(1, THUMB_MAX / w.width, THUMB_MAX / w.height), width = Math.max(1, Math.round(w.width * k)), height = Math.max(1, Math.round(w.height * k));
  return { title: w.title.length > TITLE_MAX ? `${w.title.slice(0, TITLE_MAX - 1).trimEnd()}…` : w.title, short: MUSEUM_SHORT[w.source as ArtSource], credit: [w.artist, w.date_display].filter(x => x && String(x).trim()).join(", "), line: nearestLine({ artist: w.artist, title: w.title, date_display: w.date_display, source: w.source as ArtSource }), museum: MUSEUM_NAME[w.source as ArtSource], href: w.link,
    thumb: w.thumb ? `/crops/${w.thumb}` : null, width, height, distance: Math.round(distance * 1e4) / 1e4, work: `${w.source}:${w.source_id}`, group: group?.g.name ?? null, groupDistance: group ? Math.round(group.distance * 1e4) / 1e4 : null };
}
export async function brandArt(domain: string): Promise<ArtNear | null> {
  const art = await storedArt();
  if (!art.ready) return null;
  const p = await brandPalette(domain);
  if (!p) return null;
  const m = nearestFor(domain, p.palette, art.works, art.groups, { hero: p.hero });
  if (m.neutral || !m.work?.near) return null;
  return nearView(m.work.w as StoredArt, m.work.distance, m.group);
}
