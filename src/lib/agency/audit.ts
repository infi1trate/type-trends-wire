// Competitive audit: one pure model over stored rows for 2–6 domains (no AI per view). Names from labels.ts; every section only with real data.
import { SECTORS, fingerprint, obj, radiusBucket, str, num } from "../library";
import { basis, explainerPath, label, stageName, scopeText, type Basis, type Dimension, type StageName } from "../labels";
import { siteTraits, type SiteRow } from "../forecast-signals";
import { pickThumb, type Thumb, type ThumbRow } from "../thumbs";
import { SITE_URL } from "../site";
import { eventSentence, hexName, rebrandSentence, type EventRow, type RebrandRow } from "./changes";
import { normDomain, splitTargets } from "./watch";

export const AUDIT_MIN = 2, AUDIT_MAX = 6, MOVES_DAYS = 90, WHITE_SPACE_MAX = 10;
export type AuditParse = { ok: true; domains: string[] } | { ok: false; error: string; domains: string[] };
/** "a.com,b.com" → sorted unique domains; 2–6 required. Sorting makes the list the cache key. */
export function parseAuditSites(raw: string | string[] | null | undefined): AuditParse {
  const parts = (Array.isArray(raw) ? raw : splitTargets(raw ?? "")).slice(0, 40);
  const bad = parts.filter(p => !normDomain(p));
  const domains = [...new Set(parts.map(normDomain).filter((d): d is string => !!d))].sort();
  if (bad.length) return { ok: false, error: `Not a domain: ${bad.slice(0, 3).join(", ")}`, domains };
  if (domains.length < AUDIT_MIN) return { ok: false, error: `An audit needs at least ${AUDIT_MIN} sites.`, domains };
  if (domains.length > AUDIT_MAX) return { ok: false, error: `An audit compares at most ${AUDIT_MAX} sites.`, domains: domains.slice(0, AUDIT_MAX) };
  return { ok: true, domains };
}
export const auditPath = (domains: string[], sector?: string | null) => `/audit?sites=${domains.join(",")}${sector ? `&sector=${sector}` : ""}`;

export type SiteStatus = "tracked" | "rendered" | "pending" | "unknown";
export type AuditSiteIn = {
  domain: string; status: SiteStatus;
  site: { sector: string; name: string | null; last_snapshot_at: string | null; last_change_at: string | null } | null;
  /** Latest live desktop home signals (tracked) or the rendered queue result (rendered). */
  signals: unknown; captured_at: string | null;
  /** Latest live library_site_history row (tracked sites; carries AI tags). */
  history: Omit<SiteRow, "domain" | "quarter" | "sector"> | null;
};
export type ForecastIn = { dimension: string; value: string; scope: string; stage: string | null; current_share: number | null; momentum: number | null };
export type AuditRows = { domains: string[]; sector: string | null; now: string; sites: AuditSiteIn[]; events: EventRow[]; rebrands: RebrandRow[]; forecasts: ForecastIn[]; google: string[]; thumbs: ThumbRow[]; dataThrough: string | null };

export type TraitRef = { trait: string; name: string; dimension: Dimension; basis: Basis; stage: StageName | null; share: number | null; explainer: string; receipt: string };
type Face = { family: string; google: boolean; size: number | null; weight: string | null; tracking: number | null; case: string | null; style: "serif" | "sans" | "mono" | null };
export type Audit = {
  domains: string[]; sector: string; sectorSource: "chosen" | "majority" | "all"; url: string; now: string; dataThrough: string | null;
  glance: { domain: string; name: string | null; sector: string | null; status: SiteStatus; captured: string | null; latest: { text: string; at: string } | null; thumb: Thumb | null; terminal: string }[];
  type: { sites: { domain: string; h1: Face | null; body: Face | null }[]; shared: { family: string; google: boolean; domains: string[] }[] } | null;
  color: { sites: { domain: string; theme: string | null; bg: { hex: string; name: string } | null; accent: { hex: string; name: string } | null; palette: { hex: string; name: string; share: number | null }[] }[]; overlap: { name: string; domains: string[] }[]; themes: string } | null;
  layout: { sites: { domain: string; heroLayout: string | null; heroMedia: string | null; align: string | null; gridCols: number | null; buttons: string | null; stack: string[] }[]; components: Matrix | null; css: Matrix | null } | null;
  vibe: { sites: { domain: string; aesthetic: string[]; imagery: string[]; tone: string[]; aiPositioning: string | null; colorMood: string | null; confidence: number | null }[] } | null;
  market: { sites: { domain: string; scope: string; ahead: TraitRef[]; behind: TraitRef[]; sentence: string }[] } | null;
  moves: { sites: { domain: string; items: { at: string; text: string; href: string }[] }[] } | null;
  whitespace: { scope: string; basedOn: number; of: number; traits: TraitRef[] } | null;
  method: { captures: { domain: string; at: string | null; source: string }[]; notes: string[] };
  pending: string[];
  sections: string[];
};
export type Matrix = { rows: { trait: string; name: string; basis: Basis; cells: (boolean | null)[]; count: number }[]; domains: string[] };

