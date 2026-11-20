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
  const asIds = events as { id: number; type: string; before: unknown; after: unknown; snapshot_id: number | null; prev_snapshot_id: number | null }[];
  const [seasonal, carousel] = await Promise.all([seasonalIds(supabaseAnon(), asIds).then(x => new Set(x)), import("./carousel.server").then(m => m.carouselIds(supabaseAnon(), asIds)).then(x => new Set(x))]);
  // Changes undone within seven days (and the change back) carry a plain "Reversed" label (reversal.ts).
  const { reversalIds } = await import("./reversal");
  const reversed = reversalIds(events.filter(e => e.id != null && e.domain && e.detected_at).map(e => ({ id: e.id as number, domain: e.domain as string, page_type: e.page_type, viewport: e.viewport, detected_at: e.detected_at as string, before: e.before, after: e.after })));
  // I1: each brand's stored site icon for the library list (the pictures index; empty when it can't be read).
  const [{ picturesSafe }, { iconsFor }] = await Promise.all([import("./pictures.server"), import("./pictures")]);
  const icons = iconsFor(await picturesSafe(), rows.map(r => r.domain).filter((d): d is string => !!d));
  // E2a: each change reads as its tape line (brand name, what changed, from and to, date); labels stay separate badges.
  // E2b: one line per brand, change and day (the same change on two viewports or pages is one line, ending with the pages).
  const { tapeRows, tapeLine, TERMINAL_TAPE } = await import("./tape");
  const valid = events.filter((e): e is typeof e & { id: number; domain: string; type: string; detected_at: string } => e.id != null && !!e.domain && !!e.type && !!e.detected_at);
  // E2e: the tape is the confirmed part of each change; what failed the integrity check is the Data view's own list (integrity.ts).
  const split = await (await import("./integrity.server")).checkedEvents(supabaseAnon(), valid);
  const unconfirmed = split.unconfirmed.map(e => ({ id: e.id, domain: e.domain, detected_at: e.detected_at, label: e.label, line: tapeLine({ ...e, page_type: e.page_type ?? null, summary: e.summary ?? null }, {}, null, TERMINAL_TAPE) }));
  const rowsOut = tapeRows(split.tape.map(e => ({ ...e, before: e.before, after: e.after, page_type: e.page_type ?? null, summary: e.summary ?? null })), e => ({ seasonal: seasonal.has(e.id), reversed: reversed.has(e.id), carousel: carousel.has(e.id) }), undefined, TERMINAL_TAPE);
  return { rows, icons, events: rowsOut.map(({ also, pages: _p, parts: _parts, ...e }) => ({ ...e, tape: e.tape, seasonal: [e.id, ...also].some(id => seasonal.has(id)), reversed: [e.id, ...also].some(id => reversed.has(id)) })), unconfirmed, sectors, ai: await aiTrends() };
});
export const getLibrarySite = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { librarySite } = await import("./library-store.server");
  return librarySite(data.domain.toLowerCase());
});