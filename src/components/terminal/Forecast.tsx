import { Suspense, useEffect, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { forecastQuery, forecastDetailQuery, chartCardQuery, discourseSinceQuery, type ForecastRow, type BriefDoc } from "@/lib/data";
import { briefDisplay, label, stageName, STAGES } from "@/lib/labels";
import { coverageSentences } from "@/lib/model-card-copy";
import { DimTag, Info, StageBadge } from "./Info";
import { stageId } from "@/lib/glossary";
import { ChartOfWeek } from "./ChartCard";
import { SECTORS } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { LibraryBand } from "./LibraryShared";
import { Overlay } from "./primitives";

const COMPONENTS = [["gap", "TRENDSETTER GAP"], ["vanguard", "VANGUARD"], ["curation", "CURATION"], ["momentum", "MOMENTUM"], ["corroboration", "CORROBORATION"], ["discourse", "DISCOURSE"], ["supply", "SUPPLY"]] as const;
const COMPONENT_G: Record<string, string> = { gap: "gap", vanguard: "vanguard", curation: "curation", momentum: "momentum", corroboration: "corroboration", discourse: "discourse", supply: "supply" };
const pct = (v: number | null | undefined, d = 1) => (v == null ? "not measured" : `${(v * 100).toFixed(d)}%`);
const NO_PROJ = <span className="text-compare-muted" title="No projection yet: a curve needs at least 4 usable quarters of history.">not fitted yet</span>;
const qi = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
const ql = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
/** Trait display name from the shared label map; kept as an export for older imports. */
export const traitLabel = (dimension: string, value: string) => label(`${dimension}:${value}`).name;
function TraitName({ dimension, value }: { dimension: string; value: string }) { const l = label(`${dimension}:${value}`); return <><span className="normal-case">{l.name}</span> <DimTag d={l.dimension} /></>; }
const key = (r: { dimension: string; value: string }) => `${r.dimension}:${r.value}`;

type Pt = { q: string; s: number | null; n: number; c: number };
function Cone({ quarters: raw, proj, fitted, backtest, large = false, sectors }: { quarters: Pt[]; proj: { h: number; mid: number | null; lo: number | null; hi: number | null }[]; fitted?: { quarter: string; value: number }[] | undefined; backtest?: { quarter: string; predicted: number }[] | undefined; large?: boolean; sectors?: { scope: string; pts: Pt[] }[] }) {
  const quarters = raw, pts = raw.filter(p => p.s !== null && p.n >= 15 && p.c >= .25), faint = raw.filter(p => p.s !== null && p.n > 0 && !(p.n >= 15 && p.c >= .25));
  if (!pts.length) return <svg viewBox="0 0 120 32" className={large ? "h-64 w-full" : "h-8 w-28"} role="img" aria-label="No history"><line x1="0" x2="120" y1="31" y2="31" stroke="var(--rule)" /></svg>;
  const p0 = pts[0]!, pn = pts[pts.length - 1]!, first = qi(quarters[0]?.q ?? p0.q), latest = qi(pn.q), last = latest + 4, W = large ? 600 : 120, H = large ? 220 : 32;
  const all = [...pts.map(p => p.s ?? 0), ...(large ? faint.map(p => p.s ?? 0) : []), ...proj.flatMap(p => [p.hi ?? 0, p.mid ?? 0]), ...(fitted ?? []).map(f => f.value), ...(sectors ?? []).flatMap(s => s.pts.map(p => p.s ?? 0))];
  const max = Math.max(0.05, ...all);
  const x = (q: number) => 4 + (q - first) / Math.max(1, last - first) * (W - 8), y = (v: number) => H - 3 - v / max * (H - 8);
  const cone = proj.filter(p => p.lo !== null && p.hi !== null);
  const conePath = cone.length ? `M${x(latest)},${y(pn.s ?? 0)} ${cone.map(p => `L${x(latest + p.h)},${y(p.hi!)}`).join(" ")} ${[...cone].reverse().map(p => `L${x(latest + p.h)},${y(p.lo!)}`).join(" ")} Z` : "";
  return <svg viewBox={`0 0 ${W} ${H}`} className={large ? "h-64 w-full" : "h-8 w-28"} role="img" aria-label={`Share ${p0.q} to ${pn.q}${cone.length ? " with projection cone" : ""}`}>
    <line x1="0" x2={W} y1={H - 2} y2={H - 2} stroke="var(--rule)" />
    {sectors?.map(s => { const sp = s.pts.filter(p => p.s !== null && p.n >= 8 && p.c >= .25); return <polyline key={s.scope} fill="none" stroke="var(--compare-muted)" strokeOpacity=".35" strokeWidth="1" points={sp.map(p => `${x(qi(p.q))},${y(p.s!)}`).join(" ")}><title>{s.scope}</title></polyline>; })}
    {conePath && <path d={conePath} fill="var(--signal)" fillOpacity=".18" stroke="none" />}
    {fitted && <polyline fill="none" stroke="var(--color-ink)" strokeOpacity=".5" strokeDasharray="4 3" points={fitted.filter(f => qi(f.quarter) <= last).map(f => `${x(qi(f.quarter))},${y(f.value)}`).join(" ")} />}
    {backtest && backtest.length > 0 && <polyline fill="none" stroke="var(--compare-muted)" strokeDasharray="2 3" points={backtest.map(b => `${x(qi(b.quarter))},${y(b.predicted)}`).join(" ")}><title>Backtest prediction from 2025Q2</title></polyline>}
    <polyline fill="none" stroke="var(--color-ink)" strokeWidth={large ? 2 : 1} points={pts.map(p => `${x(qi(p.q))},${y(p.s!)}`).join(" ")} />
    {large && faint.map(p => <circle key={`f${p.q}`} cx={x(qi(p.q))} cy={y(p.s!)} r="2" fill="var(--compare-muted)" fillOpacity=".5"><title>{`${p.q} · ${pct(p.s)} · n=${p.n} · not usable`}</title></circle>)}
    {pts.map(p => <circle key={p.q} cx={x(qi(p.q))} cy={y(p.s!)} r={large ? 3 : 1.5} fill="var(--color-ink)"><title>{`${p.q} · ${pct(p.s)} · n=${p.n} · coverage ${(p.c * 100).toFixed(0)}%`}</title></circle>)}
    {proj.filter(p => p.mid !== null).map(p => <circle key={p.h} cx={x(latest + p.h)} cy={y(p.mid!)} r={large ? 3 : 1.5} fill="var(--signal)"><title>{`+${p.h}Q ${ql(latest + p.h)} · ${pct(p.mid)} (${pct(p.lo)}–${pct(p.hi)})`}</title></circle>)}
  </svg>;
}
const projOf = (r: Pick<ForecastRow, "proj_q1" | "proj_q1_lo" | "proj_q1_hi" | "proj_q2" | "proj_q2_lo" | "proj_q2_hi" | "proj_q4" | "proj_q4_lo" | "proj_q4_hi">) => [{ h: 1, mid: r.proj_q1, lo: r.proj_q1_lo, hi: r.proj_q1_hi }, { h: 2, mid: r.proj_q2, lo: r.proj_q2_lo, hi: r.proj_q2_hi }, { h: 4, mid: r.proj_q4, lo: r.proj_q4_lo, hi: r.proj_q4_hi }];
function ZBar({ z, label }: { z: number | null | undefined; label: string }) {
  const v = z == null ? null : Math.max(-2, Math.min(2, z));
  return <svg viewBox="0 0 40 6" width="40" height="6" role="img" aria-label={`${label} ${z == null ? "n/a" : z.toFixed(2)}`}><rect width="40" height="6" fill="var(--rule)" /><line x1="20" x2="20" y1="0" y2="6" stroke="var(--compare-muted)" />{v !== null && <rect x={v < 0 ? 20 + v * 10 : 20} width={Math.abs(v) * 10} height="6" fill={v > 0 ? "var(--signal)" : "var(--compare-muted)"} />}<title>{`${label}: ${z == null ? "n/a" : `z ${z.toFixed(2)}`}`}</title></svg>;
}
function StageTag({ stage }: { stage: string | null }) { return <StageBadge stage={stage} />; }

export function ForecastPanel() {
  const { sector = "all" } = useSearch({ from: "/" }); const navigate = useNavigate({ from: "/" });
  const { data } = useSuspenseQuery(forecastQuery());
  const [open, setOpen] = useState<{ dimension: string; value: string } | null>(null);
  const {trait}=useSearch({from:"/"});
  useEffect(()=>{if(trait){const [dimension,...parts]=trait.split(':');if(dimension&&parts.length)setOpen({dimension,value:parts.join(':')});}},[trait]);
  const [week, setWeek] = useState<string | null>(null);
  const card = data.card;
  const all = data.rows.filter(r => r.scope === "all"), scoped = data.rows.filter(r => r.scope === sector);
  const byTrait = new Map(scoped.map(r => [key(r), r]));
  const wave = [...all].filter(r => r.next_wave_score !== null).sort((a, b) => (b.next_wave_score ?? 0) - (a.next_wave_score ?? 0)).map(a => ({ a, s: byTrait.get(key(a)) ?? a })).filter(x => sector === "all" || byTrait.has(key(x.a))).slice(0, 15);
  const lagRows = all.filter(r => r.sectors && Object.values(r.sectors).some(Boolean)).sort((a, b) => Object.values(b.sectors!).filter(Boolean).length - Object.values(a.sectors!).filter(Boolean).length).slice(0, 20);
  const setters = data.setters.filter(s => sector === "all" || s.sector === sector).slice(0, 20);
  const brief = data.briefs.find(b => b.week === week) ?? data.briefs[0];
  const { data: discourseSince } = useQuery(discourseSinceQuery());
  const coverage = coverageSentences(card, { discourseSince });
  return <div className="library min-h-0 flex-1 md:overflow-y-auto">
    <section aria-label="Model card" className="border-b border-rule bg-void">
      <h2 className="label flex items-center border-b border-rule bg-g900 px-3 py-2 font-semibold">MODEL CARD<Info g="p-model-card" /></h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {([["DATA THROUGH", card?.data_through ?? "No forecast yet", "quarter"], ["MEDIAN MAE", card?.median_mae_pts == null ? `Not scored yet (${card?.n_backtested ?? 0} backtested)` : `${card.median_mae_pts.toFixed(1)} PTS`, "p-model-card"], ["HIT-RATE", card?.hit_rate == null ? "Not scored yet" : pct(card.hit_rate, 0), "p-model-card"], ["FITTED / TRAITS", `${card?.n_forecast_ok ?? 0} / ${card?.n_traits ?? 0}`, "projection"], ["USABLE QUARTERS", card?.usable_quarters_all.length ? card.usable_quarters_all.join(" ") : "None yet (need 15+ sites and 25% coverage)", "coverage"]] as const).map(([l, v, g]) =>
        <div key={l} className="min-w-0 border-r border-rule p-2"><div className="label flex items-center text-compare-muted">{l}<Info g={g} /></div><div className="label break-words font-semibold">{v}</div></div>)}
      </div>
      {coverage.length > 0 && <ul className="border-t border-rule p-3 text-compare-muted">{coverage.map(c => <li key={c}>{c}</li>)}</ul>}
    </section>
    {!card && <p className="p-3 text-compare-muted">No forecast has run yet. Forecasts run every Sunday after the crawl; the first one fills this panel.</p>}
    {card && card.n_forecast_ok === 0 && <p className="border-b border-rule p-3 text-compare-muted">Curves aren't fitted yet: each trait needs at least 4 usable quarters (15+ sites and 25% coverage) from the archive backfill. Until then, rankings use trendsetter gap, vanguard and corroboration.</p>}
    <div className="flex flex-wrap gap-1 border-b border-rule p-3" aria-label="Forecast sector filter">{["all", ...SECTORS].map(s => <Button key={s} variant="ghost" className={`label h-8 ${sector === s ? "text-signal" : "text-compare-muted"}`} aria-pressed={sector === s} onClick={() => navigate({ search: prev => ({ ...prev, sector: s }) })}>{s}</Button>)}</div>

    <LibraryBand g="p-next-wave" title={`NEXT WAVE · TOP 15 · ${sector === "all" ? "ALL SECTORS" : sector}`}>
      <ul className="divide-y divide-rule md:hidden">{wave.map(({ a, s }) => <li key={key(a)} className="space-y-1 p-2">
        <div className="flex items-baseline justify-between gap-2"><Button variant="link" className="label h-auto whitespace-normal p-0 text-left text-ink" onClick={() => setOpen(a)}><TraitName {...a} /></Button><span className="label tabular-nums">{a.next_wave_score?.toFixed(2)}</span></div>
        <div className="label flex flex-wrap gap-x-3 text-compare-muted"><StageTag stage={s.stage} /><span>SHARE {pct(s.current_share)}</span><span>+4Q {s.proj_q4 == null ? NO_PROJ : `${pct(s.proj_q4)} (${pct(s.proj_q4_lo, 0)}–${pct(s.proj_q4_hi, 0)})`}</span><span>MOM {s.momentum == null ? "not measured" : s.momentum.toFixed(2)}</span></div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{COMPONENTS.map(([k, l]) => <span key={k} className="label inline-flex items-center gap-1 text-compare-muted">{l.split(" ")[0]}<ZBar z={a.components?.z?.[k]} label={l} /></span>)}<Cone quarters={s.quarters ?? []} proj={projOf(s)} /></div>
      </li>)}</ul>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1040px] text-left">
        <thead className="label text-compare-muted"><tr className="border-b border-rule">{[{ h: "TRAIT", g: "trait" }, { h: "STAGE", g: "stage" }, { h: "SHARE", g: "share" }, { h: "+4Q (LO–HI)", g: "projection" }, { h: "MOM PTS/Q", g: "momentum" }, ...COMPONENTS.map(c => ({ h: c[1], g: COMPONENT_G[c[0]]! })), { h: "SCORE", g: "next-wave-score" }, { h: "SERIES", g: "series" }].map(({ h, g }) => <th key={h} scope="col" className="p-2 font-normal"><span className="inline-flex items-center">{h}<Info g={g} /></span></th>)}</tr></thead>
        <tbody>{wave.map(({ a, s }) => <tr key={key(a)} className="border-b border-rule align-middle">
          <td className="p-2"><Button variant="link" className="label h-auto whitespace-normal p-0 text-left text-ink" onClick={() => setOpen(a)}><TraitName {...a} /></Button></td>
          <td className="p-2"><StageTag stage={s.stage} /></td>
          <td className="label p-2 tabular-nums">{pct(s.current_share)}</td>
          <td className="label p-2 tabular-nums">{s.proj_q4 == null ? NO_PROJ : `${pct(s.proj_q4)} (${pct(s.proj_q4_lo, 0)}–${pct(s.proj_q4_hi, 0)})`}</td>
          <td className="label p-2 tabular-nums">{s.momentum == null ? "not measured" : `${s.momentum > 0 ? "+" : ""}${s.momentum.toFixed(2)}`}</td>
          {COMPONENTS.map(([k, l]) => <td key={k} className="p-2"><ZBar z={a.components?.z?.[k]} label={l} /></td>)}
          <td className="label p-2 tabular-nums">{a.next_wave_score?.toFixed(2)}</td>
          <td className="p-2"><Cone quarters={s.quarters ?? []} proj={projOf(s)} /></td>
        </tr>)}</tbody>
      </table></div>
      {!wave.length && <p className="p-3 text-compare-muted">No traits are scored for this sector yet. Scores need at least one measured part (gap, vanguard or corroboration); they appear after the next Sunday forecast.</p>}
    </LibraryBand>

    <LibraryBand g="p-stage-board" title={`STAGE BOARD · ${sector === "all" ? "ALL SECTORS" : sector}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">{STAGES.map(st => { const chips = scoped.filter(r => stageName(r.stage) === st).sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0)); return <div key={st} className="min-w-0 border-b border-r border-rule p-3"><h3 className="mb-2 flex items-center gap-2"><StageBadge stage={st} /><Info g={stageId(st)} /><span className="label text-compare-muted">{chips.length}</span></h3><div className="flex flex-wrap gap-1">{chips.map(r => <Button key={key(r)} variant="outline" className="label h-auto whitespace-normal px-2 py-1 text-left" onClick={() => setOpen(r)}><TraitName {...r} /></Button>)}{!chips.length && <span className="text-compare-muted">No trait is {st} in this scope yet; stages need at least 4 usable quarters of history.</span>}</div></div>; })}</div>
    </LibraryBand>

    <div className="grid grid-cols-1 xl:grid-cols-2">
      <LibraryBand g="p-trendsetters" title={`TRENDSETTERS · TOP 20 · ${sector === "all" ? "ALL SECTORS" : sector}`}>
        <ol className="divide-y divide-rule">{setters.map((s, i) => <li key={s.domain} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-2">
          <span className="label w-6 text-compare-muted tabular-nums">{i + 1}</span>
          <Link to="/library/$domain" params={{ domain: s.domain ?? "" }} className="font-semibold text-ink underline-offset-2 hover:underline">{s.domain}</Link>
          <span className="label tabular-nums">{(s.score ?? 0).toFixed(2)}</span>
          <span className="label min-w-0 flex-1 break-words text-compare-muted">{s.traits_led.slice(0, 4).map(t => `${label(t.trait).name} +${t.lead}Q`).join(" · ")}</span>
        </li>)}</ol>
        {!setters.length && <p className="p-3 text-compare-muted">No trendsetter in this sector yet. A site counts once it adopted a trait before that trait crossed 20% share; check all sectors or wait for more archive quarters.</p>}
      </LibraryBand>
      <LibraryBand g="p-lead-lag" title="LEAD–LAG · FIRST QUARTER ≥10% BY SECTOR">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
          <thead className="label text-compare-muted"><tr className="border-b border-rule"><th scope="col" className="p-2 font-normal"><span className="inline-flex items-center">TRAIT<Info g="trait" /></span></th>{SECTORS.map((s, i) => <th key={s} scope="col" className={`p-1 font-normal ${sector === s ? "text-ink underline" : ""}`}><span className="inline-flex items-center">{s.slice(0, 8)}{i === 0 && <Info g="first-quarter" />}</span></th>)}</tr></thead>
          <tbody>{lagRows.map(r => { const qs = Object.values(r.sectors!).filter((q): q is string => !!q).sort(); return <tr key={key(r)} className="border-b border-rule"><th scope="row" className="label p-2 text-left font-normal"><Button variant="link" className="label h-auto p-0 text-left text-ink" onClick={() => setOpen(r)}><TraitName {...r} /></Button></th>{SECTORS.map(s => { const q = r.sectors![s]; return <td key={s} className={`label p-1 tabular-nums ${q && q === qs[0] ? "text-signal" : "text-compare-muted"}`}>{q ? q.slice(2) : "·"}</td>; })}</tr>; })}</tbody>
        </table></div>
        {!lagRows.length && <p className="p-3 text-compare-muted">No sector has crossed 10% share on a tracked trait yet; rows appear as archive quarters fill in.</p>}
      </LibraryBand>
    </div>

    <LibraryBand g="p-chart-of-week" title={`CHART OF THE WEEK${brief?.week ? ` · ${brief.week}` : ""}`}><Suspense fallback={<p className="p-3">▍</p>}><ChartBand week={brief?.week ?? null} /></Suspense></LibraryBand>
    <LibraryBand g="p-brief" title={`BRIEF${brief?.week ? ` · ${brief.week}` : ""} · AI VIA ${brief?.brief.provider === "google" ? "GOOGLE AI STUDIO" : "LOVABLE AI"}`}>
      {brief ? <BriefView brief={brief.brief} onTrait={(id) => { const [dimension, ...rest] = id.replace(/:all$/, "").split(":"); setOpen({ dimension: dimension ?? "", value: rest.join(":") }); }} /> : <p className="p-3 text-compare-muted">No brief yet: the first one is written after the next Sunday forecast.</p>}
      {data.briefs.length > 1 && <div className="flex flex-wrap gap-1 border-t border-rule p-3" aria-label="Brief archive"><span className="label text-compare-muted">ARCHIVE</span>{data.briefs.map(b => <Button key={b.week} variant="ghost" className={`label h-8 ${b.week === brief?.week ? "text-signal" : ""}`} aria-pressed={b.week === brief?.week} onClick={() => setWeek(b.week)}>{b.week}</Button>)}</div>}
    </LibraryBand>
    {open && <TraitDrawer {...open} onClose={() => setOpen(null)} />}
  </div>;
}

function ChartBand({ week }: { week: string | null }) { const { data } = useSuspenseQuery(chartCardQuery(week)); return <ChartOfWeek card={data} />; }
function BriefView({ brief, onTrait }: { brief: BriefDoc; onTrait: (id: string) => void }) {
  const shown = briefDisplay(brief);
  return <article className="p-3">
    <h3 className="text-hero font-semibold"><span className="label mr-2 text-signal">AI</span>{shown.headline}</h3>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.sections.map(s => <section key={s.title} className="min-w-0 border border-rule p-3">
      <h4 className="label font-semibold">{s.title.toUpperCase()}</h4><p className="mt-1">{s.body}</p>
      <div className="mt-2 flex flex-wrap gap-1">{s.citations.map(c => { const ref = brief.refs?.[`${c.kind}:${c.id}`]; const text = c.text; const cls = "label inline-flex h-6 items-center border border-rule px-2 text-compare-muted hover:text-ink";
        if (c.kind === "forecast") return <button key={c.kind + c.id} type="button" className={cls} onClick={() => onTrait(c.id)}>{text}</button>;
        if (c.kind === "event" && ref?.domain) return <Link key={c.kind + c.id} to="/library/$domain" params={{ domain: ref.domain }} className={cls}>{text}</Link>;
        if (c.kind === "wire" && ref?.url) return <a key={c.kind + c.id} href={ref.url} target="_blank" rel="noreferrer" className={cls}>{text}</a>;
        if (c.kind === "spread") return <Link key={c.kind + c.id} to="/" search={{ panel: "overview" }} className={cls}>{text}</Link>;
        return <span key={c.kind + c.id} className={cls}>{text}</span>; })}</div>
    </section>)}</div>
    <p className="label mt-3 text-compare-muted">CAVEATS · {shown.caveats}</p>
  </article>;
}

type DetailRow = { scope: string; status: string; model: string | null; evidence: unknown; backtest: unknown; components?: unknown } & Parameters<typeof projOf>[0];
function TraitDrawer({ dimension, value, onClose }: { dimension: string; value: string; onClose: () => void }) {
  const { data, isLoading } = useQuery(forecastDetailQuery(dimension, value));
  const rows = (data ?? []) as DetailRow[]; const main = rows.find(r => r.scope === "all");
  const ev = (main?.evidence ?? {}) as { quarters?: Pt[]; fitted?: { quarter: string; value: number }[]; sites?: { domain: string; lead: number; adopted: string }[]; usable?: number; crossed_20?: string | null };
  const comp = (main?.components ?? {}) as DrawerComponents;
  const bt = (main?.backtest ?? {}) as { status?: string; mae_pts?: number; hit_rate?: number; predictions?: { quarter: string; predicted: number; actual: number }[] };
  const sectors = rows.filter(r => r.scope !== "all").map(r => ({ scope: r.scope, pts: ((r.evidence as { quarters?: Pt[] })?.quarters ?? []) }));
  const tl = label(`${dimension}:${value}`);
  return <Overlay title={`${tl.name} [${tl.dimension}]`} onClose={onClose}>
    {isLoading || !main ? <p className="label">▍</p> : <div className="space-y-3">
      <p className="label text-compare-muted">{main.status === "ok" ? `MODEL ${main.model?.toUpperCase()} · ${ev.usable} USABLE QUARTERS` : `Not fitted yet: ${ev.usable ?? 0} of the 4 usable quarters a curve needs`}{ev.crossed_20 ? ` · CROSSED 20% ${ev.crossed_20}` : ""}</p>
      <Cone large quarters={ev.quarters ?? []} proj={projOf(main)} fitted={ev.fitted} backtest={bt.predictions} sectors={sectors} />
      <p className="label text-compare-muted">SOLID = MEASURED · DASHED = FIT · CONE = 80% BOOTSTRAP · DOTTED = 2025Q2 BACKTEST · GREY LINES = SECTORS · FAINT POINTS = UNUSABLE QUARTERS (N&lt;15 OR COVERAGE&lt;25%)</p>
      <p className="label">BACKTEST {bt.status === "ok" ? `MAE ${bt.mae_pts?.toFixed(1)} PTS · HIT ${pct(bt.hit_rate, 0)}` : "· not enough history before 2025Q2 to test this trait"}</p>
      <Components comp={comp} />
      <div><h3 className="label flex items-center text-compare-muted">LED BY<Info g="p-led-by" /></h3><ul className="flex flex-wrap gap-x-3">{(ev.sites ?? []).map(s => <li key={s.domain}><Link to="/library/$domain" params={{ domain: s.domain }} className="underline-offset-2 hover:underline">{s.domain}</Link> <span className="label text-compare-muted">{s.adopted} · +{s.lead}Q</span></li>)}{!ev.sites?.length && <li className="text-compare-muted">No early adopters identified yet; this needs the trait to cross 20% share somewhere.</li>}</ul></div>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="label text-compare-muted"><tr>{[{ h: "QUARTER", g: "quarter" }, { h: "SHARE", g: "share" }, { h: "N", g: "sample-n" }, { h: "COVERAGE", g: "coverage" }].map(({ h, g }) => <th key={h} scope="col" className="p-1 font-normal"><span className="inline-flex items-center">{h}<Info g={g} /></span></th>)}</tr></thead><tbody>{(ev.quarters ?? []).filter(p => p.n > 0).map(p => <tr key={p.q} className={`label tabular-nums ${p.n < 15 || p.c < .25 ? "text-compare-muted" : ""}`}><td className="p-1">{p.q}</td><td className="p-1">{pct(p.s)}</td><td className="p-1">{p.n}</td><td className="p-1">{(p.c * 100).toFixed(0)}%</td></tr>)}</tbody></table></div>
    </div>}
  </Overlay>;
}

type DrawerComponents = { raw?: Record<string, number | null>; present?: string[]; why?: string[];
  curation?: { lead_pts: number | null; prev_lead_pts?: number | null; n?: Record<string, number>; hits?: Record<string, number>; gallery_mix?: Record<string, number>; reason?: string };
  discourse?: { z: number | null; rate_per_10k?: number | null; n_week?: number; n_9w?: number; baseline_weeks?: number; fatigue_ratio?: number | null; fatigue_flag?: boolean; spike?: boolean; terms?: string[]; reason?: string };
  supply?: { value: number | null; category?: string; gf_additions?: { last90: number; prior90: number | null; note: string | null } | null; ph_sites?: number | null; ph_note?: string | null; reason?: string } };
const num = (v: number | null | undefined, d = 1) => (v == null ? "none" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);
function Components({ comp }: { comp: DrawerComponents }) {
  const present = new Set(comp.present ?? []), c = comp.curation, d = comp.discourse, s = comp.supply;
  return <div className="space-y-2">
    <h3 className="label flex items-center text-compare-muted">SCORE PARTS · {present.size} OF {COMPONENTS.length} MEASURED · MISSING PARTS COUNT AS AVERAGE<Info g="p-components" /></h3>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">{COMPONENTS.map(([k, l]) => <div key={k} className="min-w-0"><dt className={`label ${present.has(k) ? "text-ink" : "text-compare-muted"}`}>{l}</dt><dd className="label tabular-nums">{present.has(k) ? num(comp.raw?.[k], 2) : "not measured"}</dd></div>)}</dl>
    <p className="label break-words text-compare-muted">CURATION {c?.n ? `${c.lead_pts != null ? `${num(c.lead_pts)} PTS` : "LEAD —"} (PREV ${num(c.prev_lead_pts)}) · N ${["mainstream", "vanguard", "curated"].map(i => `${i[0]!.toUpperCase()} ${c.hits?.[i] ?? 0}/${c.n?.[i] ?? 0}`).join(" · ")}${c.gallery_mix && Object.keys(c.gallery_mix).length ? ` · GALLERIES ${Object.entries(c.gallery_mix).map(([g, n]) => `${g} ${n}`).join(", ")}` : ""}${c.lead_pts == null ? " · NEEDS ≥10 CURATED SITES" : ""}` : c?.reason ?? "not measured for this trait"}</p>
    <p className="label break-words text-compare-muted">DISCOURSE {d && d.z !== undefined && !d.reason ? `Z ${num(d.z, 2)} · ${d.rate_per_10k ?? "—"}/10K POSTS · ${d.n_week ?? 0} THIS WEEK · ${d.n_9w ?? 0} IN 9 WK · BASELINE ${d.baseline_weeks ?? 0} WK · FATIGUE ${d.fatigue_ratio == null ? "—" : `${(d.fatigue_ratio * 100).toFixed(0)}%`}${d.fatigue_flag ? " · FLAG" : ""}${d.spike ? " · SPIKE" : ""}${d.terms?.length ? ` · TERMS ${d.terms.join(", ")}` : ""}` : d?.reason ?? "not measured for this trait"}</p>
    <p className="label break-words text-compare-muted">SUPPLY {s?.category ? `${s.category.toUpperCase()} · ${s.value == null ? "NOT MEASURABLE YET" : num(s.value, 0)} · GF NEW 90D ${s.gf_additions?.last90 ?? "—"} VS PRIOR ${s.gf_additions?.prior90 ?? "—"}${s.gf_additions?.note ? ` (${s.gf_additions.note})` : ""} · PH SITES ${s.ph_sites ?? "—"}${s.ph_note ? ` (${s.ph_note})` : ""}` : s?.reason ?? "not measured for this trait"}</p>
    {comp.why?.length ? <ul className="label space-y-1">{comp.why.map(w => <li key={w} className="text-ink">· {w}</li>)}</ul> : null}
  </div>;
}
