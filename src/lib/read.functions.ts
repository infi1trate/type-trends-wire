import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
// Read-mode reads: anonymous SELECT-only, assembled by pure models (stories.ts, brand.ts, patterns.ts). No AI per view.
const sector = z.string().max(40).default("all");
export const getLive = createServerFn({ method: "GET" }).inputValidator(z.object({ sector, page: z.number().int().min(0).max(500).default(0) })).handler(async ({ data }) => {
  const { loadLive } = await import("./read.server");
  return loadLive(data.sector, data.page);
});
export const getBrand = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { loadBrand } = await import("./read.server");
  return loadBrand(data.domain.toLowerCase());
});
export const getBrands = createServerFn({ method: "GET" }).handler(async () => {
  const { loadBrands } = await import("./read.server");
  return loadBrands();
});
export const getPatterns = createServerFn({ method: "GET" }).inputValidator(z.object({ sector })).handler(async ({ data }) => {
  const { loadPatterns } = await import("./read.server");
  return loadPatterns(data.sector);
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
  const { supabaseAnon } = await import("./mcp/supabase");
  const { data, error } = await supabaseAnon().from("forecast_model_card").select("model_card,computed_at").maybeSingle();
  if (error) throw error;
  return data ? { card: data.model_card as Json, computed_at: data.computed_at as string } : null;
});
