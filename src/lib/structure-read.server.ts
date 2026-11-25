// J1 + M1 · page reads of the stored structure rows (anonymous SELECT only; nothing is derived per view). Library-wide counts are
// held in memory for ten minutes so a page view costs at most one small read.
import { pagedRows } from "./paged";
import { supabaseAnon } from "./mcp/supabase";
import { covered, STRUCTURE_SIGNALS, STRUCTURE_BY_KEY, isStructureKey, shareOf, type SeriesRow, type StructureRecord, type Viewport } from "./structure";

export type BrandStructure = { domain: string; quarter: string | null; desktop: { record: StructureRecord; captured_at: string; source: string } | null; phone: { record: StructureRecord; captured_at: string; source: string } | null };
type RecRow = { viewport: string; quarter: string; captured_at: string; source: string; record: unknown };

export async function loadBrandStructure(domain: string): Promise<BrandStructure> {
  const r = await supabaseAnon().from("library_structure_records").select("viewport,quarter,captured_at,source,record").eq("domain", domain).order("quarter", { ascending: false }).limit(12);
  if (r.error) throw new Error("structure read failed");
  const rows = (r.data ?? []) as RecRow[];
  const pick = (vp: string) => { const x = rows.find(y => y.viewport === vp && (y.record as StructureRecord).structure_read) ?? null; return x ? { record: x.record as StructureRecord, captured_at: x.captured_at, source: x.source } : null; };
  const desktop = pick("desktop"), phone = pick("mobile");
  return { domain, quarter: rows.find(y => (y.record as StructureRecord).structure_read)?.quarter ?? null, desktop, phone };
}

const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; v: Promise<SeriesRow[]> }>();
/** Every stored count for one scope (all, a sector key, or cat:<sector>/<category>). */
export function scopeSeries(scope: string): Promise<SeriesRow[]> {
  const c = cache.get(scope);
  if (c && Date.now() - c.at < TTL) return c.v;
  const v = (async () => {
    const out: SeriesRow[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const r = await supabaseAnon().from("library_structure_series").select("signal,viewport,scope,quarter,n_read,n_yes").eq("scope", scope).order("signal").order("viewport").order("quarter").range(from, from + 999);
      if (r.error) throw new Error("structure series read failed");
      out.push(...(r.data as SeriesRow[]));
      if (r.data.length < 1000) break;
    }
    return out;
  })();
  v.catch(() => cache.delete(scope));
  cache.set(scope, { at: Date.now(), v });
  return v;
}

export type StructureIndexRow = { key: string; name: string; meaning: string; group: string; source: string; desktop: number | null; phone: number | null; nDesktop: number; nPhone: number; change: number | null; points: number[]; since: string | null };
const latestOf = (rows: SeriesRow[]) => rows.map(r => r.quarter).sort().at(-1) ?? null;
/** The Structure dimension on /signals: one row per signal, shares only past the floor. */
export async function loadStructureIndex(scope: string): Promise<{ scope: string; quarter: string | null; rows: StructureIndexRow[] }> {
  const s = await scopeSeries(scope), q = latestOf(s);
  const at = new Map(s.map(r => [`${r.signal}|${r.viewport}|${r.quarter}`, r]));
  const { quarterBack, nearestRead } = await import("./structure");
  const rows = STRUCTURE_SIGNALS.map(sig => {
    const vp: Viewport = sig.viewports.includes("desktop") ? "desktop" : "mobile";
    const d = q ? at.get(`${sig.key}|desktop|${q}`) : undefined, p = q ? at.get(`${sig.key}|mobile|${q}`) : undefined;
    const trail = covered(s.filter(r => r.signal === sig.key && r.viewport === vp)).sort((a, b) => a.quarter.localeCompare(b.quarter));
    const now = q ? shareOf(at.get(`${sig.key}|${vp}|${q}`)) : null, back = q ? shareOf(nearestRead(s, sig.key, vp, quarterBack(q, 4))) : null;
    return { key: sig.key, name: sig.name, meaning: sig.meaning, group: sig.group, source: sig.source, desktop: shareOf(d), phone: shareOf(p), nDesktop: d?.n_read ?? 0, nPhone: p?.n_read ?? 0, change: now != null && back != null ? now - back : null, points: trail.map(r => r.n_yes / r.n_read), since: trail[0]?.quarter ?? null };
  });
  return { scope, quarter: q, rows };
}

