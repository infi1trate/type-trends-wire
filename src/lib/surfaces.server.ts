// W1b · the brand page's Surfaces block and Data table, the census input for "product page vs homepage", and the icon and card history.
// Anonymous SELECTs only: the latest live desktop capture of each surface page (measured fields by JSON path), the pictures index
// (icon, card, hero first screen, same addresses the page already shows) and the stored icon and card versions with their verdicts.
import { supabaseAnon } from "./mcp/supabase";
import { SURFACE_FIELDS, SURFACE_FIELD_NAME, SURFACE_NAME, SURFACE_PAGES, fieldText, latestSurfaces, productLine, productPair, surfaceMatch, type SurfaceCapture, type SurfacePage, type BrandSurfaces, type SurfaceTile, type SurfaceRow } from "./surfaces";
import { longDay } from "./pictures";

const COLS = "id,domain,page_type,captured_at,run_id,url,h1:signals->type->rendered->h1,body:signals->type->rendered->body,theme:signals->color->>theme,accent:signals->color->>accent";
type Row = Omit<SurfaceCapture, "h1" | "body"> & { h1: unknown; body: unknown };
const font = (v: unknown) => (v && typeof v === "object" && typeof (v as Record<string, unknown>)["family"] === "string" ? v as SurfaceCapture["h1"] : null);
const toCapture = (r: Row): SurfaceCapture => ({ ...r, run_id: r.run_id != null ? String(r.run_id) : null, h1: font(r.h1), body: font(r.body) });

/** Live desktop captures of the surface pages in the last `days` (one brand, or every brand when `domain` is null). */
export async function surfaceCaptures(o: { domain?: string | null; pages?: readonly string[]; days?: number; now?: number } = {}): Promise<SurfaceCapture[]> {
  const db = supabaseAnon(), since = new Date((o.now ?? Date.now()) - (o.days ?? 8) * 864e5).toISOString(), out: SurfaceCapture[] = [];
  for (let from = 0; from < 40000; from += 1000) {
    let q = db.from("library_snapshots").select(COLS).eq("source", "live").eq("viewport", "desktop").in("page_type", [...(o.pages ?? SURFACE_PAGES)]).gte("captured_at", since);
    if (o.domain) q = q.eq("domain", o.domain);
    const { data, error } = await q.order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as Row[]).map(toCapture));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** A failed read shows no block (the page is as it was before W1b). */
export const loadBrandSurfaces = (domain: string): Promise<BrandSurfaces> => brandSurfaces(domain).catch(() => ({ domain, show: false, tiles: [], productLine: null, rows: [], fieldNames: [], history: [] }));
async function brandSurfaces(domain: string): Promise<BrandSurfaces> {
  const [captures, { picturesSafe }, { picsOf }, { reportHref }, assets] = await Promise.all([
    surfaceCaptures({ domain, days: 30 }), import("./pictures.server"), import("./pictures"), import("./crops"),
    import("./asset-changes.server").then(m => m.assetHistory()).catch(() => null),
  ]);
  const latest = latestSurfaces(captures), home = latest.home ?? null, pics = picsOf(await picturesSafe(), domain), report = reportHref(domain);
  const others = SURFACE_PAGES.filter(p => p !== "home" && latest[p]);
  const live = (c: SurfaceCapture | null | undefined) => c?.url ?? `https://${domain}`;
  const tiles: SurfaceTile[] = [];
  if (home) tiles.push({ key: "home", what: "Homepage · first screen", at: pics.hero?.at ?? home.captured_at, live: live(home), report,
    pic: pics.hero ? { src: pics.hero.src, width: pics.hero.width, height: pics.hero.height, alt: `${domain} homepage first screen, captured ${longDay(pics.hero.at)}`, fit: "cover", ratio: "3 / 2" } : null, lines: [] });
  for (const p of others) {
    const c = latest[p]!;
    // The crawler keeps pictures of homepages only, so other pages show what was measured on them, in the same fixed box.
    tiles.push({ key: p, what: SURFACE_NAME[p], at: c.captured_at, live: live(c), report, pic: null,
      lines: [`Headline ${fieldText(c, "h1")}`, `Body ${fieldText(c, "body")}`, `Accent ${fieldText(c, "accent").toLowerCase()}`, ...(home ? [`Matches the homepage: ${surfaceMatch(home, c)}`] : [])] });
  }
  if (pics.icon) tiles.push({ key: "icon", what: "Site icon", at: pics.icon.at, live: `https://${domain}`, report, pic: { src: pics.icon.src, width: pics.icon.width, height: pics.icon.height, alt: `The site icon ${domain} publishes, captured ${longDay(pics.icon.at)}`, fit: "contain", ratio: "1 / 1" }, lines: [] });
  if (pics.card) tiles.push({ key: "card", what: "Social card", at: pics.card.at, live: `https://${domain}`, report, pic: { src: pics.card.src, width: pics.card.width, height: pics.card.height, alt: `The social share image ${domain} publishes, captured ${longDay(pics.card.at)}`, fit: "contain", ratio: "1.91 / 1" }, lines: [] });
  const rows: SurfaceRow[] = SURFACE_PAGES.filter(p => latest[p]).map(p => { const c = latest[p]!; return { page: SURFACE_NAME[p as SurfacePage], fields: Object.fromEntries(SURFACE_FIELDS.map(k => [SURFACE_FIELD_NAME[k], fieldText(c, k)])), at: c.captured_at, url: c.url, match: p === "home" ? "this is home" : home ? surfaceMatch(home, c) : "not comparable" }; });
  const verdictOf = new Map((assets?.comparisons ?? []).filter(c => c.domain === domain).map(c => [c.to.path, c.verdict]));
  const { cropSrc } = await import("./crops");
  const mine = (assets?.versions ?? []).filter(v => v.domain === domain).sort((a, b) => a.kind.localeCompare(b.kind) || a.first_seen_at.localeCompare(b.first_seen_at));
  const history = mine.map(v => ({ kind: v.kind === "icon" ? "Site icon" : "Social card", version: mine.filter(x => x.kind === v.kind && x.first_seen_at <= v.first_seen_at).length, first: v.first_seen_at, last: v.last_seen_at, src: cropSrc(v.path), width: v.width, height: v.height, verdict: verdictOf.get(v.path) ?? null }));
  return { domain, show: others.length > 0, tiles, productLine: productLine(productPair(captures), longDay), rows, fieldNames: SURFACE_FIELDS.map(k => SURFACE_FIELD_NAME[k]), history };
}
