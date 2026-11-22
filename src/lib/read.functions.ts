import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
// Read-mode reads: anonymous SELECT-only, assembled by pure models (stories.ts, brand.ts, patterns.ts). No AI per view.
const sector = z.string().max(40).default("all");
export const getLive = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, page: z.number().int().min(0).max(500).default(0), type: z.enum(["all", "moves", "signals", "openings", "news"]).default("all") })).handler(async ({ data }) => {
  const { loadLive } = await import("./read.server");
  return loadLive(data.sector, data.page, data.type);
});
const storyId = z.string().min(3).max(200);
export const getStory = createServerFn({ method: "GET" }).inputValidator(z.object({ id: storyId })).handler(async ({ data }) => {
  const { loadStory } = await import("./stories/page.server");
  return loadStory(data.id);
});
/** /stories/no/<n> → the published story's id (null when the number is unknown or its story is not published). */
export const getStoryByNumber = createServerFn({ method: "GET" }).inputValidator(z.object({ number: z.number().int().min(1).max(1_000_000) })).handler(async ({ data }) => {
  const { storyIdByNumber } = await import("./stories/read.server");
  return storyIdByNumber(data.number);
});
/** `/`: the front page model (stored data only, no AI). */
export const getFront = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, format: z.string().max(20).default("all") })).handler(async ({ data }) => {
  const { loadFront } = await import("./front/front.server");
  return loadFront(data.sector, data.format);
});
export const getFrontTop = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, format: z.string().max(20).default("all") })).handler(async ({ data }) => (await import("./front/front.server")).loadFrontTop(data.sector, data.format));
export const getFrontRest = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, format: z.string().max(20).default("all") })).handler(async ({ data }) => (await import("./front/front.server")).loadFrontRest(data.sector, data.format));
// E3 · the front page's two new deferred modules: Also today's pictures and the tape.
export const getFrontAlso = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, format: z.string().max(20).default("all") })).handler(async ({ data }) => (await import("./front/front.server")).loadFrontAlso(data.sector, data.format));
export const getFrontTape = createServerFn({ method: "GET" }).handler(async () => (await import("./front/tape.server")).loadFrontTape());
/** N3 · THE WIRE block: the news desk's picks from the last 24 hours (anonymous public facade). */
export const getFrontWire = createServerFn({ method: "GET" }).handler(async () => (await import("./newsroom/news.server")).loadFrontWire());
/** N3 · the terminal wire view's picked marks: item id → the pick's line (last eight days). */
export const getWirePicks = createServerFn({ method: "GET" }).handler(async () => (await import("./newsroom/news.server")).wirePickMarks());
export const getStoryHead = createServerFn({ method: "GET" }).inputValidator(z.object({ id: storyId })).handler(async ({ data }) => (await import("./stories/page.server")).loadStoryHead(data.id));
export const getStoryLead = createServerFn({ method: "GET" }).inputValidator(z.object({ id: storyId })).handler(async ({ data }) => (await import("./stories/page.server")).loadStoryLead(data.id));
export const getStoryRelated = createServerFn({ method: "GET" }).inputValidator(z.object({ id: storyId })).handler(async ({ data }) => (await import("./stories/page.server")).loadStoryRelated(data.id));
export const getPatternHead = createServerFn({ method: "GET" }).inputValidator(z.object({ key: z.string().min(3).max(120), sector })).handler(async ({ data }) => (await import("./read.server")).loadPatternHead(data.key, data.sector));
export const getSectorHead = createServerFn({ method: "GET" }).inputValidator(z.object({ sector: z.string().min(2).max(40) })).handler(async ({ data }) => (await import("./editions/editions.server")).loadSectorHead(data.sector));
export const getStoryQueue = createServerFn({ method: "GET" }).inputValidator(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), fresh: z.boolean().default(false) })).handler(async ({ data }) => {
  const { loadQueue } = await import("./stories/page.server");
  // The terminal's Today queue: always the cached index. The desk's fresh queue loads only through /api/public/desk with the editor key.
  return loadQueue(data.day ?? null, false);
});
export const getRunComparison = createServerFn({ method: "GET" }).handler(async () => {
  const { runComparison } = await import("./read.server");
  return runComparison();
});
export const getBrand = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { loadBrand } = await import("./read.server");
  return loadBrand(data.domain.toLowerCase());
});
// The brand page in parts (P1): the card is critical; the rest are deferred sections, each its own read.
const domainInput = z.object({ domain: z.string().min(3).max(253) });
export const getBrandCard = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./brand-read.server")).loadBrandCard(data.domain.toLowerCase()));
export const getBrandMoves = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./brand-read.server")).loadBrandMoves(data.domain.toLowerCase()));
export const getBrandSections = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./brand-read.server")).loadBrandSections(data.domain.toLowerCase()));
export const getBrandSurfaces = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./surfaces.server")).loadBrandSurfaces(data.domain.toLowerCase()));
export const getBrandSector = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./brand-read.server")).loadBrandSector(data.domain.toLowerCase()));
export const getBrandSimilar = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./brand-read.server")).loadBrandSimilar(data.domain.toLowerCase()));
export const getBrandStories = createServerFn({ method: "GET" }).inputValidator(domainInput).handler(async ({ data }) => (await import("./brand-read.server")).loadBrandStories(data.domain.toLowerCase()));
export const getBrands = createServerFn({ method: "GET" }).handler(async () => {
  const { loadBrands } = await import("./read.server");
  return loadBrands();
});
export const getPatterns = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, illustrated: z.boolean().default(false) })).handler(async ({ data }) => {
  const { loadPatterns } = await import("./read.server");
  return loadPatterns(data.sector, data.illustrated);
});
export const getCropCoverage = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCropCoverage } = await import("./read.server");
  return loadCropCoverage();
});
export const getPattern = createServerFn({ method: "GET" }).inputValidator(z.object({ key: z.string().min(3).max(120), sector })).handler(async ({ data }) => {
  const { loadPattern } = await import("./read.server");
  return loadPattern(data.key, data.sector);
});
/** /signals: the ranked index for one view (tab, sort, lens, archive), built on the server so the page ships only its rows. */
export const getSignalsIndex = createServerFn({ method: "GET" }).inputValidator(z.object({ tab: z.string().max(20).default("all"), sort: z.string().max(20).default(""), sector, tier: z.string().max(20).default("") })).handler(async ({ data }) => {
  const [{ loadSignalsIndex }, { parseSignalsSearch }] = await Promise.all([import("./signals-index.server"), import("./signals-index")]);
  return loadSignalsIndex(parseSignalsSearch(data));
});
export const getSignalSeries = createServerFn({ method: "GET" }).inputValidator(z.object({ scope: sector })).handler(async ({ data }) => {
  const { loadSignalSeries } = await import("./read.server");
  return loadSignalSeries(data.scope);
});
export const getModelCard = createServerFn({ method: "GET" }).handler(async () => {
  const [{ supabaseAnon }, { readerRunId }] = await Promise.all([import("./mcp/supabase"), import("./real-runs")]);
  const db = supabaseAnon();
  const { data, error } = await db.from("forecast_runs").select("model_card,computed_at").eq("id", await readerRunId(db)).maybeSingle();
  if (error) throw error;
  return data ? { card: data.model_card as Json, computed_at: data.computed_at as string } : null;
});
export const getFreshness = createServerFn({ method: "GET" }).handler(async () => {
  const { loadFreshness } = await import("./freshness.server");
  return loadFreshness();
});
// Editions: the Morning Line, sector reports, /editions and the private /welcome page. Stored data only; no AI per view.
export const getMorning = createServerFn({ method: "GET" }).inputValidator(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null) })).handler(async ({ data }) => {
  const { loadMorning } = await import("./editions/editions.server");
  return loadMorning(data.day);
});
export const getSectorReport = createServerFn({ method: "GET" }).inputValidator(z.object({ sector: z.string().min(2).max(40) })).handler(async ({ data }) => {
  const [{ loadSectorReport }, { picturesSafe }, { iconsFor }] = await Promise.all([import("./editions/editions.server"), import("./pictures.server"), import("./pictures")]);
  const [r, pics] = await Promise.all([loadSectorReport(data.sector), picturesSafe()]);
  // I1: the leaders' site icons (read beside the report, never stored in it).
  return r ? { ...r, icons: iconsFor(pics, r.leaders.map(l => l.domain)) } : r;
});
export const getSectorIndex = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSectorIndex } = await import("./editions/editions.server");
  return loadSectorIndex(null);
});
export const getEditions = createServerFn({ method: "GET" }).handler(async () => {
  const { loadEditions } = await import("./editions/editions.server");
  return loadEditions(null);
});
// /welcome data loads only from /api/public/desk (action "staff") after the editor key; there is no public function for it.
/** /kit: live examples for the component kit (stored data only, no AI). */
export const getKit = createServerFn({ method: "GET" }).handler(async () => {
  const { loadKit } = await import("./kit.server");
  return loadKit();
});