export type StructureSignalPage = { key: string; name: string; meaning: string; group: string; source: string; viewports: string[]; quarter: string | null;
  trail: { quarter: string; desktop: number | null; phone: number | null; n: number }[]; desktop: { n_read: number; n_yes: number } | null; phone: { n_read: number; n_yes: number } | null;
  sectors: { sector: string; share: number | null; n: number }[]; brands: { domain: string; name: string; viewport: string; words: string[] | null }[] };
/** A structure signal's page: trail, desktop against phone, sectors past the floor, and the brands that have it now, by name. */
export async function loadStructureSignal(key: string): Promise<StructureSignalPage | null> {
  if (!isStructureKey(key)) return null;
  const sig = STRUCTURE_BY_KEY.get(key)!, db = supabaseAnon();
  const all = await scopeSeries("all"), q = latestOf(all);
  const mine = all.filter(r => r.signal === key);
  const ok = new Set(covered(mine).map(r => `${r.viewport}|${r.quarter}`)), latestQ = q;
  const qs = [...new Set(mine.map(r => r.quarter))].sort().filter(qq => qq === latestQ || ok.has(`desktop|${qq}`) || ok.has(`mobile|${qq}`));
  const at = (vp: string, qq: string) => mine.find(r => r.viewport === vp && r.quarter === qq) ?? null;
  const trail = qs.map(qq => ({ quarter: qq, desktop: shareOf(at("desktop", qq)), phone: shareOf(at("mobile", qq)), n: Math.max(at("desktop", qq)?.n_read ?? 0, at("mobile", qq)?.n_read ?? 0) }));
  const sec = q ? await db.from("library_structure_series").select("scope,viewport,n_read,n_yes").eq("signal", key).eq("quarter", q).not("scope", "like", "cat:%").neq("scope", "all") : { data: [], error: null };
  const vp = sig.viewports.includes("desktop") ? "desktop" : "mobile";
  const sectors = ((sec.data ?? []) as { scope: string; viewport: string; n_read: number; n_yes: number }[]).filter(r => r.viewport === vp).map(r => ({ sector: r.scope, share: shareOf(r), n: r.n_read })).sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  let brands: StructureSignalPage["brands"] = [];
  if (q) {
    const r = await pagedRows((f, t) => db.from("library_structure_records").select("domain,viewport,labels:record->nav_labels").eq("quarter", q).eq(`flags->>${key}`, "true").order("domain").order("viewport").range(f, t));
    if (!r.error && r.data.length) {
      const names = await db.from("library_sites").select("domain,name").in("domain", [...new Set(r.data.map(x => x.domain))]);
      const nm = new Map((names.data ?? []).map(x => [x.domain, x.name ?? x.domain]));
      const seen = new Set<string>();
      brands = (r.data as { domain: string; viewport: string; labels: unknown }[]).filter(x => x.viewport === vp || !seen.has(x.domain)).filter(x => { if (seen.has(x.domain)) return false; seen.add(x.domain); return true; })
        .map(x => ({ domain: x.domain, name: nm.get(x.domain) ?? x.domain, viewport: x.viewport, words: sig.group === "nav" && Array.isArray(x.labels) ? (x.labels as string[]).slice(0, 12) : null })).sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  return { key, name: sig.name, meaning: sig.meaning, group: sig.group, source: sig.source, viewports: [...sig.viewports], quarter: q, trail, desktop: q ? at("desktop", q) : null, phone: q ? at("mobile", q) : null, sectors, brands };
}

/** /patterns/navigation: the 22 words and the sign-in split, desktop, library-wide, every quarter. */
export async function loadNavPatterns(): Promise<{ quarter: string | null; words: SeriesRow[]; signin: SeriesRow[] }> {
  const all = await scopeSeries("all");
  return { quarter: latestOf(all.filter(r => r.signal.startsWith("navword:"))), words: all.filter(r => r.viewport === "desktop" && r.signal.startsWith("navword:")), signin: all.filter(r => r.viewport === "desktop" && r.signal.startsWith("signin:")) };
}

/** Sector and category pages: structure signals past the floor in that scope, latest quarter. */
export async function loadScopeStructure(scope: string): Promise<{ key: string; name: string; desktop: number | null; phone: number | null; n: number }[]> {
  const s = await scopeSeries(scope), q = latestOf(s);
  if (!q) return [];
  return STRUCTURE_SIGNALS.flatMap(sig => {
    const d = s.find(r => r.signal === sig.key && r.viewport === "desktop" && r.quarter === q), p = s.find(r => r.signal === sig.key && r.viewport === "mobile" && r.quarter === q);
    const a = shareOf(d), b = shareOf(p);
    return a == null && b == null ? [] : [{ key: sig.key, name: sig.name, desktop: a, phone: b, n: Math.max(d?.n_read ?? 0, p?.n_read ?? 0) }];
  });
}

/** Terminal brands list, optional columns: primary ask, nav items, sections (desktop) and phone nav, newest quarter per brand. */
export async function loadStructureColumns(): Promise<Record<string, { ask: string | null; nav: number | null; sections: number | null; phone: string | null }>> {
  const db = supabaseAnon(), out: Record<string, { ask: string | null; nav: number | null; sections: number | null; phone: string | null; q?: string }> = {};
  const since = (await import("./structure")).quarterBack((await import("./structure")).quarterOf(new Date().toISOString()), 1);
  for (let from = 0; from < 5000; from += 1000) {
    const r = await db.from("library_structure_records").select("domain,viewport,quarter,ask:record->>primary_ask,nav:record->>nav_items,roles:record->roles,phone:record->mobile->>nav").eq("structure_read", true).gte("quarter", since).order("domain").range(from, from + 999);
    if (r.error) throw new Error("structure columns read failed");
    for (const x of r.data as { domain: string; viewport: string; quarter: string; ask: string | null; nav: string | null; roles: unknown; phone: string | null }[]) {
      const o = out[x.domain] ??= { ask: null, nav: null, sections: null, phone: null };
      if (x.viewport === "desktop" && (!o.q || x.quarter > o.q)) Object.assign(o, { ask: x.ask, nav: x.nav != null ? Number(x.nav) : null, sections: Array.isArray(x.roles) ? x.roles.length : null, q: x.quarter });
      if (x.viewport === "mobile" && x.phone) o.phone = x.phone;
    }
    if (r.data.length < 1000) break;
  }
  for (const v of Object.values(out)) delete v.q;
  return out;
}

/** Counts for the data desk and health: brands read (newest quarter), brands read in the last 14 days, signals past the floor, and
 *  the three largest four-quarter changes. Anonymous reads of stored rows only. */
export async function structureFacts(now = Date.now()): Promise<import("./structure").StructureFacts> {
  const st = await import("./structure"), db = supabaseAnon();
  const since = new Date(now - st.STRUCTURE_FRESH_DAYS * 864e5).toISOString();
  const r = await pagedRows((f, t) => db.from("library_structure_records").select("domain,viewport,captured_at").eq("structure_read", true).gte("quarter", st.quarterBack(st.quarterOf(new Date(now).toISOString()), 1)).order("domain").order("viewport").order("captured_at").range(f, t));
  if (r.error) throw new Error("structure facts read failed");
  const brands = (vp: string, fresh: boolean) => new Set(r.data.filter(x => x.viewport === vp && (!fresh || x.captured_at >= since)).map(x => x.domain)).size;
  const all = await scopeSeries("all"), q = all.map(x => x.quarter).sort().at(-1) ?? null;
  const passing = q ? st.STRUCTURE_SIGNALS.filter(sg => all.some(x => x.signal === sg.key && x.quarter === q && x.n_read >= st.STRUCTURE_FLOOR)).length : 0;
  return { desktop: brands("desktop", false), phone: brands("mobile", false), fresh_desktop: brands("desktop", true), fresh_phone: brands("mobile", true), passing, total: st.STRUCTURE_SIGNALS.length, changes: q ? st.biggestChanges(all, q) : [] };
}
