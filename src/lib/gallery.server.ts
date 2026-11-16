// Loads the pattern gallery and collections: anonymous SELECT-only reads of stored captures, cached (settled values only, memo.ts); the
// pure models in gallery.ts and collections/registry.ts decide everything. Frames are drawn from stored skeletons only for the tiles on
// the requested page. A cold view reads only what it needs: no change stamps unless it is a "changed" view.
import { supabaseAnon } from "./mcp/supabase";
import { galleryModel, tileFrame, type GalleryChange, type GalleryFilter, type GalleryIn, type GalleryPattern, type GalleryTile } from "./gallery";
import { COLLECTIONS, collectionOf, collectionStatus, type Collection, type CollectionStatus } from "./collections/registry";
import { isPatternSignal } from "./patterns";
import { basis, label } from "./labels";
import { toFrame, type CaptureRaw } from "./data-stories/templates/frames";
import type { Frame } from "./data-stories/types";
import type { HistRow } from "./data-stories/series";
import { HIST } from "./data-stories/data.server";
import { MEASURED_EVENT_TYPES } from "./rebrands";
import { memo, memoBy, withRetry } from "./memo";

const TTL = 10 * 60_000;
/** Ids checked per "can it be redrawn" request, stamps per drawable-scan page (wide JSON scans stay under 1000 rows), frames per request. */
export const DRAWABLE_IDS = 500, STAMP_PAGE = 900, FRAME_BATCH = 24;
type Db = ReturnType<typeof supabaseAnon>;
type Stamp = { id: number; domain: string; at: string; source: "live" | "wayback" };
const src = (s: string | null | undefined): "live" | "wayback" => (s === "live" ? "live" : "wayback");
const SKELETON = "signals->skeleton->0";
const EVENT_COLS = "id,domain,type,source,effective_at,detected_at,snapshot_id";

/** Of these snapshot ids, the ones with a stored skeleton to redraw (ids only; one request per DRAWABLE_IDS). */
async function drawableIds(db: Db, ids: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  for (let k = 0; k < ids.length; k += DRAWABLE_IDS) {
    const { data, error } = await db.from("library_snapshots").select("id").in("id", ids.slice(k, k + DRAWABLE_IDS)).not(SKELETON, "is", null);
    if (error) throw error;
    for (const r of data ?? []) out.add(r.id);
  }
  return out;
}
/** Every stored home/desktop capture that can be redrawn (id, brand, time, source): only "changed" views need these. */
async function drawableStamps(db: Db): Promise<Stamp[]> {
  const out: Stamp[] = [];
  for (let from = 0; from < 20000; from += STAMP_PAGE) {
    const { data, error } = await db.from("library_snapshots").select("id,domain,captured_at,source").eq("page_type", "home").eq("viewport", "desktop").not(SKELETON, "is", null).order("id").range(from, from + STAMP_PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []).map(r => ({ id: r.id, domain: r.domain, at: r.captured_at, source: src(r.source) })));
    if (!data || data.length < STAMP_PAGE) break;
  }
  return out;
}
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

type Base = Omit<GalleryIn, "changes" | "stamps">;
/** What every gallery view needs: brands, quarterly samples that can be redrawn (with traits), pattern signals and crops. Reuses the
 *  data-story input when this instance already holds it; otherwise reads only these, a few requests at a time. */