const SERIF = /serif|georgia|times|garamond|baskerville|caslon|bodoni|didot|lyon|tiempos|canela|lora|merriweather|playfair|fraunces|newsreader|domaine|recoleta/i;
const MONO = /mono|code|courier|consolas/i;
const styleOf = (f: string) => (MONO.test(f) ? "mono" : SERIF.test(f) && !/sans/i.test(f) ? "serif" : "sans");
const CASE: Record<string, string> = { uppercase: "all caps", lowercase: "lowercase", capitalize: "title case", none: "as written" };
const tagArr = (v: unknown) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((x): x is string => typeof x === "string");
const stageOrder: StageName[] = ["Rising", "Emerging", "Peaking", "Steady", "Fading"];

function face(signals: unknown, role: "h1" | "body", google: Set<string>): Face | null {
  const r = obj(obj(obj(signals)["type"])["rendered"])[role], dcl = obj(obj(obj(signals)["type"])["declared"])[role];
  const family = str(obj(r)["family"]);
  if (!family) return null;
  const t = str(obj(dcl)["transform"]);
  return { family, google: google.has(family), size: num(obj(dcl)["size_px"]), weight: obj(dcl)["weight"] == null ? null : String(obj(dcl)["weight"]), tracking: num(obj(dcl)["letter_spacing_em"]), case: t ? CASE[t] ?? t : null, style: styleOf(family) };
}
/** Trait keys a site shows: from its latest library history row, or from rendered signals when untracked. */
export function traitsOf(s: AuditSiteIn): string[] {
  if (s.status !== "tracked" && s.status !== "rendered") return [];
  if (s.history) return siteTraits({ domain: s.domain, quarter: "", sector: s.site?.sector ?? "", ...s.history });
  const f = fingerprint(s.signals), g = obj(s.signals);
  return siteTraits({ domain: s.domain, quarter: "", sector: "", theme: f.theme, h1_family: f.h1_family, webfont: f.body_webfont, h1_tracking: f.h1_tracking, css_features: f.css_features, frameworks: g["tech"], hero_media: f.hero });
}
const hasAi = (s: AuditSiteIn) => !!s.history?.ai_tags && typeof s.history.ai_tags === "object" && !(obj(s.history.ai_tags)["blocked_reason"]);

function matrix(sites: AuditSiteIn[], keysOf: (s: AuditSiteIn) => string[] | null, prefix: string): Matrix | null {
  const per = sites.map(keysOf);
  if (!per.some(k => k && k.length)) return null;
  const counts = new Map<string, number>();
  for (const k of per) for (const x of new Set(k ?? [])) counts.set(x, (counts.get(x) ?? 0) + 1);
  const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x, count]) => ({ trait: `${prefix}:${x}`, name: label(`${prefix}:${x}`).name, basis: basis(`${prefix}:${x}`), cells: per.map(k => (k ? k.includes(x) : null)), count }));
  return { rows, domains: sites.map(s => s.domain) };
}

