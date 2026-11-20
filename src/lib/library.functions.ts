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
  // Changes undone within seven days (and the change back) carry a plain "Reversed" label (reversal.ts).
  const { reversalIds } = await import("./reversal");
  const reversed = reversalIds(events.filter(e => e.id != null && e.domain && e.detected_at).map(e => ({ id: e.id as number, domain: e.domain as string, page_type: e.page_type, viewport: e.viewport, detected_at: e.detected_at as string, before: e.before, after: e.after })));
  // I1: each brand's stored site icon for the library list (the pictures index; empty when it can't be read).
  const [{ picturesSafe }, { iconsFor }] = await Promise.all([import("./pictures.server"), import("./pictures")]);
  const icons = iconsFor(await picturesSafe(), rows.map(r => r.domain).filter((d): d is string => !!d));
  // E2a: each change reads as its tape line (brand name, what changed, from and to, date); labels stay separate badges.
  const { tapeLine } = await import("./tape");
  const tape = (e: (typeof events)[number]) => (e.domain && e.type && e.detected_at ? tapeLine({ domain: e.domain, type: e.type, before: e.before, after: e.after, page_type: e.page_type ?? null, summary: e.summary ?? null, detected_at: e.detected_at }) : null);
  return { rows, icons, events: events.map(e => ({ ...e, tape: tape(e), seasonal: seasonal.has(e.id as number), reversed: reversed.has(e.id as number) })), sectors, ai: await aiTrends() };
});
export const getLibrarySite = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { librarySite } = await import("./library-store.server");
  return librarySite(data.domain.toLowerCase());
});