import { useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { forecastQuery, forecastDetailQuery, type ForecastRow, type BriefDoc } from "@/lib/data";
import { SECTORS } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { LibraryBand } from "./LibraryShared";
import { Overlay } from "./primitives";

const AI_DIMS = new Set(["imagery", "aesthetic", "components", "hero_layout", "ai_positioning", "tone", "color_mood"]);
const STAGES = ["emerging", "accelerating", "peaking", "declining"] as const;
const COMPONENTS = [["gap", "TRENDSETTER GAP"], ["vanguard", "VANGUARD"], ["momentum", "MOMENTUM"], ["corroboration", "CORROBORATION"]] as const;
const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const qi = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
const ql = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
export const traitLabel = (dimension: string, value: string) => `${AI_DIMS.has(dimension) ? "AI · " : ""}${dimension.replace(/_/g, " ")}: ${value.replace(/_/g, " ")}`.toUpperCase();
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
function StageTag({ stage }: { stage: string | null }) { return <span className={`label ${stage === "accelerating" || stage === "emerging" ? "text-signal" : "text-compare-muted"}`}>{stage ? stage.toUpperCase() : "INSUFF. DATA"}</span>; }

export function ForecastPanel() {
  const { sector = "all" } = useSearch({ from: "/" }); const navigate = useNavigate({ from: "/" });
  const { data } = useSuspenseQuery(forecastQuery());
  const [open, setOpen] = useState<{ dimension: string; value: string } | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const card = data.card;
  const all = data.rows.filter(r => r.scope === "all"), scoped = data.rows.filter(r => r.scope === sector);
  const byTrait = new Map(scoped.map(r => [key(r), r]));
  const wave = [...all].filter(r => r.next_wave_score !== null).sort((a, b) => (b.next_wave_score ?? 0) - (a.next_wave_score ?? 0)).map(a => ({ a, s: byTrait.get(key(a)) ?? a })).filter(x => sector === "all" || byTrait.has(key(x.a))).slice(0, 15);
  const lagRows = all.filter(r => r.sectors && Object.values(r.sectors).some(Boolean)).sort((a, b) => Object.values(b.sectors!).filter(Boolean).length - Object.values(a.sectors!).filter(Boolean).length).slice(0, 20);
  const setters = data.setters.filter(s => sector === "all" || s.sector === sector).slice(0, 20);
  const brief = data.briefs.find(b => b.week === week) ?? data.briefs[0];
  return <div className="library min-h-0 flex-1 md:overflow-y-auto">
    <section aria-label="Model card" className="sticky top-0 z-10 grid grid-cols-2 border-b border-rule bg-void sm:grid-cols-5">
      {[["DATA THROUGH", card?.data_through ?? "—"], ["MEDIAN MAE", card?.median_mae_pts == null ? `— (${card?.n_backtested ?? 0} BACKTESTED)` : `${card.median_mae_pts.toFixed(1)} PTS`], ["HIT-RATE", card?.hit_rate == null ? "—" : pct(card.hit_rate, 0)], ["FITTED / TRAITS", `${card?.n_forecast_ok ?? 0} / ${card?.n_traits ?? 0}`], ["USABLE QUARTERS", card?.usable_quarters_all.length ? card.usable_quarters_all.join(" ") : "—"]].map(([l, v]) =>
        <div key={l} className="min-w-0 border-r border-rule p-2"><div className="label text-compare-muted">{l}</div><div className="label break-words font-semibold">{v}</div></div>)}
    </section>
    {!card && <p className="p-3 text-compare-muted">FIRST FORECAST RUN PENDING</p>}
    {card && card.n_forecast_ok === 0 && <p className="label border-b border-rule p-3 text-compare-muted">ARCHIVE BACKFILL FILLING · CURVES NEED ≥4 USABLE QUARTERS (N≥15, COVERAGE≥25%) · RANKINGS USE TRENDSETTER GAP, VANGUARD AND CORROBORATION UNTIL THEN</p>}
    <div className="flex flex-wrap gap-1 border-b border-rule p-3" aria-label="Forecast sector filter">{["all", ...SECTORS].map(s => <Button key={s} variant="ghost" className={`label h-8 ${sector === s ? "text-signal" : "text-compare-muted"}`} aria-pressed={sector === s} onClick={() => navigate({ search: prev => ({ ...prev, sector: s }) })}>{s}</Button>)}</div>

    <LibraryBand title={`NEXT WAVE · TOP 15 · ${sector}`}>
      <ul className="divide-y divide-rule md:hidden">{wave.map(({ a, s }) => <li key={key(a)} className="space-y-1 p-2">
        <div className="flex items-baseline justify-between gap-2"><Button variant="link" className="label h-auto whitespace-normal p-0 text-left text-ink" onClick={() => setOpen(a)}>{traitLabel(a.dimension, a.value)}</Button><span className="label tabular-nums">{a.next_wave_score?.toFixed(2)}</span></div>
        <div className="label flex flex-wrap gap-x-3 text-compare-muted"><StageTag stage={s.stage} /><span>SHARE {pct(s.current_share)}</span><span>+4Q {s.proj_q4 == null ? "—" : `${pct(s.proj_q4)} (${pct(s.proj_q4_lo, 0)}–${pct(s.proj_q4_hi, 0)})`}</span><span>MOM {s.momentum == null ? "—" : s.momentum.toFixed(2)}</span></div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{COMPONENTS.map(([k, l]) => <span key={k} className="label inline-flex items-center gap-1 text-compare-muted">{l.split(" ")[0]}<ZBar z={a.components?.z?.[k]} label={l} /></span>)}<Cone quarters={s.quarters ?? []} proj={projOf(s)} /></div>
      </li>)}</ul>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left">
        <thead className="label text-compare-muted"><tr className="border-b border-rule">{["TRAIT", "STAGE", "SHARE", "+4Q (LO–HI)", "MOM PTS/Q", ...COMPONENTS.map(c => c[1]), "SCORE", "SERIES"].map(h => <th key={h} scope="col" className="p-2 font-normal">{h}</th>)}</tr></thead>
        <tbody>{wave.map(({ a, s }) => <tr key={key(a)} className="border-b border-rule align-middle">
          <td className="p-2"><Button variant="link" className="label h-auto p-0 text-left text-ink" onClick={() => setOpen(a)}>{traitLabel(a.dimension, a.value)}</Button></td>
          <td className="p-2"><StageTag stage={s.stage} /></td>
          <td className="label p-2 tabular-nums">{pct(s.current_share)}</td>
          <td className="label p-2 tabular-nums">{s.proj_q4 == null ? "—" : `${pct(s.proj_q4)} (${pct(s.proj_q4_lo, 0)}–${pct(s.proj_q4_hi, 0)})`}</td>
          <td className="label p-2 tabular-nums">{s.momentum == null ? "—" : `${s.momentum > 0 ? "+" : ""}${s.momentum.toFixed(2)}`}</td>
          {COMPONENTS.map(([k, l]) => <td key={k} className="p-2"><ZBar z={a.components?.z?.[k]} label={l} /></td>)}
          <td className="label p-2 tabular-nums">{a.next_wave_score?.toFixed(2)}</td>
          <td className="p-2"><Cone quarters={s.quarters ?? []} proj={projOf(s)} /></td>
        </tr>)}</tbody>
      </table></div>
      {!wave.length && <p className="p-3 text-compare-muted">NO SCORED TRAITS</p>}
    </LibraryBand>

    <LibraryBand title={`STAGE BOARD · ${sector}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">{STAGES.map(st => { const chips = scoped.filter(r => r.stage === st).sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0)); return <div key={st} className="min-w-0 border-b border-r border-rule p-3"><h3 className="label mb-2 text-compare-muted">{st.toUpperCase()} · {chips.length}</h3><div className="flex flex-wrap gap-1">{chips.map(r => <Button key={key(r)} variant="outline" className="label h-auto whitespace-normal px-2 py-1 text-left" onClick={() => setOpen(r)}>{traitLabel(r.dimension, r.value)}</Button>)}{!chips.length && <span className="label text-compare-muted">— NEEDS ≥4 USABLE QUARTERS</span>}</div></div>; })}</div>
    </LibraryBand>

    <div className="grid grid-cols-1 xl:grid-cols-2">
      <LibraryBand title={`TRENDSETTERS · TOP 20 · ${sector}`}>
        <ol className="divide-y divide-rule">{setters.map((s, i) => <li key={s.domain} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-2">
          <span className="label w-6 text-compare-muted tabular-nums">{i + 1}</span>
          <Link to="/library/$domain" params={{ domain: s.domain ?? "" }} className="font-semibold text-ink underline-offset-2 hover:underline">{s.domain}</Link>
          <span className="label tabular-nums">{(s.score ?? 0).toFixed(2)}</span>
          <span className="label min-w-0 flex-1 break-words text-compare-muted">{s.traits_led.slice(0, 4).map(t => `${traitLabel(t.trait.split(":")[0] ?? "", t.trait.split(":").slice(1).join(":"))} +${t.lead}Q`).join(" · ")}</span>
        </li>)}</ol>
        {!setters.length && <p className="p-3 text-compare-muted">NO TRENDSETTERS IN SCOPE</p>}
      </LibraryBand>
      <LibraryBand title="LEAD–LAG · FIRST QUARTER ≥10% BY SECTOR">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
          <thead className="label text-compare-muted"><tr className="border-b border-rule"><th scope="col" className="p-2 font-normal">TRAIT</th>{SECTORS.map(s => <th key={s} scope="col" className={`p-1 font-normal ${sector === s ? "text-signal" : ""}`}>{s.slice(0, 8)}</th>)}</tr></thead>
          <tbody>{lagRows.map(r => { const qs = Object.values(r.sectors!).filter((q): q is string => !!q).sort(); return <tr key={key(r)} className="border-b border-rule"><th scope="row" className="label p-2 text-left font-normal"><Button variant="link" className="label h-auto p-0 text-left text-ink" onClick={() => setOpen(r)}>{traitLabel(r.dimension, r.value)}</Button></th>{SECTORS.map(s => { const q = r.sectors![s]; return <td key={s} className={`label p-1 tabular-nums ${q && q === qs[0] ? "text-signal" : "text-compare-muted"}`}>{q ? q.slice(2) : "·"}</td>; })}</tr>; })}</tbody>
        </table></div>
        {!lagRows.length && <p className="p-3 text-compare-muted">NO SECTOR CROSSINGS YET</p>}
      </LibraryBand>
    </div>

    <LibraryBand title={`BRIEF · ${brief?.week ?? "—"} · AI`}>
      {brief ? <BriefView brief={brief.brief} onTrait={(id) => { const [dimension, ...rest] = id.replace(/:all$/, "").split(":"); setOpen({ dimension: dimension ?? "", value: rest.join(":") }); }} /> : <p className="p-3 text-compare-muted">FIRST BRIEF PUBLISHES AFTER THE FIRST FORECAST RUN</p>}
      {data.briefs.length > 1 && <div className="flex flex-wrap gap-1 border-t border-rule p-3" aria-label="Brief archive"><span className="label text-compare-muted">ARCHIVE</span>{data.briefs.map(b => <Button key={b.week} variant="ghost" className={`label h-8 ${b.week === brief?.week ? "text-signal" : ""}`} aria-pressed={b.week === brief?.week} onClick={() => setWeek(b.week)}>{b.week}</Button>)}</div>}
    </LibraryBand>
    {open && <TraitDrawer {...open} onClose={() => setOpen(null)} />}
  </div>;
}

function BriefView({ brief, onTrait }: { brief: BriefDoc; onTrait: (id: string) => void }) {
  return <article className="p-3">
    <h3 className="text-hero font-semibold"><span className="label mr-2 text-signal">AI</span>{brief.headline}</h3>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{brief.sections.map(s => <section key={s.title} className="min-w-0 border border-rule p-3">
      <h4 className="label font-semibold">{s.title.toUpperCase()}</h4><p className="mt-1">{s.body}</p>
      <div className="mt-2 flex flex-wrap gap-1">{s.citations.map(c => { const ref = brief.refs?.[`${c.kind}:${c.id}`]; const text = `${c.kind.toUpperCase()} · ${ref?.label ?? c.id}`; const cls = "label inline-flex h-6 items-center border border-rule px-2 text-compare-muted hover:text-ink";
        if (c.kind === "forecast") return <button key={c.kind + c.id} type="button" className={cls} onClick={() => onTrait(c.id)}>{text}</button>;
        if (c.kind === "event" && ref?.domain) return <Link key={c.kind + c.id} to="/library/$domain" params={{ domain: ref.domain }} className={cls}>{text}</Link>;
        if (c.kind === "wire" && ref?.url) return <a key={c.kind + c.id} href={ref.url} target="_blank" rel="noreferrer" className={cls}>{text}</a>;
        if (c.kind === "spread") return <Link key={c.kind + c.id} to="/" search={{ panel: "overview" }} className={cls}>{text}</Link>;
        return <span key={c.kind + c.id} className={cls}>{text}</span>; })}</div>
    </section>)}</div>
    <p className="label mt-3 text-compare-muted">CAVEATS · {brief.caveats}</p>
  </article>;
}

type DetailRow = { scope: string; status: string; model: string | null; evidence: unknown; backtest: unknown } & Parameters<typeof projOf>[0];
function TraitDrawer({ dimension, value, onClose }: { dimension: string; value: string; onClose: () => void }) {
  const { data, isLoading } = useQuery(forecastDetailQuery(dimension, value));
  const rows = (data ?? []) as DetailRow[]; const main = rows.find(r => r.scope === "all");
  const ev = (main?.evidence ?? {}) as { quarters?: Pt[]; fitted?: { quarter: string; value: number }[]; sites?: { domain: string; lead: number; adopted: string }[]; usable?: number; crossed_20?: string | null };
  const bt = (main?.backtest ?? {}) as { status?: string; mae_pts?: number; hit_rate?: number; predictions?: { quarter: string; predicted: number; actual: number }[] };
  const sectors = rows.filter(r => r.scope !== "all").map(r => ({ scope: r.scope, pts: ((r.evidence as { quarters?: Pt[] })?.quarters ?? []) }));
  return <Overlay title={traitLabel(dimension, value)} onClose={onClose}>
    {isLoading || !main ? <p className="label">▍</p> : <div className="space-y-3">
      <p className="label text-compare-muted">{main.status === "ok" ? `MODEL ${main.model?.toUpperCase()} · ${ev.usable} USABLE QUARTERS` : `INSUFFICIENT DATA · ${ev.usable ?? 0} USABLE QUARTERS (NEED 4)`}{ev.crossed_20 ? ` · CROSSED 20% ${ev.crossed_20}` : ""}</p>
      <Cone large quarters={ev.quarters ?? []} proj={projOf(main)} fitted={ev.fitted} backtest={bt.predictions} sectors={sectors} />
      <p className="label text-compare-muted">SOLID = MEASURED · DASHED = FIT · CONE = 80% BOOTSTRAP · DOTTED = 2025Q2 BACKTEST · GREY LINES = SECTORS · FAINT POINTS = UNUSABLE QUARTERS (N&lt;15 OR COVERAGE&lt;25%)</p>
      <p className="label">BACKTEST {bt.status === "ok" ? `MAE ${bt.mae_pts?.toFixed(1)} PTS · HIT ${pct(bt.hit_rate, 0)}` : "INSUFFICIENT DATA BEFORE 2025Q2"}</p>
      <div><h3 className="label text-compare-muted">LED BY</h3><ul className="flex flex-wrap gap-x-3">{(ev.sites ?? []).map(s => <li key={s.domain}><Link to="/library/$domain" params={{ domain: s.domain }} className="underline-offset-2 hover:underline">{s.domain}</Link> <span className="label text-compare-muted">{s.adopted} · +{s.lead}Q</span></li>)}{!ev.sites?.length && <li className="label text-compare-muted">—</li>}</ul></div>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="label text-compare-muted"><tr>{["QUARTER", "SHARE", "N", "COVERAGE"].map(h => <th key={h} scope="col" className="p-1 font-normal">{h}</th>)}</tr></thead><tbody>{(ev.quarters ?? []).filter(p => p.n > 0).map(p => <tr key={p.q} className={`label tabular-nums ${p.n < 15 || p.c < .25 ? "text-compare-muted" : ""}`}><td className="p-1">{p.q}</td><td className="p-1">{pct(p.s)}</td><td className="p-1">{p.n}</td><td className="p-1">{(p.c * 100).toFixed(0)}%</td></tr>)}</tbody></table></div>
    </div>}
  </Overlay>;
}
