// BRAND object: one Read page per tracked site, built from stored rows (the audit's single-site model plus its full move history). Pure.
import { auditModel, traitsOf, type AuditRows, type TraitRef } from "./agency/audit";
import { eventSentence, rebrandSentence, EVENT_KIND, type EventRow } from "./agency/changes";
import { basis, label, sectorName, stageName, type Basis, type Dimension, type StageName } from "./labels";
import { OBJECT_BLOCKS, brandPath, consoleHref, signalPath, type Block } from "./ia";
import type { Tier } from "./tiers";
import type { Thumb } from "./thumbs";

export type BrandPeer = { domain: string; name: string | null; sector: string; traits: string[] };
export type BrandRows = { domain: string; audit: AuditRows; events: EventRow[]; peers: BrandPeer[]; tiers: [string, Tier][] };
export type BrandTag = { key: string; name: string; basis: Basis; kind: "aesthetic" | "imagery" | "tone" | "theme" };
export type BrandShow = { key: string; name: string; dimension: Dimension; basis: Basis; stage: StageName | null; tier: Tier; href: string };
export type BrandPage = {
  domain: string; name: string; sector: string | null; sectorName: string; tracked: boolean; captured: string | null; lastMove: { text: string; at: string } | null; thumb: Thumb | null;
  identity: { h1: { family: string; google: boolean } | null; body: { family: string; google: boolean } | null; theme: string | null; accent: { hex: string; name: string } | null; palette: { hex: string; name: string }[]; tags: BrandTag[] };
  timeline: { id: string; at: string; kind: string; text: string; basis: Basis; href: string }[];
  versus: { scope: string; scopeName: string; ahead: TraitRef[]; behind: TraitRef[] } | null;
  soWhat: string;
  closest: { domain: string; name: string | null; shared: number; href: string }[];
  shows: BrandShow[];
  actions: { watch: string; compare: string; audit: string | null; differentiate: string; recommendType: string | null; terminal: string };
  blocks: readonly Block[];
};
export const TIMELINE_MAX = 40, CLOSEST_MAX = 4;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Ahead of its sector on 3 rising signals; still using 1 fading one." Deterministic, from the audit's ahead/behind lists. */
export function brandSoWhat(ahead: number, behind: number, where = "its sector"): string {
  if (!ahead && !behind) return `Neither ahead of nor behind ${where} on any signal we stage right now.`;
  const a = ahead ? `Ahead of ${where} on ${plural(ahead, "rising signal")}` : `Not ahead of ${where} on any rising signal`;
  const b = behind ? `still using ${behind === 1 ? "1 fading one" : `${behind} fading ones`}` : "using no fading ones";
  return `${a}; ${b}.`;
}
const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 0; };

