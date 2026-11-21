import { deLegacy, sitePath } from "@/lib/brand";
import { BriefWithdrawn } from "./BriefWithdrawn";
import { line as voiced } from "@/lib/voice";
import { Suspense, useEffect, useState } from "react";
import { AddToWatch } from "./Watch";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { forecastQuery, forecastDetailQuery, chartCardQuery, discourseSinceQuery, ledgerQuery, type ForecastRow, type BriefDoc } from "@/lib/data";
import { briefDisplay, label, stageName, STAGES } from "@/lib/labels";
import { coverageSentences } from "@/lib/model-card-copy";
import { DimTag, Info, StageBadge } from "./Info";
import { stageId } from "@/lib/glossary";
import { ChartOfWeek } from "./ChartCard";
import { SECTORS } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { LibraryBand } from "./LibraryShared";
import { Overlay } from "./primitives";
import { QuarterLine, type QuarterPoint as Pt } from "@/components/chartkit";
import { BasisChip, ConfidenceText, MomentumText, TierChip } from "./SignalBits";
import { signalsQuery } from "@/lib/data";
import { buildSignals, type Signal } from "@/lib/signals";
import { evidenceKeys } from "@/lib/tiers";
import { compositeOf, ruleText } from "@/lib/composites";
import { CsvScope } from "@/components/dataview/CopyCsv";

const COMPONENTS = [["gap", "TRENDSETTER GAP"], ["vanguard", "VANGUARD"], ["curation", "CURATION"], ["momentum", "MOMENTUM"], ["corroboration", "CORROBORATION"], ["discourse", "DISCOURSE"], ["supply", "SUPPLY"]] as const;
const COMPONENT_G: Record<string, string> = { gap: "gap", vanguard: "vanguard", curation: "curation", momentum: "momentum", corroboration: "corroboration", discourse: "discourse", supply: "supply" };
const pct = (v: number | null | undefined, d = 1) => (v == null ? "not measured" : `${(v * 100).toFixed(d)}%`);
const NO_PROJ = <span className="text-compare-muted" title={voiced("terminal.forecast.1")}>not fitted yet</span>;
const qi = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
const ql = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
/** Trait display name from the shared label map; kept as an export for older imports. */
export const traitLabel = (dimension: string, value: string) => label(`${dimension}:${value}`).name;
function TraitName({ dimension, value }: { dimension: string; value: string }) { const l = label(`${dimension}:${value}`); return <><span className="normal-case">{l.name}</span> <DimTag d={l.dimension} /></>; }
/** Secondary link to the editorial explainer; terminal navigation (drawer) is unchanged. */
function Explainer({ dimension, value }: { dimension: string; value: string }) { return <span className="inline-flex items-center"><Link to="/signals/$key" params={{ key: `${dimension}:${value}` }} className="label ml-2 whitespace-nowrap text-compare-muted underline-offset-2 hover:text-ink hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center">EXPLAINER →</Link><AddToWatch target={`${dimension}:${value}`} name={label(`${dimension}:${value}`).name} /></span>; }
const key = (r: { dimension: string; value: string }) => `${r.dimension}:${r.value}`;

const projOf = (r: Pick<ForecastRow, "proj_q1" | "proj_q1_lo" | "proj_q1_hi" | "proj_q2" | "proj_q2_lo" | "proj_q2_hi" | "proj_q4" | "proj_q4_lo" | "proj_q4_hi">) => [{ h: 1, mid: r.proj_q1, lo: r.proj_q1_lo, hi: r.proj_q1_hi }, { h: 2, mid: r.proj_q2, lo: r.proj_q2_lo, hi: r.proj_q2_hi }, { h: 4, mid: r.proj_q4, lo: r.proj_q4_lo, hi: r.proj_q4_hi }];
function ZBar({ z, label }: { z: number | null | undefined; label: string }) {
  const v = z == null ? null : Math.max(-2, Math.min(2, z));
  return <svg viewBox="0 0 40 6" width="40" height="6" role="img" aria-label={`${label} ${z == null ? "n/a" : z.toFixed(2)}`}><rect width="40" height="6" fill="var(--sys-color-rule)" /><line x1="20" x2="20" y1="0" y2="6" stroke="var(--sys-color-ink-muted)" />{v !== null && <rect x={v < 0 ? 20 + v * 10 : 20} width={Math.abs(v) * 10} height="6" fill={v > 0 ? "var(--sys-color-highlight)" : "var(--sys-color-ink-muted)"} />}<title>{`${label}: ${z == null ? "n/a" : `z ${z.toFixed(2)}`}`}</title></svg>;
}
function StageTag({ stage }: { stage: string | null }) { return <StageBadge stage={stage} />; }

