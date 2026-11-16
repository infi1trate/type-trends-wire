// Trait explainer model: one editorial page per forecast trait from its latest stored rows. Pure.
import { canonical, explainerPath, label, scopeText, stageName, type Dimension, type StageName } from "../labels";
import { glossaryEntry, stageId, dimensionId } from "../glossary";
import { cardModel, usableSeries, MIN_SERIES, type ForecastLike } from "../chart/model";
import type { CardModel } from "../chart/card";
import { pickThumb, type Thumb, type ThumbRow } from "../thumbs";
import { traitDefinition, pct, pts } from "./copy";
import { ledgerItem, type LedgerItem, type StoredCall } from "../ledger/ledger";
import { basis, type Basis } from "../labels";
import type { Signal } from "../signals";
import type { Tier, TierResult } from "../tiers";
import { evidenceKeys } from "../tiers";
import { compositeOf, ruleText } from "../composites";
import { soWhat } from "./copy";
export type EvidenceItem = { key: string; name: string; dimension: Dimension; basis: Basis; tier: Tier | null; stage: StageName | null; share: number | null; href: string };

type Raw = Record<string, unknown> | null;
export type TRow = ForecastLike & { status: string; next_wave_score: number | null; components: Raw; lead_sites: { domain: string; adopted?: string | null; lead?: number | null }[] | null; computed_at: string };
export type TraitRows = { key: string; signal?: Signal | null; tier?: TierResult | null; evidence?: EvidenceItem[]; headline?: string[] | null; rows: TRow[]; peers: { dimension: string; value: string; stage: string | null; current_share: number | null; momentum: number | null }[]; sites: { domain: string; sector: string; name: string | null }[]; thumbs: ThumbRow[]; data_through: string | null; calls?: StoredCall[] };
export type TraitPage = {
  key: string; name: string; dimension: Dimension; stage: StageName | null; share: number | null; momentum: number | null; nextWave: number | null;
  definition: string; stageNote: string | null; dimensionNote: string | null; card: CardModel | null; chartNote: string | null;
  sectors: { sector: string; share: number; stage: StageName | null; lead: number }[];
  receipts: { term: string; text: string; anchor: string }[];
  examples: { domain: string; name: string | null; sector: string; adopted: string | null; thumb: Thumb | null; terminal: string; live: string }[];
  related: { key: string; name: string; stage: StageName | null; share: number | null; href: string }[];
  terminal: string; dataThrough: string | null; runId: number | null; computedAt: string | null;
  /** This signal's past ledger calls, newest first. */
  calls: LedgerItem[];
  basis: Basis; tier: Tier | null; tierReasons: string[]; momentumIndex: number | null; direction: string | null; confidence: string | null; confidenceReason: string | null; soWhat: string | null;
  /** Supporting evidence: a composite's members, or the composites this signal belongs to. */
  evidence: EvidenceItem[]; rule: string | null; evidenceTitle: string;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const quarter = (q: string | null | undefined) => (q && /^\d{4}Q[1-4]$/.test(q) ? `Q${q.slice(5)} ${q.slice(0, 4)}` : q ?? null);
const signed = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;

export function traitModel(t: TraitRows): TraitPage | null {
  const key = canonical(t.key), all = t.rows.find(r => r.scope === "all");
  if (!all) return null;
  const l = label(key), stage = stageName(all.stage), comps = obj(all.components), raw = obj(comps["raw"]);
  const series = usableSeries(all);
  const card = series.length >= MIN_SERIES ? cardModel({ week: "", run_id: all.run_id ?? 0, origin: "call", call: traitDefinition(key).split(". ")[0]! + ".", row: all, data_through: t.data_through, source_ref: `forecast:${key}:all` }) : null;
  const allShare = all.current_share ?? 0;
  const sectors = t.rows.filter(r => r.scope !== "all" && r.current_share != null && r.current_share > allShare)
    .map(r => ({ sector: r.scope, share: r.current_share!, stage: stageName(r.stage), lead: r.current_share! - allShare }))
    .sort((a, b) => b.lead - a.lead || a.sector.localeCompare(b.sector)).slice(0, 3);
  const receipts: TraitPage["receipts"] = [];
  const g = (id: string) => glossaryEntry(id);
  const sites = num(comps["sites"]);
  if (sites != null) receipts.push({ term: "Sample", text: `Measured on ${sites} homepages in the latest quarter of the sample.`, anchor: "m-forecast" });
  const add = (id: string, v: number | null, text: (v: number) => string, missing?: string | null) => {
    const e = g(id); if (!e) return;
    if (v != null) receipts.push({ term: e.term, text: `${text(v)} ${e.measures}`, anchor: e.methodologyAnchor });
    else if (missing) receipts.push({ term: e.term, text: `Not measured this run: ${missing}.`, anchor: e.methodologyAnchor });
  };
  add("momentum", num(raw["momentum"]) ?? all.momentum, v => `${signed(v)} points a quarter.`);
  add("gap", num(raw["gap"]), v => `${signed(v)} share points.`);
  add("vanguard", num(raw["vanguard"]), v => `${signed(v)} share points.`, typeof obj(comps["vanguard"])["reason"] === "string" ? String(obj(comps["vanguard"])["reason"]) : null);
  add("curation", num(raw["curation"]), v => `${signed(v)} share points.`, typeof obj(comps["curation"])["reason"] === "string" ? String(obj(comps["curation"])["reason"]) : null);
  add("corroboration", num(raw["corroboration"]), v => `Raw value ${v.toFixed(2)}.`);
  add("discourse", num(raw["discourse"]), v => `Raw value ${v.toFixed(2)}.`, "fewer than four weeks of sampled posts");
  if (num(all.next_wave_score) != null) receipts.push({ term: "Next-wave score", text: `${signed(all.next_wave_score!, 2)}. ${g("next-wave-score")?.measures ?? ""}`.trim(), anchor: "m-next-wave-components" });
  const lib = new Map(t.sites.map(s => [s.domain, s]));
  const examples = [...(all.lead_sites ?? [])].filter(s => lib.has(s.domain)).sort((a, b) => (b.lead ?? 0) - (a.lead ?? 0) || a.domain.localeCompare(b.domain)).slice(0, 8)
    .map(s => ({ domain: s.domain, name: lib.get(s.domain)!.name, sector: lib.get(s.domain)!.sector, adopted: quarter(s.adopted), thumb: pickThumb(t.thumbs, s.domain), terminal: `/library/${s.domain}`, live: `https://${s.domain}` }));
  const head = t.headline ? new Set(t.headline) : null;
  const related = t.peers.filter(p => `${p.dimension}:${p.value}` !== key && label(`${p.dimension}:${p.value}`).dimension === l.dimension && (!head || head.has(`${p.dimension}:${p.value}`)))
    .sort((a, b) => (b.current_share ?? -1) - (a.current_share ?? -1) || a.value.localeCompare(b.value)).slice(0, 5)
    .map(p => { const k = `${p.dimension}:${p.value}`; return { key: k, name: label(k).name, stage: stageName(p.stage), share: p.current_share, href: explainerPath(k) }; });
  return {
    key, name: l.name, dimension: l.dimension, stage, share: all.current_share, momentum: all.momentum, nextWave: num(all.next_wave_score),
    definition: traitDefinition(key), stageNote: stage ? g(stageId(stage))?.measures ?? null : null, dimensionNote: g(dimensionId(l.dimension))?.measures ?? null,
    card, chartNote: card ? null : "Not enough usable quarters for a chart yet: a trait needs two quarters with at least 15 sites and 25% archive coverage.",
    sectors, receipts, examples, related, terminal: `/?panel=brief&trait=${encodeURIComponent(key)}&sector=all`, dataThrough: quarter(t.data_through), runId: all.run_id ?? null, computedAt: all.computed_at ?? null,
    calls: (t.calls ?? []).slice(0, 24).map(ledgerItem),
    basis: basis(key), tier: t.tier?.tier ?? null, tierReasons: t.tier?.reasons ?? [], momentumIndex: t.signal?.momentum_index ?? null, direction: t.signal?.direction ?? null,
    confidence: t.signal?.confidence ?? null, confidenceReason: t.signal?.confidence_reason ?? null, soWhat: t.tier?.tier === "headline" ? soWhat(key, all.stage) : null,
    evidence: t.evidence ?? evidenceKeys(key).map(k => { const m = label(k); return { key: k, name: m.name, dimension: m.dimension, basis: basis(k), tier: null, stage: null, share: null, href: explainerPath(k) }; }),
    rule: compositeOf(key) ? ruleText(compositeOf(key)!) : null, evidenceTitle: compositeOf(key) ? "Member signals" : "Part of",
  };
}
export const traitSummary = (p: TraitPage) => [p.stage ? `${p.stage}` : "Not staged yet", pct(p.share, 1) ? `${pct(p.share, 1)} of tracked homepages` : null, p.momentum != null ? `${p.momentum >= 0 ? "gaining" : "losing"} ${pts(p.momentum)}` : null].filter(Boolean).join(" · ");
export { scopeText };
