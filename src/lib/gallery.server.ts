// Loads the pattern gallery and collections: anonymous SELECT-only reads of stored captures, cached; the pure models in gallery.ts and
// collections/registry.ts decide everything. Frames are drawn from stored skeletons only for the tiles on the requested page.
import { supabaseAnon } from "./mcp/supabase";
import { galleryModel, tileFrame, type GalleryChange, type GalleryFilter, type GalleryIn, type GalleryPattern, type GalleryTile } from "./gallery";
import { COLLECTIONS, collectionOf, collectionStatus, type Collection, type CollectionStatus } from "./collections/registry";
import { isPatternSignal } from "./patterns";
import { basis, label } from "./labels";
import { toFrame, type CaptureRaw } from "./data-stories/templates/frames";
import type { Frame } from "./data-stories/types";

const TTL = 10 * 60_000;
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
function memo<T>(ms: number, load: () => Promise<T>) {
  let c: { at: number; v: Promise<T> } | null = null;
  return () => { if (!c || Date.now() - c.at > ms) { const v = load(); c = { at: Date.now(), v }; v.catch(() => { c = null; }); } return c.v; };
}
type Stamp = { id: number; domain: string; at: string; source: "live" | "wayback" };
const src = (s: string | null | undefined): "live" | "wayback" => (s === "live" ? "live" : "wayback");

/** Every stored home/desktop capture that has a skeleton to redraw (id, brand, time, source). */
const drawable = memo(TTL, async (): Promise<Stamp[]> => {
  const rows = await pages<{ id: number; domain: string; captured_at: string; source: string; sk: string | null }>((f, t) => supabaseAnon().from("library_snapshots").select("id,domain,captured_at,source,sk:signals->skeleton->0->>kind").eq("page_type", "home").eq("viewport", "desktop").order("id").range(f, t) as never);
  return rows.filter(r => r.sk != null).map(r => ({ id: r.id, domain: r.domain, at: r.captured_at, source: src(r.source) }));
});
/** The two drawable captures either side of a change: the change's own snapshot (or the first capture at/after it) and the one before. */
export function changePairs(events: { domain: string; type: string; source: string; at: string; snapshot_id: number | null }[], stamps: Stamp[]): GalleryChange[] {
  const by = new Map<string, Stamp[]>();
  for (const s of stamps) { const k = `${s.domain}|${s.source}`; by.set(k, [...(by.get(k) ?? []), s]); }
  for (const v of by.values()) v.sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  return events.flatMap(e => {
    const list = by.get(`${e.domain}|${src(e.source)}`) ?? [];
    const after = (e.snapshot_id != null ? list.find(s => s.id === e.snapshot_id) : undefined) ?? list.find(s => s.at >= e.at);
    const before = after ? list.filter(s => s.at < after.at).at(-1) : undefined;
    return after && before ? [{ domain: e.domain, at: e.at, type: e.type, before: before.id, after: after.id }] : [];
  });
}
/** Keys a collection filters by that are not pattern signals (dark mode, say), so the gallery knows their names and basis. */
const extraKeys = (): GalleryPattern[] => [...new Set(COLLECTIONS.map(c => c.filter.pattern).filter((k): k is string => !!k))].map(k => ({ key: k, name: label(k).name, basis: basis(k) }));

export const galleryInput = memo(TTL, async (): Promise<GalleryIn> => {
  const [{ dataInput }, { latestSignals }, { traitsOf }] = await Promise.all([import("./data-stories/data.server"), import("./signals.server"), import("./data-stories/series")]);
  const [i, { signals }, stamps] = await Promise.all([dataInput(), latestSignals("all"), drawable()]);
  const ok = new Set(stamps.map(s => s.id)), active = i.sites.filter(s => s.active);
  return {
    now: Date.now(), sites: active.map(s => ({ domain: s.domain, name: s.name, sector: s.sector })),
    captures: i.history.filter(r => r.snapshot_id != null && ok.has(r.snapshot_id) && r.captured_at).map(r => ({ id: r.snapshot_id!, domain: r.domain, at: r.captured_at!, quarter: r.quarter ?? null, source: src(r.source), traits: [...traitsOf(r)] })),
    changes: changePairs(i.events, stamps), stamps,
    patterns: signals.filter(isPatternSignal).map(s => ({ key: s.key, name: s.name, basis: s.basis })),
    keys: extraKeys(), crops: i.crops,
  };
});