export function ForecastPanel() {
  const { sector = "all" } = useSearch({ from: "/terminal" }); const navigate = useNavigate({ from: "/terminal" });
  const { data } = useSuspenseQuery(forecastQuery());
  const [open, setOpen] = useState<{ dimension: string; value: string } | null>(null);
  const {trait}=useSearch({from:"/terminal"});
  useEffect(()=>{if(trait){const [dimension,...parts]=trait.split(':');if(dimension&&parts.length)setOpen({dimension,value:parts.join(':')});}},[trait]);
  const [week, setWeek] = useState<string | null>(null);
  const card = data.card;
  // Default lists obey the tiers (src/lib/tiers.ts): headline signals only; Momentum + Confidence replace the seven-part display (one click away in the drawer).
  const { data: sig } = useSuspenseQuery(signalsQuery());
  const scopeSignals = sig ? new Map(buildSignals(data.rows.map(r => ({ ...r, present: r.components?.present ?? [], sites: r.components?.sites ?? null, usable: r.usable ?? null })), sig.tiers, sector).map(x => [x.key, x])) : null;
  const isHead = (r: { dimension: string; value: string }) => (sig ? sig.tiers.get(key(r))?.tier === "headline" : true);
  const all = data.rows.filter(r => r.scope === "all" && isHead(r)), scoped = data.rows.filter(r => r.scope === sector && isHead(r));
  const byTrait = new Map(scoped.map(r => [key(r), r]));
  const wave = [...all].filter(r => r.next_wave_score !== null).sort((a, b) => (b.next_wave_score ?? 0) - (a.next_wave_score ?? 0)).map(a => ({ a, s: byTrait.get(key(a)) ?? a, x: scopeSignals?.get(key(a)) })).filter(x => sector === "all" || byTrait.has(key(x.a))).slice(0, 15);
  const lagRows = all.filter(r => r.sectors && Object.values(r.sectors).some(Boolean)).sort((a, b) => Object.values(b.sectors!).filter(Boolean).length - Object.values(a.sectors!).filter(Boolean).length).slice(0, 20);
  const setters = data.setters.filter(s => sector === "all" || s.sector === sector).slice(0, 20);
  const brief = data.briefs.find(b => b.week === week) ?? data.briefs[0];
  const { data: discourseSince } = useQuery(discourseSinceQuery());
  const coverage = coverageSentences(card, { discourseSince });
  const { data: ledger } = useQuery(ledgerQuery());
  const ls = ledger?.summary, liveRecord = !ls ? voiced("busy.ledgerRecord") : ls.rate != null ? `${Math.round(ls.rate * 100)}% · N=${ls.resolved}` : ls.resolved ? `${ls.hits} OF ${ls.resolved} LANDED · ${ls.open} OPEN` : `NONE RESOLVED · ${ls.open} OPEN`;
  return <div className="library min-h-0 flex-1 md:overflow-y-auto">
    <section aria-label="Model card" className="border-b border-rule bg-void">
      <h2 className="label flex items-center border-b border-rule bg-g900 px-3 py-2 font-semibold">MODEL CARD<Info g="p-model-card" /></h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {([["DATA THROUGH", card?.data_through ?? voiced("terminal.forecast.3"), "quarter"], ["MEDIAN MAE", card?.median_mae_pts == null ? `Not scored yet (${card?.n_backtested ?? 0} backtested)` : `${card.median_mae_pts.toFixed(1)} PTS`, "p-model-card"], ["BACKTEST HIT-RATE", card?.hit_rate == null ? "Not scored yet" : pct(card.hit_rate, 0), "p-model-card"], ["LIVE RECORD", liveRecord, "ledger"], ["FITTED / TRAITS", `${card?.n_forecast_ok ?? 0} / ${card?.n_traits ?? 0}`, "projection"], ["USABLE QUARTERS", card?.usable_quarters_all.length ? card.usable_quarters_all.join(" ") : voiced("terminal.forecast.4"), "coverage"]] as const).map(([l, v, g]) =>
        <div key={l} className="min-w-0 border-r border-rule p-2"><div className="label flex items-center text-compare-muted">{l}<Info g={g} /></div><div className="label break-words font-semibold">{v}</div></div>)}
      </div>
      {coverage.length > 0 && <ul className="border-t border-rule p-3 text-compare-muted">{coverage.map(c => <li key={c}>{c}</li>)}</ul>}
      {ls && <p className="flex flex-wrap items-center gap-x-3 border-t border-rule px-3 py-2 text-compare-muted"><span>{ls.headline} Backtest above is a history replay, not part of the live record.</span><Link to="/ledger" className="label inline-flex items-center text-ink underline-offset-2 hover:underline max-md:min-h-11">LEDGER →</Link></p>}
    </section>
    {!card && <p className="p-3 text-compare-muted">{voiced("terminal.forecast.5")}</p>}
    {card && card.n_forecast_ok === 0 && <p className="border-b border-rule p-3 text-compare-muted">Curves aren't fitted yet: each trait needs at least 4 usable quarters (15+ sites and 25% coverage) from the archive backfill. Until then, rankings use trendsetter gap, vanguard and corroboration.</p>}
    <div className="flex flex-wrap gap-1 border-b border-rule p-3" aria-label="Forecast sector filter">{["all", ...SECTORS].map(s => <Button key={s} variant="ghost" className={`label h-8 ${sector === s ? "text-highlight" : "text-compare-muted"}`} aria-pressed={sector === s} onClick={() => navigate({ search: prev => ({ ...prev, sector: s }) })}>{s}</Button>)}</div>

    <LibraryBand g="p-next-wave" title={`NEXT WAVE · HEADLINE · TOP 15 · ${sector === "all" ? "ALL SECTORS" : sector}`}>
      <ul className="divide-y divide-rule md:hidden">{wave.map(({ a, s, x }) => <li key={key(a)} className="space-y-1 p-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><Button variant="link" className="label h-auto min-h-11 whitespace-normal p-0 text-left text-ink" onClick={() => setOpen(a)}><TraitName {...a} /></Button><BasisChip k={key(a)} /><Explainer {...a} /></div>
        <div className="label flex flex-wrap gap-x-3 text-compare-muted"><StageTag stage={s.stage} /><span>SHARE {pct(s.current_share)}</span><span>+4Q {s.proj_q4 == null ? NO_PROJ : `${pct(s.proj_q4)} (${pct(s.proj_q4_lo, 0)}–${pct(s.proj_q4_hi, 0)})`}</span>{x && <><span>MOMENTUM <MomentumText s={x} /></span><span>CONFIDENCE <ConfidenceText s={x} /></span></>}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><QuarterLine look="data" quarters={s.quarters ?? []} proj={projOf(s)} /></div>
      </li>)}</ul>
      <div className="hidden overflow-x-auto md:block"><CsvScope><table className="w-full min-w-[880px] text-left">
        <thead className="label text-compare-muted"><tr className="border-b border-rule">{[{ h: "SIGNAL", g: "trait" }, { h: "BASIS", g: "basis-measured" }, { h: "STAGE", g: "stage" }, { h: "SHARE", g: "share" }, { h: "+4Q (LO–HI)", g: "projection" }, { h: "MOMENTUM", g: "momentum-index" }, { h: "CONFIDENCE", g: "confidence" }, { h: "SERIES", g: "series" }].map(({ h, g }) => <th key={h} scope="col" className="p-2 font-normal"><span className="inline-flex items-center">{h}<Info g={g} /></span></th>)}</tr></thead>
        <tbody>{wave.map(({ a, s, x }) => <tr key={key(a)} className="border-b border-rule align-middle">
          <td className="p-2"><Button variant="link" className="label h-auto whitespace-normal p-0 text-left text-ink" onClick={() => setOpen(a)}><TraitName {...a} /></Button><Explainer {...a} /></td>
          <td className="p-2"><BasisChip k={key(a)} /></td>
          <td className="p-2"><StageTag stage={s.stage} /></td>
          <td className="label p-2 tabular-nums">{pct(s.current_share)}</td>
          <td className="label p-2 tabular-nums">{s.proj_q4 == null ? NO_PROJ : `${pct(s.proj_q4)} (${pct(s.proj_q4_lo, 0)}–${pct(s.proj_q4_hi, 0)})`}</td>
          <td className="p-2">{x ? <MomentumText s={x} /> : "—"}</td>
          <td className="p-2">{x ? <ConfidenceText s={x} /> : "—"}</td>
          <td className="p-2"><QuarterLine look="data" quarters={s.quarters ?? []} proj={projOf(s)} /></td>
        </tr>)}</tbody>
      </table></CsvScope></div>
      <p className="label border-t border-rule p-2 text-compare-muted">Headline signals only, ranked by the stored next-wave score. Open a row for its seven score parts.</p>
      {!wave.length && <p className="p-3 text-compare-muted">{voiced("terminal.forecast.6")}</p>}
    </LibraryBand>

    <LibraryBand g="p-stage-board" title={`STAGE BOARD · HEADLINE · ${sector === "all" ? "ALL SECTORS" : sector}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">{STAGES.map(st => { const chips = scoped.filter(r => stageName(r.stage) === st).sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0)); return <div key={st} className="min-w-0 border-b border-r border-rule p-3"><h3 className="mb-2 flex items-center gap-2"><StageBadge stage={st} /><Info g={stageId(st)} /><span className="label text-compare-muted">{chips.length}</span></h3><div className="flex flex-wrap gap-1">{chips.map(r => <Button key={key(r)} variant="outline" className="label h-auto whitespace-normal px-2 py-1 text-left" onClick={() => setOpen(r)}><TraitName {...r} /></Button>)}{!chips.length && <span className="text-compare-muted">No trait is {st} in this scope yet; stages need at least 4 usable quarters of history.</span>}</div></div>; })}</div>
    </LibraryBand>

    <div className="grid grid-cols-1 xl:grid-cols-2">
      <LibraryBand g="p-trendsetters" title={`TRENDSETTERS · TOP 20 · ${sector === "all" ? "ALL SECTORS" : sector}`}>
        <ol className="divide-y divide-rule">{setters.map((s, i) => <li key={s.domain} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-2">
          <span className="label w-6 text-compare-muted tabular-nums">{i + 1}</span>
          <Link to="/brands/$domain" params={{ domain: s.domain ?? "" }} search={{ view: "data" }} className="font-semibold text-ink underline-offset-2 hover:underline">{s.domain}</Link>
          <span className="label tabular-nums">{(s.score ?? 0).toFixed(2)}</span>
          <span className="label min-w-0 flex-1 break-words text-compare-muted">{s.traits_led.slice(0, 4).map(t => `${label(t.trait).name} +${t.lead}Q`).join(" · ")}</span>
        </li>)}</ol>
        {!setters.length && <p className="p-3 text-compare-muted">{voiced("terminal.forecast.7")}</p>}
      </LibraryBand>
      <LibraryBand g="p-lead-lag" title="LEAD–LAG · FIRST QUARTER ≥10% BY SECTOR">
        <div className="overflow-x-auto"><CsvScope><table className="w-full min-w-[760px] text-left">
          <thead className="label text-compare-muted"><tr className="border-b border-rule"><th scope="col" className="p-2 font-normal"><span className="inline-flex items-center">TRAIT<Info g="trait" /></span></th>{SECTORS.map((s, i) => <th key={s} scope="col" className={`p-1 font-normal ${sector === s ? "text-ink underline" : ""}`}><span className="inline-flex items-center">{s.slice(0, 8)}{i === 0 && <Info g="first-quarter" />}</span></th>)}</tr></thead>
          <tbody>{lagRows.map(r => { const qs = Object.values(r.sectors!).filter((q): q is string => !!q).sort(); return <tr key={key(r)} className="border-b border-rule"><th scope="row" className="label p-2 text-left font-normal"><Button variant="link" className="label h-auto p-0 text-left text-ink" onClick={() => setOpen(r)}><TraitName {...r} /></Button></th>{SECTORS.map(s => { const q = r.sectors![s]; return <td key={s} className={`label p-1 tabular-nums ${q && q === qs[0] ? "text-highlight" : "text-compare-muted"}`}>{q ? q.slice(2) : "·"}</td>; })}</tr>; })}</tbody>
        </table></CsvScope></div>
        {!lagRows.length && <p className="p-3 text-compare-muted">{voiced("terminal.forecast.8")}</p>}
      </LibraryBand>
    </div>

    <LibraryBand g="p-chart-of-week" title={`CHART OF THE WEEK${brief?.week ? ` · ${brief.week}` : ""}`}><Suspense fallback={<p className="p-3">{voiced("busy.terminal")} <span aria-hidden="true">▍</span></p>}><ChartBand week={brief?.week ?? null} /></Suspense></LibraryBand>
    <LibraryBand g="p-brief" title={`BRIEF${brief?.week ? ` · ${brief.week}` : ""} · AI VIA ${brief?.brief.provider === "google" ? "GOOGLE AI STUDIO" : "LOVABLE AI"}`}>
      <BriefWithdrawn week={brief?.week} className="border-b border-rule p-3" />
      {brief ? <BriefView brief={brief.brief} onTrait={(id) => { const [dimension, ...rest] = id.replace(/:all$/, "").split(":"); setOpen({ dimension: dimension ?? "", value: rest.join(":") }); }} /> : <p className="p-3 text-compare-muted">{voiced("terminal.forecast.9")}</p>}
      {data.briefs.length > 1 && <div className="flex flex-wrap gap-1 border-t border-rule p-3" aria-label="Brief archive"><span className="label text-compare-muted">ARCHIVE</span>{data.briefs.map(b => <Button key={b.week} variant="ghost" className={`label h-8 ${b.week === brief?.week ? "text-highlight" : ""}`} aria-pressed={b.week === brief?.week} onClick={() => setWeek(b.week)}>{b.week}</Button>)}</div>}
    </LibraryBand>
    {open && <TraitDrawer {...open} onClose={() => setOpen(null)} />}
  </div>;
}

function ChartBand({ week }: { week: string | null }) { const { data } = useSuspenseQuery(chartCardQuery(week)); return <ChartOfWeek card={data} />; }
export function BriefView({ brief, onTrait }: { brief: BriefDoc; onTrait: (id: string) => void }) {
  const shown = briefDisplay(brief);
  return <article className="p-3">
    <h3 className="text-hero font-semibold"><span className="label mr-2 text-highlight">AI</span>{shown.headline}</h3>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.sections.map(s => <section key={s.title} className="min-w-0 border border-rule p-3">
      <h4 className="label font-semibold">{s.title.toUpperCase()}</h4><p className="mt-1">{s.body}</p>
      <div className="mt-2 flex flex-wrap gap-1">{s.citations.map(c => { const ref = brief.refs?.[`${c.kind}:${c.id}`]; const text = deLegacy(c.text); const cls = "label inline-flex h-6 items-center border border-rule px-2 text-compare-muted hover:text-ink";
        if (c.kind === "forecast") return <button key={c.kind + c.id} type="button" className={cls} onClick={() => onTrait(c.id)}>{text}</button>;
        if (c.kind === "event" && ref?.domain) return <Link key={c.kind + c.id} to="/brands/$domain" params={{ domain: ref.domain }} search={{ view: "data" }} className={cls}>{text}</Link>;
        if (c.kind === "wire" && ref?.url) { const href = sitePath(ref.url), own = href.startsWith("/"); return <a key={c.kind + c.id} href={href} {...(own ? {} : { target: "_blank", rel: "noreferrer" })} className={cls}>{text}</a>; }
        if (c.kind === "spread") return <Link key={c.kind + c.id} to="/terminal" search={{ panel: "overview" }} className={cls}>{text}</Link>;
        return <span key={c.kind + c.id} className={cls}>{text}</span>; })}</div>
    </section>)}</div>
    <p className="label mt-3 text-compare-muted">CAVEATS · {shown.caveats}</p>
  </article>;
}

type DetailRow = { scope: string; status: string; model: string | null; evidence: unknown; backtest: unknown; components?: unknown } & Parameters<typeof projOf>[0];
export function TraitDrawer({ dimension, value, onClose }: { dimension: string; value: string; onClose: () => void }) {
  const tl = label(`${dimension}:${value}`);
  return <Overlay title={`${tl.name} [${tl.dimension}]`} onClose={onClose}><TraitDetail dimension={dimension} value={value} /></Overlay>;
}
/** U1 · the signal drawer's content: the terminal drawer and a signal's Data view (`/signals/<key>?view=data`) render the same thing. */
export function TraitDetail({ dimension, value, explainer = true }: { dimension: string; value: string; explainer?: boolean }) {
  const { data, isLoading } = useQuery(forecastDetailQuery(dimension, value));
  const rows = (data ?? []) as DetailRow[]; const main = rows.find(r => r.scope === "all");
  const ev = (main?.evidence ?? {}) as { quarters?: Pt[]; fitted?: { quarter: string; value: number }[]; sites?: { domain: string; lead: number; adopted: string }[]; usable?: number; crossed_20?: string | null };
  const comp = (main?.components ?? {}) as DrawerComponents;
  const bt = (main?.backtest ?? {}) as { status?: string; mae_pts?: number; hit_rate?: number; predictions?: { quarter: string; predicted: number; actual: number }[] };
  const sectors = rows.filter(r => r.scope !== "all").map(r => ({ scope: r.scope, pts: ((r.evidence as { quarters?: Pt[] })?.quarters ?? []) }));
  const tl = label(`${dimension}:${value}`), k = `${dimension}:${value}`;
  const { data: sig } = useSuspenseQuery(signalsQuery());
  const signal = sig?.signals.find(x => x.key === k) ?? null, tier = sig?.tiers.get(k) ?? null;
  const [parts, setParts] = useState(false);
  return <>
    {isLoading || !main ? <p className="label">{voiced("busy.terminal")} <span aria-hidden="true">▍</span></p> : <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2"><BasisChip k={k} info />{tier && <TierChip tier={tier.tier} info />}<StageBadge stage={signal?.stage ?? null} /></p>
      {signal?.so_what && <p className="text-ink">{signal.so_what}</p>}
      {signal && <dl className="grid grid-cols-2 border border-rule"><div className="border-r border-rule p-2"><dt className="label flex items-center text-compare-muted">MOMENTUM<Info g="momentum-index" /></dt><dd className="text-hero"><MomentumText s={signal} /></dd></div><div className="p-2"><dt className="label flex items-center text-compare-muted">CONFIDENCE<Info g="confidence" /></dt><dd className="text-hero"><ConfidenceText s={signal} /></dd></div></dl>}
      {signal && <p className="label break-words text-compare-muted">RECEIPT · {signal.confidence_reason} · NEXT-WAVE SCORE {signal.next_wave_score == null ? "not scored" : signal.next_wave_score.toFixed(2)} · MOMENTUM {signal.momentum == null ? "not measured" : `${signal.momentum > 0 ? "+" : ""}${signal.momentum.toFixed(2)} PTS/Q`}</p>}
      {tier && <ul className="label space-y-1 text-compare-muted" aria-label="Why this tier">{tier.reasons.map(r => <li key={r}>· {r}</li>)}</ul>}
      <Evidence k={k} signals={sig?.signals ?? []} />
      {explainer && <p className="label"><Link to="/signals/$key" params={{ key: `${dimension}:${value}` }} className="text-ink underline underline-offset-2">EXPLAINER →</Link> <span className="text-compare-muted">plain-English page with example sites</span></p>}
      <p className="label text-compare-muted">{main.status === "ok" ? `MODEL ${main.model?.toUpperCase()} · ${ev.usable} USABLE QUARTERS` : `Not fitted yet: ${ev.usable ?? 0} of the 4 usable quarters a curve needs`}{ev.crossed_20 ? ` · CROSSED 20% ${ev.crossed_20}` : ""}</p>
      <QuarterLine look="data" large label={traitLabel(dimension, value)} quarters={ev.quarters ?? []} proj={projOf(main)} fitted={ev.fitted} backtest={bt.predictions} sectors={sectors} />
      <p className="label text-compare-muted">SOLID = MEASURED · DASHED = FIT · CONE = 80% BOOTSTRAP · DOTTED = 2025Q2 BACKTEST · GREY LINES = SECTORS · FAINT POINTS = UNUSABLE QUARTERS (N&lt;15 OR COVERAGE&lt;25%)</p>
      <p className="label">BACKTEST {bt.status === "ok" ? `MAE ${bt.mae_pts?.toFixed(1)} PTS · HIT ${pct(bt.hit_rate, 0)}` : "· not enough history before 2025Q2 to test this trait"}</p>
      <div><button type="button" aria-expanded={parts} onClick={() => setParts(p => !p)} className="label inline-flex min-h-11 items-center text-ink underline underline-offset-2 md:min-h-0">{parts ? "▾" : "▸"} SEVEN SCORE PARTS</button>{parts && <div className="mt-2"><Components comp={comp} /></div>}</div>
      <div><h3 className="label flex items-center text-compare-muted">LED BY<Info g="p-led-by" /></h3><ul className="flex flex-wrap gap-x-3">{(ev.sites ?? []).map(s => <li key={s.domain}><Link to="/brands/$domain" params={{ domain: s.domain }} search={{ view: "data" }} className="underline-offset-2 hover:underline">{s.domain}</Link> <span className="label text-compare-muted">{s.adopted} · +{s.lead}Q</span></li>)}{!ev.sites?.length && <li className="text-compare-muted">{voiced("terminal.forecast.10")}</li>}</ul></div>
      <div className="overflow-x-auto"><CsvScope><table className="w-full text-left"><thead className="label text-compare-muted"><tr>{[{ h: "QUARTER", g: "quarter" }, { h: "SHARE", g: "share" }, { h: "N", g: "sample-n" }, { h: "COVERAGE", g: "coverage" }].map(({ h, g }) => <th key={h} scope="col" className="p-1 font-normal"><span className="inline-flex items-center">{h}<Info g={g} /></span></th>)}</tr></thead><tbody>{(ev.quarters ?? []).filter(p => p.n > 0).map(p => <tr key={p.q} className={`label tabular-nums ${p.n < 15 || p.c < .25 ? "text-compare-muted" : ""}`}><td className="p-1">{p.q}</td><td className="p-1">{pct(p.s)}</td><td className="p-1">{p.n}</td><td className="p-1">{(p.c * 100).toFixed(0)}%</td></tr>)}</tbody></table></CsvScope></div>
    </div>}
  </>;
}

type DrawerComponents = { raw?: Record<string, number | null>; z?: Record<string, number | null>; present?: string[]; why?: string[];
  curation?: { lead_pts: number | null; prev_lead_pts?: number | null; n?: Record<string, number>; hits?: Record<string, number>; gallery_mix?: Record<string, number>; reason?: string };
  discourse?: { z: number | null; rate_per_10k?: number | null; n_week?: number; n_9w?: number; baseline_weeks?: number; fatigue_ratio?: number | null; fatigue_flag?: boolean; spike?: boolean; terms?: string[]; reason?: string };
  supply?: { value: number | null; category?: string; gf_additions?: { last90: number; prior90: number | null; note: string | null } | null; ph_sites?: number | null; ph_note?: string | null; reason?: string } };
const num = (v: number | null | undefined, d = 1) => (v == null ? "none" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);
function Components({ comp }: { comp: DrawerComponents }) {
  const present = new Set(comp.present ?? []), c = comp.curation, d = comp.discourse, s = comp.supply;
  return <div className="space-y-2">
    <h3 className="label flex items-center text-compare-muted">SCORE PARTS · {present.size} OF {COMPONENTS.length} MEASURED · MISSING PARTS COUNT AS AVERAGE<Info g="p-components" /></h3>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">{COMPONENTS.map(([k, l]) => <div key={k} className="min-w-0"><dt className={`label inline-flex items-center ${present.has(k) ? "text-ink" : "text-compare-muted"}`}>{l}<Info g={COMPONENT_G[k]!} /></dt><dd className="label flex items-center gap-2 tabular-nums">{present.has(k) ? num(comp.raw?.[k], 2) : "not measured"}<ZBar z={comp.z?.[k]} label={l} /></dd></div>)}</dl>
    <p className="label break-words text-compare-muted">CURATION {c?.n ? `${c.lead_pts != null ? `${num(c.lead_pts)} PTS` : "LEAD —"} (PREV ${num(c.prev_lead_pts)}) · N ${["mainstream", "vanguard", "curated"].map(i => `${i[0]!.toUpperCase()} ${c.hits?.[i] ?? 0}/${c.n?.[i] ?? 0}`).join(" · ")}${c.gallery_mix && Object.keys(c.gallery_mix).length ? ` · GALLERIES ${Object.entries(c.gallery_mix).map(([g, n]) => `${g} ${n}`).join(", ")}` : ""}${c.lead_pts == null ? " · NEEDS ≥10 CURATED SITES" : ""}` : c?.reason ?? "not measured for this trait"}</p>
    <p className="label break-words text-compare-muted">DISCOURSE {d && d.z !== undefined && !d.reason ? `Z ${num(d.z, 2)} · ${d.rate_per_10k ?? "—"}/10K POSTS · ${d.n_week ?? 0} THIS WEEK · ${d.n_9w ?? 0} IN 9 WK · BASELINE ${d.baseline_weeks ?? 0} WK · FATIGUE ${d.fatigue_ratio == null ? "—" : `${(d.fatigue_ratio * 100).toFixed(0)}%`}${d.fatigue_flag ? " · FLAG" : ""}${d.spike ? " · SPIKE" : ""}${d.terms?.length ? ` · TERMS ${d.terms.join(", ")}` : ""}` : d?.reason ?? "not measured for this trait"}</p>
    <p className="label break-words text-compare-muted">SUPPLY {s?.category ? `${s.category.toUpperCase()} · ${s.value == null ? "NOT MEASURABLE YET" : num(s.value, 0)} · GF NEW 90D ${s.gf_additions?.last90 ?? "—"} VS PRIOR ${s.gf_additions?.prior90 ?? "—"}${s.gf_additions?.note ? ` (${s.gf_additions.note})` : ""} · PH SITES ${s.ph_sites ?? "—"}${s.ph_note ? ` (${s.ph_note})` : ""}` : s?.reason ?? "not measured for this trait"}</p>
    {comp.why?.length ? <ul className="label space-y-1">{comp.why.map(w => <li key={w} className="text-ink">· {w}</li>)}</ul> : null}
  </div>;
}

const pctOr = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
/** Supporting evidence: a composite's member fragments, or the composites a fragment belongs to. */
function Evidence({ k, signals }: { k: string; signals: Signal[] }) {
  const keys = evidenceKeys(k), combo = compositeOf(k);
  if (!keys.length) return null;
  const by = new Map(signals.map(x => [x.key, x]));
  return <div><h3 className="label flex items-center text-compare-muted">{combo ? "EVIDENCE · MEMBER SIGNALS" : "PART OF"}<Info g={combo ? "composite" : "tier-supporting"} /></h3>
    {combo && <p className="label text-compare-muted">RULE · {ruleText(combo)}</p>}
    <ul className="mt-1 divide-y divide-rule border-y border-rule">{keys.map(m => { const x = by.get(m), l = label(m); return <li key={m} className="flex flex-wrap items-baseline gap-x-2 py-1">
      <Link to="/signals/$key" params={{ key: m }} className="text-ink underline-offset-2 hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center">{l.name}</Link><DimTag d={l.dimension} /><BasisChip k={m} />
      <span className="label text-compare-muted">{x ? `${x.tier.toUpperCase()} · ${pctOr(x.share)} · ${x.stage ?? "not staged"}` : "measured per site; not forecast on its own"}</span>
    </li>; })}</ul>
  </div>;
}
