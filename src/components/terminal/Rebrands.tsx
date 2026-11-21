import { StoryLink } from "@/components/dataview/StoryLink";
import { line as voiced } from "@/lib/voice";
import { startTransition, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { rebrandsQuery } from "@/lib/data";
import { SECTORS } from "@/lib/library";
import type { Rebrand, Side, TraitStage } from "@/lib/rebrands";
import { PanelHeader, Seg } from "./primitives";
import { WildFamily } from "./CrawlPanels";
import { Button } from "@/components/ui/button";
import { Info, StageBadge, DimTag } from "./Info";
import { label as traitLabel } from "@/lib/labels";
import { CsvScope } from "@/components/dataview/CopyCsv";

const PAGE = 20;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "undated");
const words = (v: string | null | undefined) => (v ? v.replace(/_/g, " ").toUpperCase() : "NOT MEASURED");

function Chip({ hex }: { hex: string | null }) {
  if (!hex) return null;
  return <span className="inline-flex items-center gap-1"><svg width="12" height="12" aria-hidden><rect width="12" height="12" fill={hex} stroke="var(--sys-color-rule)" /></svg><span className="num">{hex.toUpperCase()}</span></span>;
}
function Fonts({ s }: { s: Side }) {
  if (!s.h1 && !s.body) return <span className="text-compare-muted">{voiced("terminal.rebrands.1")}</span>;
  return <span className="flex flex-col">{s.h1 && <span><span className="label text-compare-muted">H1 </span><WildFamily family={s.h1} google={s.h1_google} /></span>}{s.body && <span><span className="label text-compare-muted">BODY </span><WildFamily family={s.body} google={s.body_google} /></span>}</span>;
}
function Palette({ s }: { s: Side }) {
  const top = s.palette.filter(h => h !== s.bg && h !== s.accent);
  if (!s.bg && !s.accent && !top.length) return <span className="text-compare-muted">{voiced("terminal.rebrands.2")}</span>;
  return <span className="flex flex-col gap-1">{s.bg && <span><span className="label text-compare-muted">BG </span><Chip hex={s.bg} /></span>}{s.accent && <span><span className="label text-compare-muted">ACCENT </span><Chip hex={s.accent} /></span>}{top.length > 0 && <span className="flex flex-wrap gap-x-2"><span className="label text-compare-muted">TOP</span>{top.map(h => <Chip key={h} hex={h} />)}</span>}</span>;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function Row({ label, before, after, changed }: { label: string; before: React.ReactNode; after: React.ReactNode; changed: boolean }) {
  return <tr className="border-b border-rule align-top">
    <th scope="row" className="label w-[11ch] p-2 text-left font-normal text-compare-muted">{label}</th>
    <td className={`min-w-0 break-words p-2 ${changed ? "text-g500" : "text-compare-muted"}`}>{before}</td>
    <td className="label w-[2ch] p-2 text-compare-muted" aria-hidden>→</td>
    <td className={`min-w-0 break-words p-2 ${changed ? "text-ink" : "text-compare-muted"}`}>{after}{changed && <span className="sr-only"> (changed)</span>}</td>
  </tr>;
}
function Traits({ list }: { list: TraitStage[] }) {
  const shown = list.filter(t => t.stage).slice(0, 4);
  if (!shown.length) return null;
  return <div className="label flex flex-wrap gap-x-3 gap-y-1 text-compare-muted"><span>NEW TRAITS</span>{shown.map(t => { const l = traitLabel(t.trait); return <span key={t.trait} className="inline-flex flex-wrap items-center gap-1"><span className="normal-case text-ink">{l.name}</span><DimTag d={l.dimension} /><StageBadge stage={t.stage} />{t.share != null && <span>{Math.round(t.share * 100)}% OF {t.scope === "all" ? "TRACKED BRANDS" : t.scope.toUpperCase()}</span>}</span>; })}</div>;
}
const NOT_TAGGED = <span className="text-compare-muted">NOT TAGGED</span>;
const tagList = (s: Side, k: "aesthetic" | "tone") => (s.tags ? s.tags[k].map(words).join(" · ") || "NONE" : NOT_TAGGED);
function Entry({ r }: { r: Rebrand }) {
  const b = r.before, a = r.after, tagged = !!b.tags && !!a.tags;
  return <article className="border-b border-rule" aria-labelledby={`rb-${r.id}`}>
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 pt-3">
      <h3 id={`rb-${r.id}`} className="text-hero font-semibold"><Link to="/brands/$domain" params={{ domain: r.domain }} search={{ view: "data" }} className="hover:underline">{r.domain}</Link></h3>
      <span className="label text-compare-muted">{r.sector.toUpperCase()}</span>
      <span className={`label border px-1 ${r.source === "live" ? "border-ink text-ink" : "border-rule text-compare-muted"}`}>{r.source === "live" ? "LIVE" : "ARCHIVE"}</span>
      <span className="label num text-compare-muted">{r.source === "archive" ? "CAPTURE" : "CONFIRMED"} {day(r.confirmed_at)}</span>
      <span className="label text-compare-muted">{r.reasons.map(x => x.toUpperCase()).join(" · ")}</span>
      <span className={`label border px-1 ${r.label === "Rebrand" ? "border-ink text-ink" : "border-rule text-compare-muted"}`}>{r.label.toUpperCase()}</span>
      {r.seasonal && <span className="label border border-rule px-1 text-compare-muted">SEASONAL</span>}
      <StoryLink row={{ events: r.event_ids }} className="ml-auto" />
    </header>
    <CsvScope><table className="mt-2 w-full table-fixed text-body">
      <caption className="sr-only">Before and after for {r.domain}</caption>
      <thead className="label text-compare-muted"><tr><th className="w-[11ch] p-2 text-left font-normal">FIELD<Info g="field" /></th><th className="p-2 text-left font-normal">BEFORE · {day(b.captured_at)}<Info g="before-after" /></th><th className="w-[2ch]" /><th className="p-2 text-left font-normal">AFTER · {day(a.captured_at)}</th></tr></thead>
      <tbody>
        <Row label="FONTS" before={<Fonts s={b} />} after={<Fonts s={a} />} changed={b.h1 !== a.h1 || b.body !== a.body} />
        <Row label="PALETTE" before={<Palette s={b} />} after={<Palette s={a} />} changed={!sameJson([b.bg, b.accent, b.palette], [a.bg, a.accent, a.palette])} />
        <Row label="THEME" before={words(b.theme)} after={words(a.theme)} changed={b.theme !== a.theme} />
        <Row label="HERO" before={`${b.tags ? words(b.tags.hero_layout) : "NOT TAGGED"} · ${words(b.hero_media)} MEDIA`} after={`${a.tags ? words(a.tags.hero_layout) : "NOT TAGGED"} · ${words(a.hero_media)} MEDIA`} changed={b.hero_media !== a.hero_media || (tagged && b.tags?.hero_layout !== a.tags?.hero_layout)} />
        <Row label="AESTHETIC" before={tagList(b, "aesthetic")} after={tagList(a, "aesthetic")} changed={tagged && !sameJson(b.tags?.aesthetic, a.tags?.aesthetic)} />
        <Row label="TONE" before={tagList(b, "tone")} after={tagList(a, "tone")} changed={tagged && !sameJson(b.tags?.tone, a.tags?.tone)} />
      </tbody>
    </table></CsvScope>
    <div className="flex flex-col gap-2 p-3">
      <p className="text-body text-ink"><span className="label text-compare-muted">READ </span>{r.read}</p>
      <Traits list={r.new_traits} />
      <div className="label flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/brands/$domain" params={{ domain: r.domain }} search={{ view: "data" }} className="text-ink hover:underline">BRAND DATA →</Link>
        {r.links.archive_before && <a href={r.links.archive_before} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">ARCHIVE BEFORE ↗</a>}
        {r.links.archive && <a href={r.links.archive} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">ARCHIVE AFTER ↗</a>}
        {r.wire && <a href={r.wire.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">COVERED BY {r.wire.source?.toUpperCase() ?? "WIRE"} · {day(r.wire.published_at)} ↗</a>}
        <span className="text-compare-muted">EVENTS {r.event_ids.length} · FIRST SEEN {day(r.effective_at)}</span>
      </div>
    </div>
  </article>;
}
const SOURCES = ["ALL", "LIVE", "ARCHIVE"] as const;
export function RebrandDesk({ sector, onSector }: { sector: string; onSector: (s: string) => void }) {
  const [source, setSource] = useState<(typeof SOURCES)[number]>("ALL"), [year, setYear] = useState("ALL"), [limit, setLimit] = useState(PAGE);
  const filters = { sector, ...(source !== "ALL" ? { source: source.toLowerCase() as "live" | "archive" } : {}), ...(year !== "ALL" ? { year: Number(year) } : {}), limit };
  // Suspense query so SSR data hydrates deterministically; filter changes run in a transition to keep the current list visible.
  const { data: d } = useSuspenseQuery(rebrandsQuery(filters));
  const [pending, go] = useTransition();
  const reset = () => setLimit(PAGE);
  return <section aria-label="Moves" aria-busy={pending} className={`flex min-h-0 flex-1 flex-col ${pending ? "opacity-60" : ""}`}>
    <PanelHeader g="p-rebrands" title="F3 MOVES" meta={<span className="num">{d.counts.rebrands}<span className="max-sm:hidden"> REBRANDS</span> · {d.counts.total - d.counts.rebrands}<span className="max-sm:hidden"> IDENTITY CHANGES</span> SINCE 2021 · {d.counts.this_quarter} THIS Q<span className="max-sm:hidden">UARTER</span></span>} />
    <div className="flex flex-wrap items-center gap-2 border-b border-rule p-3">
      <Seg label="Source" options={SOURCES} value={source} onChange={v => go(() => { setSource(v); reset(); })} />
      <Seg label="Year" options={["ALL", ...d.years.map(String)] as string[]} value={year} onChange={v => go(() => { setYear(v); reset(); })} />
      <label className="label flex items-center gap-2 text-compare-muted">SECTOR
        <select value={sector} onChange={e => { const v = e.target.value; go(() => { onSector(v); reset(); }); }} className="label h-10 border border-rule bg-void px-2 text-ink md:h-8">
          <option value="all">ALL</option>{SECTORS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
      </label>
      {<span className="label num text-compare-muted" aria-live="polite">{d.filtered.total} SHOWN BY FILTER · LIVE {d.filtered.live} · ARCHIVE {d.filtered.archive}</span>}
    </div>
    <div className="min-h-0 flex-1 md:overflow-y-auto">
      {d.rows.length === 0 && <p className="p-3 text-compare-muted">{voiced("terminal.rebrands.3")}</p>}
      {d.rows.map(r => <Entry key={r.id} r={r} />)}
      {d.rows.length < d.filtered.total && <div className="p-3"><Button variant="outline" className="label" disabled={pending} onClick={() => startTransition(() => setLimit(l => Math.min(l + PAGE, 500)))}>{pending ? voiced("busy.rebrands") : `MORE · ${d.filtered.total - d.rows.length} LEFT`}</Button></div>}
      <p className="label border-t border-rule p-3 text-compare-muted">SOURCE: CONFIRMED BRAND CHANGES (TWO CAPTURES, DESKTOP HOME) · LIVE CRAWLER + WAYBACK QUARTERLY ARCHIVE · DATA THROUGH {day(d.data_through)} · STAGES FROM THE LATEST FORECAST · LOGOS AND TEXT COLOR ARE NOT MEASURED</p>
    </div>
  </section>;
}
