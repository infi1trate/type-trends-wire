// The brand page in parts (P1 · shell first): the identity card is the critical read (one small row plus one precomputed record);
// moves, sections, the sector field, similar brands and stories are deferred, each from one precomputed record or a few indexed
// queries about this one brand, never the whole library. Anonymous SELECT-only; no AI per view.
import { supabaseAnon } from "./mcp/supabase";
import { brandModel, brandSections, brandTimeline, cardOf, type BrandCard, type BrandPage, type ContrastItem } from "./brand-page";
import type { EventRow } from "./agency/changes";
import type { SimilarResult } from "./similar";
import type { FieldFig } from "./data-stories/types";
import type { Story } from "./stories";
import { brandKey } from "./records/records";
import { storedBy } from "./records/store.server";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
const EVENT_COLS = "id,domain,type,before,after,detected_at,effective_at,source,page_type,viewport,sector,summary,snapshot_id,prev_snapshot_id";
const eventsOf = async (domain: string) => (must(await supabaseAnon().from("library_event_feed").select(EVENT_COLS).eq("domain", domain).eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").order("detected_at", { ascending: false }).limit(80)) ?? []) as EventRow[];
const siteOf = async (domain: string) => must(await supabaseAnon().from("library_sites").select("domain,name,sector,active,last_snapshot_at").eq("domain", domain).maybeSingle());

export type BrandSector = { field: FieldFig | null; contrast: { has: ContrastItem[]; lacks: ContrastItem[] } | null };

/** The identity card computed live from the brand's audit rows (the refresher writes this; a page falls back to it). */
export async function computeBrandCard(domain: string): Promise<BrandCard | null> {
  const site = await siteOf(domain);
  if (!site?.active) return null;
  const [{ auditRows }, read, { latestSignals }] = await Promise.all([import("./agency/audit.server"), import("./read.server"), import("./signals.server")]);
  const [audit, events, index, { tiers }, similar] = await Promise.all([auditRows([domain], null), eventsOf(domain), read.siteTraitIndex(), latestSignals("all"), brandSimilar(domain)]);
  const own = index.find(s => s.domain === domain);
  return cardOf(brandModel({ domain, audit, events, peers: own ? [{ domain: own.domain, name: own.name, sector: own.sector, traits: own.traits }] : [], tiers: [...tiers.values()].map(t => [t.key, t.tier]), similar }));
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

/** Critical: the card, or null when the domain is not an active library brand (the route answers 404). Existence is read fresh. */
export async function loadBrandCard(domain: string): Promise<BrandCard | null> {
  const site = await siteOf(domain);
  if (!site?.active) return null;
  return brandCard(domain);
}
/** Deferred: every move with its before/after. */
export async function loadBrandMoves(domain: string): Promise<{ timeline: BrandPage["timeline"] }> {
  const db = supabaseAnon();
  const [{ cropsFor }, { capturesOf }, { readerRebrands }, { storiesForDomain }, { storyForSource, storyPath }] = await Promise.all([import("./read.server"), import("./data-stories/data.server"), import("./rebrands.server"), import("./stories/read.server"), import("./stories/view")]);
  const [site, events, rebrands, stories, crops, captures] = await Promise.all([siteOf(domain), eventsOf(domain), readerRebrands().then(r => r.rows).catch(() => []), storiesForDomain(domain).catch(() => []), cropsFor([domain]), capturesOf(domain).catch(() => [])]);
  const seasonal = await import("./promo.server").then(m => m.seasonalIds(db, events));
  const storyOf: [string, string][] = [...storyForSource(stories)].filter(([src]) => src.startsWith("event:") || src.startsWith(`rebrand:${domain}:`)).map(([src, id]) => [src, storyPath(id)]);
  const own = rebrands.filter(x => x.source === "live" && x.domain === domain).map(x => ({ domain: x.domain, sector: x.sector, name: x.name, confirmed_at: x.confirmed_at, read: x.read, reasons: x.reasons, effective_at: x.effective_at, seasonal: x.seasonal }));
  return { timeline: brandTimeline({ domain, name: site?.name ?? domain, events, rebrands: own, seasonal, storyOf, crops, captures }) };
}
/** Deferred: the sections strip and each section's history (one indexed crop read). */
export async function loadBrandSections(domain: string) {
  const { cropsFor } = await import("./read.server");
  return brandSections(await cropsFor([domain]), domain);
}
export const loadBrandSector = (domain: string): Promise<BrandSector> => brandSector(domain);
export const loadBrandSimilar = (domain: string): Promise<SimilarResult> => brandSimilar(domain);
/** Deferred: stories about this brand (indexed on the story's domains). */
export async function loadBrandStories(domain: string): Promise<Story[]> {
  const [{ storiesForDomain }, { storiesAbout }] = await Promise.all([import("./stories/read.server"), import("./stories/view")]);
  return storiesAbout(await storiesForDomain(domain), { domain, limit: 8 });
}