// Frames: a stored capture never changes, so its tile frame is cached by snapshot id.
const frameCache = new Map<number, Frame | null>();
const FRAME_COLS = "id,captured_at,source,page:signals->page,color:signals->color,skeleton:signals->skeleton";
async function framesFor(tiles: { snapshot: number; domain: string }[], crops: GalleryIn["crops"]): Promise<Map<number, Frame | null>> {
  const need = tiles.filter(t => !frameCache.has(t.snapshot)), dom = new Map(tiles.map(t => [t.snapshot, t.domain]));
  for (let k = 0; k < need.length; k += 12) {
    const ids = need.slice(k, k + 12).map(t => t.snapshot);
    const { data, error } = await supabaseAnon().from("library_snapshots").select(FRAME_COLS).in("id", ids);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
      const raw: CaptureRaw = { id: r["id"] as number, captured_at: r["captured_at"] as string, source: String(r["source"]), page: r["page"], color: r["color"], skeleton: r["skeleton"], h1: null, body: null, h1_size: null, whitespace: null, hero: null, radius: null, archive_url: null };
      const fr = tileFrame(toFrame(dom.get(raw.id) ?? "", raw, crops));
      frameCache.set(raw.id, fr.boxes.length ? { ...fr, crop: null } : null);
    }
    for (const id of ids) if (!frameCache.has(id)) frameCache.set(id, null);
  }
  if (frameCache.size > 4000) for (const key of [...frameCache.keys()].slice(0, 1000)) frameCache.delete(key);
  return new Map(tiles.map(t => [t.snapshot, frameCache.get(t.snapshot) ?? null]));
}
const viewCache = new Map<string, { at: number; v: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = viewCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v as Promise<T>;
  const v = load(); viewCache.set(key, { at: Date.now(), v }); v.catch(() => viewCache.delete(key));
  if (viewCache.size > 300) viewCache.delete(viewCache.keys().next().value!);
  return v;
}
/** /patterns: one page of the wall for a filter, with each tile's crop or redrawn frame. */
export function loadGallery(f: GalleryFilter) {
  return cached(`g:${JSON.stringify(f)}`, async () => {
    const i = await galleryInput(), m = galleryModel(i, f);
    const frames = await framesFor(m.tiles.filter(t => !t.crop), i.crops);
    return { ...m, tiles: m.tiles.map((t): GalleryTile => ({ ...t, frame: t.crop ? null : frames.get(t.snapshot) ?? null })) };
  });
}
export type CollectionRow = { slug: string; number: number; title: string; deck: string; pairs: Collection["pairs"] } & CollectionStatus & { count: number; href: string | null };
/** Status at read time: the registry's status, re-checked against today's count. */
export function statusNow(c: Collection, count: number): CollectionStatus {
  if (c.status === "draft") return { status: "draft", reason: c.reason };
  const s = collectionStatus(count);
  return s.status === "live" ? s : { status: "draft", reason: `It no longer clears the minimum on current data: ${s.reason}` };
}
export async function loadCollections(): Promise<CollectionRow[]> {
  const i = await galleryInput();
  return COLLECTIONS.map(c => { const count = galleryModel(i, c.filter).total, s = statusNow(c, count); return { slug: c.slug, number: c.number, title: c.title, deck: c.deck, pairs: c.pairs, ...s, count, href: s.status === "live" ? `/collections/${c.slug}` : null }; });
}
export async function loadCollection(slug: string, page = 1) {
  const c = collectionOf(slug);
  if (!c) return { kind: "missing" as const };
  const g = await loadGallery({ ...c.filter, page });
  const s = statusNow(c, g.total);
  const row = { slug: c.slug, number: c.number, title: c.title, deck: c.deck, pairs: c.pairs };
  return s.status === "live" ? { kind: "live" as const, ...row, gallery: g } : { kind: "draft" as const, ...row, reason: s.reason, count: g.total };
}