// Pattern gallery and collections (gallery.ts + collections/registry.ts over stored captures; no AI).
const gallerySearchInput = z.object({ sector: z.string().max(40).optional(), pattern: z.string().max(80).optional(), period: z.string().max(10).optional(), basis: z.string().max(10).optional(), section: z.string().max(10).optional(), page: z.number().int().min(1).max(999).optional() });
export const getGallery = createServerFn({ method: "GET" }).inputValidator(gallerySearchInput).handler(async ({ data }) => {
  const [{ loadGalleryView }, { parseGallerySearch }] = await Promise.all([import("./gallery.server"), import("./gallery")]);
  return loadGalleryView(parseGallerySearch(data));
});
export const getCollections = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCollections } = await import("./gallery.server");
  return loadCollections();
});
export const getCollection = createServerFn({ method: "GET" }).inputValidator(z.object({ slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/), page: z.number().int().min(1).max(999).default(1) })).handler(async ({ data }) => {
  const { loadCollection } = await import("./gallery.server");
  return loadCollection(data.slug, data.page);
});
/** /ambient: everything the studio board plays for one sector lens (memoised; no AI, no writes). */
export const getAmbient = createServerFn({ method: "GET" }).inputValidator(z.object({ sector })).handler(async ({ data }) => {
  const [{ loadAmbient }, { resolveSector }] = await Promise.all([import("./ambient/ambient.server"), import("./sector-lens")]);
  return loadAmbient(resolveSector(data.sector));
});
/** The 404 page: tracked brands and staged signals matching a name, plus the newest published story. */
export const getLookup = createServerFn({ method: "GET" }).inputValidator(z.object({ q: z.string().max(80) })).handler(async ({ data }) => {
  const [{ siteTraitIndex }, { latestSignals }, { label }, { rowKey }, { lookup }] = await Promise.all([import("./read.server"), import("./signals.server"), import("./labels"), import("./signals"), import("./lookup")]);
  const [sites, { snap }] = await Promise.all([siteTraitIndex(), latestSignals("all")]);
  const keys = [...new Set(snap.rows.filter(r => r.scope === "all").map(rowKey))];
  return lookup(data.q, sites.map(s => ({ domain: s.domain, name: s.name })), keys.map(k => { const l = label(k); return { key: k, name: l.name, dimension: l.dimension }; }));
});
export const getNewestStory = createServerFn({ method: "GET" }).handler(async () => {
  const [{ storyIndex }, { streamOf }] = await Promise.all([import("./stories/read.server"), import("./stories/view")]);
  const s = streamOf(await storyIndex())[0];
  return s ? { headline: s.headline, href: `/stories/${encodeURIComponent(s.id)}` } : null;
});
