// The brand page in parts (P1 · shell first): the identity card is the critical read (one small row plus one precomputed record);
// moves, sections, the sector field, similar brands and stories are deferred, each from one precomputed record or a few indexed
// queries about this one brand, never the whole library. Anonymous SELECT-only; no AI per view.
import { MUSEUM_SHOWN } from "./site";
import { supabaseAnon } from "./mcp/supabase";
import { brandModel, brandSections, brandTimeline, cardOf, type BrandCard, type BrandPage, type ContrastItem } from "./brand-page";
import type { EventRow } from "./agency/changes";
import type { SimilarResult } from "./similar";
import type { FieldFig } from "./data-stories/types";
import type { Story } from "./stories";
import { brandKey } from "./records/records";
import { storedBy } from "./records/store.server";
import { coverOf, iconsFor, type Cover, type Pic } from "./pictures";
import { picsFor, picturesSafe } from "./pictures.server";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
const EVENT_COLS = "id,domain,type,before,after,detected_at,effective_at,source,page_type,viewport,sector,summary,snapshot_id,prev_snapshot_id";
/** The brand's confirmed live changes, newest first (E2e: only the part that passes the integrity check; fails closed). */
const eventsOf = async (domain: string) => {
  const db = supabaseAnon(), rows = (must(await db.from("library_event_feed").select(EVENT_COLS).eq("domain", domain).eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").order("detected_at", { ascending: false }).limit(80)) ?? []) as EventRow[];
  return (await (await import("./integrity.server")).checkedEvents(db, rows)).tape;
};
const siteOf = async (domain: string) => must(await supabaseAnon().from("library_sites").select("domain,name,sector,active,last_snapshot_at,category,subcategory").eq("domain", domain).maybeSingle());

export type BrandSector = { field: FieldFig | null; contrast: { has: ContrastItem[]; lacks: ContrastItem[] } | null };

/** The identity card computed live from the brand's audit rows (the refresher writes this; a page falls back to it). */
export async function computeBrandCard(domain: string): Promise<BrandCard | null> {
  const site = await siteOf(domain);
  if (!site?.active) return null;
  const [{ auditRows }, read, { latestSignals }] = await Promise.all([import("./agency/audit.server"), import("./read.server"), import("./signals.server")]);
  const [audit, events, index, { tiers }, similar] = await Promise.all([auditRows([domain], null), eventsOf(domain), read.siteTraitIndex(), latestSignals("all"), brandSimilar(domain)]);
  const own = index.find(s => s.domain === domain);
  const card = cardOf(brandModel({ domain, audit, events, peers: own ? [{ domain: own.domain, name: own.name, sector: own.sector, traits: own.traits }] : [], tiers: [...tiers.values()].map(t => [t.key, t.tier]), similar }));
  // N3 · the card's hero media and theme from the newest value two consecutive captures agree on: the change log's own measurement.
  const [{ settledValue }, { settleCard }] = await Promise.all([import("./newsroom/datadesk"), import("./brand-page")]);
  const { data: recent } = await supabaseAnon().from("library_snapshots").select("hero:signals->layout->>hero_media,theme:signals->color->>theme").eq("domain", domain).eq("page_type", "home").eq("viewport", "desktop").eq("source", "live").order("captured_at", { ascending: false }).limit(8);
  const rows = (recent ?? []) as unknown as { hero: string | null; theme: string | null }[];
  return settleCard(card, { hero: settledValue(rows.map(r => r.hero)), theme: settledValue(rows.map(r => r.theme)) });
}
/** Similar brands for one domain, computed from the shared trait index and signal tiers. */
export async function computeBrandSimilar(domain: string): Promise<SimilarResult> {
  const [{ similarBrands }, read, { latestSignals }] = await Promise.all([import("./similar"), import("./read.server"), import("./signals.server")]);
  const [index, { signals }] = await Promise.all([read.siteTraitIndex(), latestSignals("all")]);
  return similarBrands(domain, index, read.similarEligible(signals));
}
/** The sector field and the has/lacks contrast for one domain, from the data-story input. */
export async function computeBrandSector(domain: string): Promise<BrandSector> {
  const [{ dataInput }, { sectorField, signalContrast }, read] = await Promise.all([import("./data-stories/data.server"), import("./data-stories/stories"), import("./read.server")]);
  const [input, index] = await Promise.all([dataInput().catch(() => null), read.siteTraitIndex()]);
  return sectorFor(input, index.find(s => s.domain === domain)?.sector ?? null, domain, sectorField, signalContrast);
}
type SectorFns = { sectorField: typeof import("./data-stories/stories").sectorField; signalContrast: typeof import("./data-stories/stories").signalContrast };
export function sectorFor(input: Awaited<ReturnType<typeof import("./data-stories/data.server").dataInput>> | null, sector: string | null, domain: string, sectorField: SectorFns["sectorField"], signalContrast: SectorFns["signalContrast"], field?: FieldFig | null): BrandSector {
  const f = field !== undefined ? field : input && sector ? sectorField(input, sector) : null;
  const c = input ? signalContrast(input, domain) : null;
  return { field: f, contrast: c ? { has: c.has.map(x => ({ key: x.key, name: x.name, sector: x.sector })), lacks: c.lacks.map(x => ({ key: x.key, name: x.name, sector: x.sector })) } : null };
}

const brandSimilar = storedBy((d: string) => brandKey("brand-similar", d), computeBrandSimilar);
const brandSector = storedBy((d: string) => brandKey("brand-sector", d), computeBrandSector);
const brandCard = storedBy((d: string) => brandKey("brand-card", d), computeBrandCard, 60_000);

/** The card as the page draws it: the stored card plus the brand's own icon and its cover (I1), read fresh beside the record. */
export type BrandCardView = BrandCard & { icon: Pic | null; cover: Cover | null; art?: import("./art/read.server").ArtNear | null; /** W3c · the stored work that holds the brand's accent (Data view only). */ accentArt?: import("./art/accent").AccentNear | null; tiles?: BrandPage["sections"] | null };
/** D1b · the sections strip's latest crops, read beside the card and given up after this long, so the strip is drawn in the first response
 *  (a late strip moved the page by 0.062 at 1440 px) without holding the first bytes back; a miss draws the old placeholder. */
export const CARD_TILES_WAIT_MS = 300;
function tilesWithin(domain: string, ms = CARD_TILES_WAIT_MS): Promise<BrandPage["sections"] | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const read = import("./read.server").then(m => m.cropsFor([domain])).then(rows => brandSections(rows, domain).sections);
  return Promise.race([read, new Promise<null>(r => { t = setTimeout(() => r(null), ms); })]).catch(() => null).finally(() => clearTimeout(t));
}
/** Critical: the card, or null when the domain is not an active library brand (the route answers 404). Existence is read fresh. */
export async function loadBrandCard(domain: string): Promise<BrandCardView | null> {
  // W3a · the nearest museum work is read beside the record (never stored in it); nothing until the works clear the line, and a failed
  // read draws no line. W3c · it is now the work that holds the brand's accent (one colour), not the nearest whole palette, which
  // matched no brand under the W3b rules; `brandArt` stays for the old study's code.
  // C1 · one wave: the stored card is read beside the site row (it was read after it, a second round trip on a cold server); it is
  // only used once the site row says the brand is active.
  const tiles = tilesWithin(domain), cardP = brandCard(domain);
  cardP.catch(() => undefined);
  const [site, pics, art] = await Promise.all([siteOf(domain), picsFor(domain), (MUSEUM_SHOWN ? import("./art/read.server").then(m => m.brandAccentArt(domain)).catch(() => null) : Promise.resolve(null))]);
  if (!site?.active) return null;
  const [card, strip] = await Promise.all([cardP, tiles]);
  return card ? { ...card, icon: pics.icon, cover: coverOf(domain, pics), tiles: strip, ...(art ? { accentArt: art } : {}) } : null;
}
/** Deferred: every move with its before/after. */
export async function loadBrandMoves(domain: string): Promise<{ timeline: BrandPage["timeline"] }> {
  const db = supabaseAnon();
  const [{ cropsFor }, { capturesOf }, { readerRebrands }, { storiesForDomain }, { storyForSource, storyPath }] = await Promise.all([import("./read.server"), import("./data-stories/data.server"), import("./rebrands.server"), import("./stories/read.server"), import("./stories/view")]);
  const [site, events, rebrands, stories, crops, captures] = await Promise.all([siteOf(domain), eventsOf(domain), readerRebrands().then(r => r.rows).catch(() => []), storiesForDomain(domain).catch(() => []), cropsFor([domain]), capturesOf(domain).catch(() => [])]);
  const [seasonal, carousel] = await Promise.all([import("./promo.server").then(m => m.seasonalIds(db, events)), import("./carousel.server").then(m => m.carouselIds(db, events))]);
  const storyOf: [string, string][] = [...storyForSource(stories)].filter(([src]) => src.startsWith("event:") || src.startsWith(`rebrand:${domain}:`)).map(([src, id]) => [src, storyPath(id)]);
  const own = rebrands.filter(x => x.source === "live" && x.domain === domain).map(x => ({ domain: x.domain, sector: x.sector, name: x.name, confirmed_at: x.confirmed_at, read: x.read, reasons: x.reasons, effective_at: x.effective_at, seasonal: x.seasonal }));
  return { timeline: brandTimeline({ domain, name: site?.name ?? domain, events, rebrands: own, seasonal, carousel, storyOf, crops, captures }) };
}
/** Deferred: the sections strip and each section's history (one indexed crop read). */
export async function loadBrandSections(domain: string) {
  const { cropsFor } = await import("./read.server");
  return brandSections(await cropsFor([domain]), domain);
}
export const loadBrandSector = (domain: string): Promise<BrandSector> => brandSector(domain);
/** Similar brands, with each one's icon (I1) from the pictures index (read beside the record, never stored in it). */
export async function loadBrandSimilar(domain: string): Promise<SimilarResult & { icons: Record<string, Pic> }> {
  const [similar, index] = await Promise.all([brandSimilar(domain), picturesSafe()]);
  return { ...similar, icons: iconsFor(index, similar.items.map(x => x.domain)) };
}
/** Deferred: stories about this brand (indexed on the story's domains). */
export async function loadBrandStories(domain: string): Promise<Story[]> {
  const [{ storiesForDomain }, { storiesAbout }] = await Promise.all([import("./stories/read.server"), import("./stories/view")]);
  return storiesAbout(await storiesForDomain(domain), { domain, limit: 8 });
}
