// The Terminal's brand library read (F3 Brands, and the ticker's change line). Terminal fix (23 Nov): the independent reads now start
// together (the AI trends and the pictures index used to wait for everything before them, ~3.8 s in a row from a cold start, past the
// reader time limit), and a read that runs late is answered with the last good copy this instance built, so the Terminal never waits
// on it without limit. Anonymous SELECT-only reads; nothing is written.
import { LAST_GOOD_MS, within } from "./deadline";
import { stored } from "./records/store.server";

async function computeLibrary() {
  const [{ libraryRows, libraryEvents, librarySectors }, { aiTrends }, { supabaseAnon }, { picturesSafe }, { iconsFor }] = await Promise.all([
    import("./library-store.server"), import("./ai-public-store.server"), import("./mcp/supabase"), import("./pictures.server"), import("./pictures")]);
  // Started at once; each is awaited only where it is needed.
  const ai = aiTrends(), pics = picturesSafe();
  ai.catch(() => undefined); pics.catch(() => undefined);
  const [rows, events, sectors] = await Promise.all([libraryRows(), libraryEvents({ since_days: 7, limit: 100 }), librarySectors()]);
  const asIds = events as { id: number; type: string; before: unknown; after: unknown; snapshot_id: number | null; prev_snapshot_id: number | null }[];
  const valid = events.filter((e): e is typeof e & { id: number; domain: string; type: string; detected_at: string } => e.id != null && !!e.domain && !!e.type && !!e.detected_at);
  const [{ seasonalIds }, carouselMod, { reversalIds }, tapeMod, integrity] = await Promise.all([import("./promo.server"), import("./carousel.server"), import("./reversal"), import("./tape"), import("./integrity.server")]);
  const { tapeRows, tapeLine, TERMINAL_TAPE } = tapeMod;
  // Changes made on a sale or seasonal capture keep their row on the tape with a plain "Seasonal" label (promo.ts); carousel slides
  // likewise; changes undone within seven days (and the change back) carry a plain "Reversed" label (reversal.ts).
  const [seasonal, carousel, split] = await Promise.all([
    seasonalIds(supabaseAnon(), asIds).then(x => new Set(x)),
    carouselMod.carouselIds(supabaseAnon(), asIds).then(x => new Set(x)),
    // E2e: the tape is the confirmed part of each change; what failed the integrity check is the Data view's own list (integrity.ts).
    integrity.checkedEvents(supabaseAnon(), valid),
  ]);
  const reversed = reversalIds(events.filter(e => e.id != null && e.domain && e.detected_at).map(e => ({ id: e.id as number, domain: e.domain as string, page_type: e.page_type, viewport: e.viewport, detected_at: e.detected_at as string, before: e.before, after: e.after })));
  // I1: each brand's stored site icon for the library list (the pictures index; empty when it can't be read).
  const icons = iconsFor(await pics, rows.map(r => r.domain).filter((d): d is string => !!d));
  // E2a: each change reads as its tape line (brand name, what changed, from and to, date); labels stay separate badges.
  // E2b: one line per brand, change and day (the same change on two viewports or pages is one line, ending with the pages).
  const unconfirmed = split.unconfirmed.map(e => ({ id: e.id, domain: e.domain, detected_at: e.detected_at, label: e.label, line: tapeLine({ ...e, page_type: e.page_type ?? null, summary: e.summary ?? null }, {}, null, TERMINAL_TAPE) }));
  const rowsOut = tapeRows(split.tape.map(e => ({ ...e, before: e.before, after: e.after, page_type: e.page_type ?? null, summary: e.summary ?? null })), e => ({ seasonal: seasonal.has(e.id), reversed: reversed.has(e.id), carousel: carousel.has(e.id) }), undefined, TERMINAL_TAPE);
  return { rows, icons, events: rowsOut.map(({ also, pages: _p, parts: _parts, ...e }) => ({ ...e, tape: e.tape, seasonal: [e.id, ...also].some(id => seasonal.has(id)), reversed: [e.id, ...also].some(id => reversed.has(id)) })), unconfirmed, sectors, ai: await ai };
}
export type LibraryRead = Awaited<ReturnType<typeof computeLibrary>>;
export { computeLibrary };
/** D1c · served from its stored copy (read_records "library", rewritten by the sweep only when it changed), like the Read pages: the
 *  reader gets the stored copy first and a rebuild happens behind it; with no usable copy it is built live, as before. */
const record = stored("library", computeLibrary, { ttl: 60_000 });
/** A read still running after this is answered with the last good copy, when this instance has one. */
export const LIBRARY_LAST_GOOD_MS = LAST_GOOD_MS;
let last: LibraryRead | null = null;
export async function loadLibrary(): Promise<LibraryRead> {
  const p = record().then(v => { last = v; return v; });
  const had = last;
  if (!had) return p;
  return within(p, LIBRARY_LAST_GOOD_MS, "library", () => had).catch(() => had);
}