export function auditModel(r: AuditRows): Audit {
  const google = new Set(r.google), byDomain = new Map(r.sites.map(s => [s.domain, s]));
  const sites = r.domains.map(d => byDomain.get(d) ?? { domain: d, status: "unknown" as const, site: null, signals: null, captured_at: null, history: null });
  const measured = sites.filter(s => (s.status === "tracked" || s.status === "rendered") && s.signals);
  const tracked = sites.filter(s => s.status === "tracked" && s.site);

  // Main sector: the chosen one, else the most common sector among tracked sites (ties alphabetical), else all.
  const fScopes = new Set(r.forecasts.map(f => f.scope));
  let sector = "all", sectorSource: Audit["sectorSource"] = "all";
  if (r.sector && (SECTORS as readonly string[]).includes(r.sector)) { sector = r.sector; sectorSource = "chosen"; }
  else {
    const c = new Map<string, number>(); for (const s of tracked) c.set(s.site!.sector, (c.get(s.site!.sector) ?? 0) + 1);
    const top = [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (top && fScopes.has(top[0])) { sector = top[0]; sectorSource = "majority"; }
  }
  const fc = new Map(r.forecasts.map(f => [`${f.scope}|${f.dimension}:${f.value}`, f]));
  const ref = (trait: string, scope: string): TraitRef => {
    const f = fc.get(`${scope}|${trait}`), l = label(trait);
    return { trait, name: l.name, dimension: l.dimension, basis: basis(trait), stage: stageName(f?.stage), share: f?.current_share ?? null, explainer: explainerPath(trait), receipt: `/?panel=brief&trait=${encodeURIComponent(trait)}&sector=${scope}` };
  };

  const eventsBy = (d: string) => r.events.filter(e => e.domain === d).sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  const glance = sites.map(s => {
    const e = eventsBy(s.domain)[0], rb = r.rebrands.filter(x => x.domain === s.domain).sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at))[0];
    const latest = e && (!rb || e.detected_at >= rb.confirmed_at) ? { text: eventSentence(e), at: e.detected_at } : rb ? { text: rebrandSentence(rb), at: rb.confirmed_at } : null;
    return { domain: s.domain, name: s.site?.name ?? null, sector: s.site?.sector ?? null, status: s.status, captured: s.captured_at, latest, thumb: s.status === "tracked" ? pickThumb(r.thumbs, s.domain) : null, terminal: s.status === "tracked" ? `/library/${s.domain}` : `/?cmd=${encodeURIComponent(`critique https://${s.domain}`)}` };
  });

  // b. Type
  const typeSites = measured.map(s => ({ domain: s.domain, h1: face(s.signals, "h1", google), body: face(s.signals, "body", google) })).filter(x => x.h1 || x.body);
  const famSites = new Map<string, Set<string>>();
  for (const t of typeSites) for (const f of [t.h1, t.body]) if (f) famSites.set(f.family, (famSites.get(f.family) ?? new Set()).add(t.domain));
  const shared = [...famSites].filter(([, ds]) => ds.size >= 2).map(([family, ds]) => ({ family, google: google.has(family), domains: [...ds].sort() })).sort((a, b) => b.domains.length - a.domains.length || a.family.localeCompare(b.family));
  const type = typeSites.length ? { sites: typeSites, shared } : null;

  // c. Color
  const colorSites = measured.map(s => {
    const f = fingerprint(s.signals);
    return { domain: s.domain, theme: f.theme, bg: f.page_bg ? { hex: f.page_bg.toUpperCase(), name: hexName(f.page_bg) } : null, accent: f.accent ? { hex: f.accent.toUpperCase(), name: hexName(f.accent) } : null,
      palette: f.palette.slice(0, 5).map(p => ({ hex: p.hex!.toUpperCase(), name: hexName(p.hex), share: p.share })) };
  }).filter(c => c.theme || c.accent || c.palette.length);
  const nameSites = new Map<string, Set<string>>();
  for (const c of colorSites) for (const n of new Set([c.accent?.name, ...c.palette.map(p => p.name)].filter((x): x is string => !!x))) nameSites.set(n, (nameSites.get(n) ?? new Set()).add(c.domain));
  const overlap = [...nameSites].filter(([, ds]) => ds.size >= 2).map(([name, ds]) => ({ name, domains: [...ds].sort() })).sort((a, b) => b.domains.length - a.domains.length || a.name.localeCompare(b.name));
  const dark = colorSites.filter(c => c.theme === "dark").length, light = colorSites.filter(c => c.theme === "light").length;
  const color = colorSites.length ? { sites: colorSites, overlap, themes: [dark ? `${dark} dark` : "", light ? `${light} light` : ""].filter(Boolean).join(", ") || "theme not measured" } : null;

  // d. Layout & components
  const layoutSites = measured.map(s => {
    const f = fingerprint(s.signals), ai = obj(s.history?.ai_tags);
    return { domain: s.domain, heroLayout: hasAi(s) ? str(ai["hero_layout"]) : null, heroMedia: f.hero, align: f.align, gridCols: f.grid_cols, buttons: radiusBucket(f.cta_radius), stack: f.stack.filter(k => k !== "generator") };
  });
  const components = matrix(sites, s => (hasAi(s) ? tagArr(obj(s.history!.ai_tags)["components"]) : null), "components");
  const css = matrix(sites, s => (s.status === "tracked" || s.status === "rendered") && s.signals ? fingerprint(s.signals).css_features : null, "css");
  const layout = layoutSites.length ? { sites: layoutSites, components, css } : null;

  // e. Vibe & voice (AI-tagged estimates)
  const vibeSites = sites.filter(hasAi).map(s => { const a = obj(s.history!.ai_tags); return { domain: s.domain, aesthetic: tagArr(a["aesthetic"]), imagery: tagArr(a["imagery"]), tone: tagArr(a["tone"]), aiPositioning: str(a["ai_positioning"]), colorMood: str(a["color_mood"]), confidence: num(a["confidence"]) }; });
  const vibe = vibeSites.length ? { sites: vibeSites } : null;

  // f. Versus the market: stages in each site's own sector (fallback all).
  const traitSets = new Map(sites.map(s => [s.domain, traitsOf(s)]));
  const marketSites = sites.filter(s => (traitSets.get(s.domain) ?? []).length).map(s => {
    const own = s.site?.sector && fScopes.has(s.site.sector) ? s.site.sector : "all";
    const refs = [...new Set(traitSets.get(s.domain)!)].map(t => ref(t, own)).filter(x => x.stage);
    const ahead = refs.filter(x => x.stage === "Rising" || x.stage === "Emerging").sort((a, b) => stageOrder.indexOf(a.stage!) - stageOrder.indexOf(b.stage!) || (b.share ?? 0) - (a.share ?? 0) || a.name.localeCompare(b.name));
    const behind = refs.filter(x => x.stage === "Fading").sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || a.name.localeCompare(b.name));
    const where = scopeText(own);
    const names = (xs: TraitRef[]) => xs.slice(0, 4).map(x => x.name).join(", ") + (xs.length > 4 ? ` and ${xs.length - 4} more` : "");
    const sentence = [ahead.length ? `${s.domain} already shows ${ahead.length} ${ahead.length === 1 ? "signal" : "signals"} that ${ahead.length === 1 ? "is" : "are"} rising or emerging in ${where}: ${names(ahead)}.` : `${s.domain} shows no signals that are rising or emerging in ${where} right now.`,
      behind.length ? `It still uses ${behind.length} fading ${behind.length === 1 ? "signal" : "signals"}: ${names(behind)}.` : "It uses no fading signals."].join(" ");
    return { domain: s.domain, scope: own, ahead, behind, sentence };
  });
  const market = marketSites.length ? { sites: marketSites } : null;

  // g. Recent moves (last 90 days)
  const since = new Date(Date.parse(r.now) - MOVES_DAYS * 864e5).toISOString();
  const moveSites = sites.map(s => ({ domain: s.domain, items: [
    ...eventsBy(s.domain).filter(e => e.detected_at >= since).map(e => ({ at: e.detected_at, text: eventSentence(e), href: `/library/${s.domain}` })),
    ...r.rebrands.filter(x => x.domain === s.domain && x.confirmed_at >= since).map(x => ({ at: x.confirmed_at, text: `${rebrandSentence(x)}. ${x.read}`, href: "/?panel=rebrands" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12) })).filter(m => m.items.length);
  const moves = moveSites.length ? { sites: moveSites } : null;

  // h. White space: rising/emerging in the main sector, used by none of these sites.
  const withTraits = sites.filter(s => (traitSets.get(s.domain) ?? []).length), used = new Set(withTraits.flatMap(s => traitSets.get(s.domain)!));
  const aiKnown = sites.some(hasAi);
  const AI_CATS = new Set(["imagery", "aesthetic", "components", "hero_layout", "ai_positioning", "tone", "color_mood"]);
  const open = withTraits.length ? r.forecasts.filter(f => f.scope === sector && (stageName(f.stage) === "Rising" || stageName(f.stage) === "Emerging") && !used.has(`${f.dimension}:${f.value}`) && (aiKnown || !AI_CATS.has(f.dimension)))
    .sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0) || `${a.dimension}:${a.value}`.localeCompare(`${b.dimension}:${b.value}`)).slice(0, WHITE_SPACE_MAX).map(f => ref(`${f.dimension}:${f.value}`, sector)) : [];
  const whitespace = open.length ? { scope: sector, basedOn: withTraits.length, of: sites.length, traits: open } : null;

  const pending = sites.filter(s => s.status === "pending" || s.status === "unknown").map(s => s.domain);
  const method = {
    captures: sites.map(s => ({ domain: s.domain, at: s.captured_at, source: s.status === "tracked" ? "Library capture (desktop homepage)" : s.status === "rendered" ? "One-off render (not tracked)" : s.status === "pending" ? "Render queued" : "Not tracked" })),
    notes: [
      "Type, color and layout are measured from each site's latest desktop homepage capture; a change counts only after two captures agree.",
      "Vibe & voice tags, hero layout and components are AI estimates read from homepage images, shown only for confident reads.",
      `Stages come from the weekly forecast${r.dataThrough ? ` (data through ${r.dataThrough})` : ""}, read in each site's own sector; open territory uses ${scopeText(sector)}.`,
      "Sites that are not tracked yet appear as pending and are left out of the comparisons until they are rendered.",
    ],
  };
  const out: Audit = { domains: r.domains, sector, sectorSource, url: `${SITE_URL}${auditPath(r.domains, sectorSource === "chosen" ? sector : null)}`, now: r.now, dataThrough: r.dataThrough, glance, type, color, layout, vibe, market, moves, whitespace, method, pending, sections: [] };
  out.sections = ["glance", ...(["type", "color", "layout", "vibe", "market", "moves", "whitespace"] as const).filter(k => out[k] !== null), "method"];
  return out;
}
