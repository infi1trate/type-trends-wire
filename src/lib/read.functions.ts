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
export const getStoryQueue = createServerFn({ method: "GET" }).inputValidator(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), fresh: z.boolean().default(false) })).handler(async ({ data }) => {
  const { loadQueue } = await import("./stories/page.server");
  return loadQueue(data.day ?? null, data.fresh);
});
export const getRunComparison = createServerFn({ method: "GET" }).handler(async () => {
  const { runComparison } = await import("./read.server");
  return runComparison();
});
export const getBrand = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { loadBrand } = await import("./read.server");
  return loadBrand(data.domain.toLowerCase());
});
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
  const { loadSectorReport } = await import("./editions/editions.server");
  return loadSectorReport(data.sector);
});
export const getSectorIndex = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSectorIndex } = await import("./editions/editions.server");
  return loadSectorIndex(null);
});
export const getEditions = createServerFn({ method: "GET" }).handler(async () => {
  const { loadEditions } = await import("./editions/editions.server");
  return loadEditions(null);
});
export const getWelcome = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWelcome } = await import("./editions/welcome.server");
  return loadWelcome();
});