const galleryBase = memo(TTL, async (): Promise<Base> => {
  const [{ peekDataInput }, { latestSignals }, { traitsOf }, { allCrops }] = await Promise.all([import("./data-stories/data.server"), import("./signals.server"), import("./data-stories/series"), import("./read.server")]);
  const db = supabaseAnon(), have = peekDataInput();
  const [{ signals }, sites, history, crops] = have
    ? await Promise.all([latestSignals("all"), have.sites, have.history, have.crops])
    : await Promise.all([
      latestSignals("all"),
      db.from("library_sites").select("domain,name,sector,active").order("domain").limit(1000).then(r => { if (r.error) throw r.error; return r.data ?? []; }),
      import("./history.server").then(m => m.historyRows<HistRow>(db, HIST)),
      allCrops(),
    ]);
  const ids = [...new Set(history.map(r => r.snapshot_id).filter((x): x is number => x != null))];
  const ok = have ? new Set(have.snaps.filter(s => s.skeleton).map(s => s.id)) : await drawableIds(db, ids);
  return {
    now: Date.now(), sites: sites.filter(s => s.active).map(s => ({ domain: s.domain, name: s.name, sector: s.sector })),
    captures: history.filter(r => r.snapshot_id != null && ok.has(r.snapshot_id) && r.captured_at).map(r => ({ id: r.snapshot_id!, domain: r.domain, at: r.captured_at!, quarter: r.quarter ?? null, source: src(r.source), traits: [...traitsOf(r)] })),
    patterns: signals.filter(isPatternSignal).map(s => ({ key: s.key, name: s.name, basis: s.basis })),
    keys: extraKeys(), crops,
  };
});
/** Recorded changes with the drawable captures either side: loaded only for "changed" views and collection counts. */
const galleryChanges = memo(TTL, async (): Promise<Pick<GalleryIn, "changes" | "stamps">> => {
  const { peekDataInput } = await import("./data-stories/data.server");
  const db = supabaseAnon(), have = peekDataInput();
  const events = have ? have.events : (await pagedEvents(db));
  const stamps = await drawableStamps(db);
  return { changes: changePairs(events, stamps), stamps };
});
async function pagedEvents(db: Db) {
  const out: { domain: string; type: string; source: string; at: string; snapshot_id: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("library_events").select(EVENT_COLS).eq("page_type", "home").eq("viewport", "desktop").in("type", [...MEASURED_EVENT_TYPES]).order("id").range(from, from + 999);
    if (error) throw error;
    for (const e of data ?? []) { const at = e.effective_at ?? e.detected_at; if (at) out.push({ domain: e.domain, type: e.type, source: e.source, at, snapshot_id: e.snapshot_id }); }
    if (!data || data.length < 1000) return out;
  }
}
/** The gallery's input for one view: changes and stamps only when the view (or a collection count) needs them. */
export async function galleryInput(withChanges = true): Promise<GalleryIn> {
  const [base, ch] = await Promise.all([galleryBase(), withChanges ? galleryChanges() : Promise.resolve({ changes: [], stamps: [] })]);
  return { ...base, ...ch };
}

// Frames: a stored capture never changes, so its tile frame is cached by snapshot id (values only).
const frameCache = new Map<number, Frame | null>();
const FRAME_COLS = "id,captured_at,source,page:signals->page,color:signals->color,skeleton:signals->skeleton";
async function framesFor(tiles: { snapshot: number; domain: string }[], crops: GalleryIn["crops"]): Promise<Map<number, Frame | null>> {
  const need = [...new Set(tiles.filter(t => !frameCache.has(t.snapshot)).map(t => t.snapshot))], dom = new Map(tiles.map(t => [t.snapshot, t.domain]));
  for (let k = 0; k < need.length; k += FRAME_BATCH) {
    const ids = need.slice(k, k + FRAME_BATCH);
    const rows = await withRetry(async () => { const { data, error } = await supabaseAnon().from("library_snapshots").select(FRAME_COLS).in("id", ids); if (error) throw error; return data ?? []; });
    for (const r of rows as unknown as Record<string, unknown>[]) {
      const raw: CaptureRaw = { id: r["id"] as number, captured_at: r["captured_at"] as string, source: String(r["source"]), page: r["page"], color: r["color"], skeleton: r["skeleton"], h1: null, body: null, h1_size: null, whitespace: null, hero: null, radius: null, archive_url: null };
      const fr = tileFrame(toFrame(dom.get(raw.id) ?? "", raw, crops));
      frameCache.set(raw.id, fr.boxes.length ? { ...fr, crop: null } : null);
    }
    for (const id of ids) if (!frameCache.has(id)) frameCache.set(id, null);
  }
  if (frameCache.size > 4000) for (const key of [...frameCache.keys()].slice(0, 1000)) frameCache.delete(key);
  return new Map(tiles.map(t => [t.snapshot, frameCache.get(t.snapshot) ?? null]));
}
const views = memoBy(TTL, async (f: GalleryFilter) => {
  const i = await galleryInput(!!f.changed), m = galleryModel(i, f);
  const frames = await framesFor(m.tiles.filter(t => !t.crop), i.crops);
  return { ...m, tiles: m.tiles.map((t): GalleryTile => ({ ...t, frame: t.crop ? null : frames.get(t.snapshot) ?? null })) };
}, { max: 300 });
/** /patterns: one page of the wall for a filter, with each tile's crop or redrawn frame. */
export const loadGallery = (f: GalleryFilter) => views(f);
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
