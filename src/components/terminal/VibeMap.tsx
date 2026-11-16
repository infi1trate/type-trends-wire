import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { vibeQuery } from "@/lib/data";
import { SECTORS } from "@/lib/library";
import { tagPhrase } from "@/lib/vibe";
import { PanelHeader } from "./primitives";
import { DimTag, Info, StageBadge } from "./Info";
import { label as traitLabel } from "@/lib/labels";

type Cluster = { id: number; name: string; n?: number; share?: number; top_tags?: { tag: string; share: number; lift_pts: number; phrase?: string }[]; top_sectors?: { sector: string; n: number }[]; momentum?: { from_quarter: string; delta_pts: number; from_n: number } | null; drivers?: { trait: string; stage: string | null; momentum: number | null; share: number | null }[] };
type Point = { domain: string; sector: string; x: number; y: number; cluster: number; tags: string[] };
const SIZE = 1000, PAD = 40, DOT = 12;
const pct = (v: number | undefined) => (v == null ? "not measured" : `${Math.round(v * 100)}%`);
const tagText = (tags: string[]) => tags.filter(t => !t.startsWith("components:")).map(tagPhrase).join(" · ");

export function VibeMap({ sector, onSector, onMethod }: { sector: string; onSector: (s: string) => void; onMethod: () => void }) {
  const { data } = useSuspenseQuery(vibeQuery());
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null), [focus, setFocus] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const points = (data?.points ?? []) as Point[], clusters = (data?.clusters ?? []) as Cluster[];
  const scale = useMemo(() => {
    const xs = points.map(p => p.x), ys = points.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const span = Math.max(x1 - x0, y1 - y0) || 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = (SIZE - 2 * PAD) / span;
    return { X: (x: number) => SIZE / 2 + (x - cx) * k, Y: (y: number) => SIZE / 2 - (y - cy) * k };
  }, [points]);
  if (!data) return <section className="flex-1"><PanelHeader g="p-vibe-map" title="F7 VIBE MAP" /><p className="p-3 text-compare-muted">No vibe map yet. It is drawn with the Sunday forecast once at least 20 sites carry valid AI style tags.</p></section>;
  const order = (c: number | null) => points.filter(p => c == null || p.cluster === c).sort((a, b) => a.x - b.x || a.y - b.y || a.domain.localeCompare(b.domain));
  const focused = points.find(p => p.domain === focus) ?? null;
  const sel = clusters.find(c => c.id === selected) ?? null;
  const members = selected == null ? [] : order(selected).filter(p => sector === "all" || p.sector === sector);
  const move = (dir: 1 | -1) => {
    const list = order(selected ?? focused?.cluster ?? null);
    if (!list.length) return;
    const i = focused ? list.findIndex(p => p.domain === focused.domain) : -1;
    const next = list[(i + dir + list.length) % list.length]!;
    setFocus(next.domain); if (selected == null) setSelected(next.cluster);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && focused) { e.preventDefault(); void navigate({ to: "/library/$domain", params: { domain: focused.domain }, search: { viewport: "desktop", page_type: "home", a: "", b: "" } }); }
    else if (e.key === "Escape" && selected != null) { e.stopPropagation(); setSelected(null); setFocus(null); }
  };
  const [ax, ay] = data.axes;
  return <section aria-label="Vibe map" className="flex min-h-0 flex-1 flex-col">
    <PanelHeader g="p-vibe-map" title="F7 VIBE MAP" meta={<span className="num">{data.n} SITES · {data.k} CLUSTERS · {data.quarter}</span>} />
    <div className="flex flex-wrap items-center gap-3 border-b border-rule p-3">
      <label className="label flex items-center gap-2 text-compare-muted">SECTOR
        <select value={sector} onChange={e => onSector(e.target.value)} className="label h-10 border border-rule bg-void px-2 text-ink md:h-8"><option value="all">ALL</option>{SECTORS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select>
      </label>
      <span className="label text-compare-muted">ARROWS MOVE WITHIN A CLUSTER · ENTER OPENS THE SITE · ESC CLEARS</span>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:overflow-hidden">
      <div className="min-w-0 border-rule p-3 md:overflow-y-auto md:border-r">
        <div className="label mb-1 text-compare-muted">Y · {ay ? `↓ ${ay.negative.map(tagPhrase).join(" · ")}   ${ay.positive.map(tagPhrase).join(" · ")} ↑` : "—"}</div>
        <div className="mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-260px))] max-md:max-w-full">
          <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full border border-rule outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink" tabIndex={0} role="group" aria-label={`Vibe map of ${data.n} sites in ${data.k} clusters. Use arrow keys to move between sites, Enter to open.`} aria-describedby="vibe-readout" onKeyDown={onKey}>
            <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} stroke="var(--tk-rule-hairline)" strokeWidth={1} />
            <line x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} stroke="var(--tk-rule-hairline)" strokeWidth={1} />
            {points.map(p => {
              const dim = sector !== "all" && p.sector !== sector, on = selected == null || p.cluster === selected, isFocus = p.domain === focus;
              return <rect key={p.domain} x={scale.X(p.x) - DOT / 2} y={scale.Y(p.y) - DOT / 2} width={DOT} height={DOT}
                fill={isFocus ? "var(--tk-accent-1)" : on && selected != null ? "var(--tk-text-primary)" : "var(--tk-text-muted)"} opacity={dim ? 0.12 : on ? 1 : 0.3}
                onMouseEnter={() => setFocus(p.domain)} onClick={() => { setFocus(p.domain); setSelected(p.cluster); svgRef.current?.focus(); }} className="cursor-pointer"><title>{p.domain}</title></rect>;
            })}
          </svg>
        </div>
        <div className="label mt-1 text-right text-compare-muted">X · {ax ? `← ${ax.negative.map(tagPhrase).join(" · ")}   ${ax.positive.map(tagPhrase).join(" · ")} →` : "—"}</div>
        <div id="vibe-readout" aria-live="polite" className="mt-2 min-h-[3lh] border border-rule p-2 text-body">
          {focused ? <><Link to="/library/$domain" params={{ domain: focused.domain }} search={{ viewport: "desktop", page_type: "home", a: "", b: "" }} className="font-semibold text-ink hover:underline">{focused.domain}</Link> <span className="label text-compare-muted">{focused.sector.toUpperCase()} · {clusters.find(c => c.id === focused.cluster)?.name.toUpperCase()}</span><div className="text-g500">{tagText(focused.tags)}</div></> : <span className="text-compare-muted">HOVER, TAP OR ARROW TO A SITE.</span>}
        </div>
      </div>
      <div className="min-w-0 md:overflow-y-auto">
        <h3 className="label border-b border-rule bg-g900 px-3 py-2 font-semibold flex items-center">CLUSTERS<Info g="p-clusters" /></h3>
        <ul>{clusters.map(c => {
          const n = sector === "all" ? c.n : points.filter(p => p.cluster === c.id && p.sector === sector).length;
          return <li key={c.id} className="border-b border-rule">
            <button type="button" aria-pressed={selected === c.id} onClick={() => { setSelected(selected === c.id ? null : c.id); setFocus(null); }} className={`flex w-full flex-col gap-1 p-3 text-left ${selected === c.id ? "bg-g800" : "hover:bg-g900"}`}>
              <span className="flex justify-between gap-2"><span className="font-semibold text-ink">{c.name.toUpperCase()}</span><span className="num text-ink">{n}</span></span>
              <span className="label tabular-nums text-compare-muted">{pct(c.share)} OF MAP{c.momentum ? ` · ${c.momentum.delta_pts >= 0 ? "+" : ""}${c.momentum.delta_pts.toFixed(1)} PTS VS ${c.momentum.from_quarter} (N=${c.momentum.from_n})` : " · NO EARLIER QUARTER TO COMPARE YET"}</span>
              <span className="label text-compare-muted">{(c.top_sectors ?? []).slice(0, 3).map(s => `${s.sector.toUpperCase()} ${s.n}`).join(" · ")}</span>
            </button>
          </li>;
        })}</ul>
        {sel && <div className="border-b border-rule p-3">
          <h3 className="label mb-2 font-semibold text-ink">{sel.name.toUpperCase()} · TOP TAGS</h3>
          <ul className="label mb-3 text-compare-muted">{(sel.top_tags ?? []).slice(0, 5).map(t => <li key={t.tag}><span className="text-ink">{(t.phrase ?? tagPhrase(t.tag)).toUpperCase()}</span> {pct(t.share)} · +{t.lift_pts.toFixed(0)} PTS VS MAP</li>)}</ul>
          {!!sel.drivers?.length && <><h4 className="label mb-1 text-compare-muted">FORECAST TRAITS DRIVING IT</h4><ul className="label mb-3 text-compare-muted">{sel.drivers.map(d => <li key={d.trait}><span className="normal-case text-ink">{traitLabel(d.trait).name}</span> <DimTag d={traitLabel(d.trait).dimension} /> <StageBadge stage={d.stage} />{d.momentum != null && ` · ${d.momentum >= 0 ? "+" : ""}${d.momentum.toFixed(2)} PTS/Q`}</li>)}</ul></>}
          <h4 className="label mb-1 text-compare-muted">SITES · {members.length}</h4>
          <ul className="text-body">{members.map(p => <li key={p.domain} className="border-t border-rule py-1"><Link to="/library/$domain" params={{ domain: p.domain }} search={{ viewport: "desktop", page_type: "home", a: "", b: "" }} className={`hover:underline ${p.domain === focus ? "text-signal" : "text-ink"}`} onFocus={() => setFocus(p.domain)}>{p.domain}</Link> <span className="label text-compare-muted">{p.sector.toUpperCase()}</span><div className="label text-compare-muted">{tagText(p.tags)}</div></li>)}</ul>
        </div>}
        <p className="label p-3 text-compare-muted">{data.n} SITES WITH VALID AI TAGS · TAGS THROUGH {data.data_through?.slice(0, 10) ?? "UNDATED"} · PCA {ax ? pct(ax.explained) : "NOT COMPUTED"} + {ay ? pct(ay.explained) : "NOT COMPUTED"} OF VARIANCE · K={data.k} BY SILHOUETTE {data.silhouette?.toFixed(2)} · TAG-SPACE SIMILARITY, NOT VISUAL SIMILARITY · <button type="button" onClick={onMethod} className="text-ink underline">METHOD</button></p>
      </div>
    </div>
  </section>;
}