export function brandModel(r: BrandRows): BrandPage {
  const a = auditModel(r.audit), d = r.domain, site = r.audit.sites.find(s => s.domain === d) ?? null, g = a.glance[0]!;
  const tiers = new Map(r.tiers), shown = (k: string) => { const t = tiers.get(k); return t === "headline" || t === "supporting"; };
  const sector = site?.site?.sector ?? null, scope = sector && r.audit.forecasts.some(f => f.scope === sector) ? sector : "all";
  const type = a.type?.sites.find(s => s.domain === d) ?? null, color = a.color?.sites.find(s => s.domain === d) ?? null, vibe = a.vibe?.sites.find(s => s.domain === d) ?? null;
  const tags: BrandTag[] = [
    ...(color?.theme ? [{ key: `theme:${color.theme}`, name: label(`theme:${color.theme}`).name, basis: basis(`theme:${color.theme}`), kind: "theme" as const }] : []),
    ...(["aesthetic", "imagery", "tone"] as const).flatMap(kind => (vibe?.[kind] ?? []).map(v => ({ key: `${kind}:${v}`, name: label(`${kind}:${v}`).name, basis: basis(`${kind}:${v}`), kind }))),
  ];
  const timeline = [
    ...r.events.filter(e => e.domain === d).map(e => ({ id: `event:${e.id}`, at: e.detected_at, kind: EVENT_KIND[e.type] ?? "Change", text: eventSentence(e), basis: (e.type === "imagery_shift" || e.type === "aesthetic_shift" ? "ai" : "measured") as Basis, href: `/library/${d}` })),
    ...r.audit.rebrands.filter(x => x.domain === d).map(x => ({ id: `rebrand:${x.confirmed_at}`, at: x.confirmed_at, kind: "Rebrand", text: `${rebrandSentence(x)}. ${x.read}`, basis: "measured" as Basis, href: `/library/${d}` })),
  ].sort((x, y) => y.at.localeCompare(x.at) || x.id.localeCompare(y.id)).slice(0, TIMELINE_MAX);
  const m = a.market?.sites.find(s => s.domain === d) ?? null;
  const versus = m ? { scope: m.scope, scopeName: sectorName(m.scope), ahead: m.ahead.filter(x => shown(x.trait)), behind: m.behind.filter(x => shown(x.trait)) } : null;
  const where = versus && versus.scope !== "all" ? "its sector" : "all sectors";
  const self = r.peers.find(p => p.domain === d), mine = new Set((self?.traits ?? (site ? traitsOf(site) : [])).filter(shown));
  const closest = r.peers.filter(p => p.domain !== d && p.sector === sector)
    .map(p => { const t = new Set(p.traits.filter(shown)); let n = 0; for (const x of t) if (mine.has(x)) n++; return { domain: p.domain, name: p.name, shared: n, score: jaccard(mine, t), href: brandPath(p.domain) }; })
    .filter(p => p.shared > 0).sort((x, y) => y.score - x.score || y.shared - x.shared || x.domain.localeCompare(y.domain)).slice(0, CLOSEST_MAX).map(({ score: _s, ...p }) => p);
  const fc = new Map(r.audit.forecasts.filter(f => f.scope === scope).map(f => [`${f.dimension}:${f.value}`, f]));
  const order: Record<Tier, number> = { headline: 0, supporting: 1, archive: 2 };
  const shows = [...mine].map(k => { const l = label(k); return { key: k, name: l.name, dimension: l.dimension, basis: basis(k), stage: stageName(fc.get(k)?.stage), tier: tiers.get(k) ?? "supporting", href: signalPath(k) }; })
    .sort((x, y) => order[x.tier] - order[y.tier] || x.name.localeCompare(y.name));
  const peers = closest.slice(0, 2).map(p => p.domain);
  return {
    domain: d, name: site?.site?.name ?? d, sector, sectorName: sectorName(sector), tracked: g.status === "tracked", captured: g.captured, lastMove: timeline[0] ? { text: timeline[0].text, at: timeline[0].at } : g.latest, thumb: g.thumb,
    identity: { h1: type?.h1 ? { family: type.h1.family, google: type.h1.google } : null, body: type?.body ? { family: type.body.family, google: type.body.google } : null, theme: color?.theme ?? null, accent: color?.accent ?? null, palette: (color?.palette ?? []).map(p => ({ hex: p.hex, name: p.name })), tags },
    timeline, versus, soWhat: versus ? brandSoWhat(versus.ahead.length, versus.behind.length, where) : "Not enough measured data on this brand yet to compare it with its sector.",
    closest, shows,
    actions: { watch: `/watch/new?add=${encodeURIComponent(d)}`, compare: `/audit/new?sites=${encodeURIComponent(d)}`, audit: peers.length ? `/audit?sites=${[d, ...peers].sort().join(",")}` : null,
      differentiate: consoleHref(`diff https://${d}`), recommendType: sector ? consoleHref(`type ${sector} headline any`, sector) : null, terminal: `/library/${d}` },
    blocks: OBJECT_BLOCKS,
  };
}
