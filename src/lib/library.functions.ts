import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { historyInput } from "./library-history";
export const getLibraryHistory = createServerFn({method:"GET"}).inputValidator(historyInput).handler(async()=>{
 const {historyDashboard}=await import("./library-history.server");return historyDashboard();
});
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const { libraryRows, libraryEvents, librarySectors } = await import("./library-store.server");
  const { aiTrends } = await import("./ai-public-store.server");
  const [rows, events, sectors] = await Promise.all([libraryRows(), libraryEvents({ since_days: 7, limit: 100 }), librarySectors()]);
  // Changes made on a sale or seasonal capture keep their row on the tape with a plain "Seasonal" label (promo.ts).
  const [{ seasonalIds }, { supabaseAnon }] = await Promise.all([import("./promo.server"), import("./mcp/supabase")]);
  const seasonal = new Set(await seasonalIds(supabaseAnon(), events as { id: number; snapshot_id: number | null; prev_snapshot_id: number | null }[]));
  return { rows, events: events.map(e => ({ ...e, seasonal: seasonal.has(e.id as number) })), sectors, ai: await aiTrends() };
});
export const getLibrarySite = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { librarySite } = await import("./library-store.server");
  return librarySite(data.domain.toLowerCase());
});