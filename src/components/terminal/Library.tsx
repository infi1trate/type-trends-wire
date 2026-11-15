import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { libraryQuery } from "@/lib/data";
import { SECTORS, pct } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { QueryBar } from "./primitives";
import { BarMark, LibraryBand, Relative, Swatch } from "./LibraryShared";
import { LibraryAiTrends } from "./LibraryAi";
import { Info } from "./Info";
import { label as traitLabel } from "@/lib/labels";

const NM = "Not measured yet: this field fills in after the site's next successful capture.";
const nm = <span className="text-g500" title={NM}>not measured</span>;

export function Library() {
  const { data } = useSuspenseQuery(libraryQuery());
  const { sector = "all", q = "", sort = "domain", desc = false, page = 0 } = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const update = (next: Partial<{ sector: string; q: string; sort: string; desc: boolean; page: number }>) => navigate({ search: prev => ({ ...prev, ...next }) });
  const keys = ["domain", "sector", "h1_family", "body_family", "theme", "accent", "hero_media", "whitespace_ratio", "last_change_at", "events_30d"] as const;
  const sortKey = keys.find(k => k === sort) ?? "domain";
  const filtered = data.rows.filter(r => (sector === "all" || r.sector === sector) && (r.domain ?? "").includes(q.toLowerCase())).sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    const n = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
    return (desc ? -n : n) || String(a.domain).localeCompare(String(b.domain));
  });
  const current = Math.min(Math.max(0, Math.floor(page)), Math.max(0, Math.ceil(filtered.length / 50) - 1));
  const rows = filtered.slice(current * 50, (current + 1) * 50);
  const totals = data.sectors.reduce((a, r) => ({ sites: a.sites + (r.sites ?? 0), snapshots: a.snapshots + (r.sites_snapshotted ?? 0) }), { sites: 0, snapshots: 0 });
  const last = data.rows.map(r => r.last_snapshot_at).filter((v): v is string => !!v).sort().at(-1);
  const tape = data.events.filter(e => sector === "all" || e.sector === sector);
  return <div className="library flex min-h-0 flex-1 flex-col">
    <div className="label grid shrink-0 grid-cols-2 border-b border-rule lg:grid-cols-4">{([["SITES TRACKED", totals.sites, "sites"], ["SNAPSHOTTED", totals.snapshots, "snapshotted"], ["EVENTS 7D", data.events.length, "p-event-tape"], ["LAST CRAWL", last ? last.replace("T", " ").slice(0, 16) + " UTC" : "Waiting for the first capture", "p-library"]] as const).map(([k, v, g]) => <div key={k} className="border-r border-rule p-3 text-compare-muted"><span className="inline-flex items-center">{k}<Info g={g} /></span><div className="mt-1 text-hero text-ink">{v}</div></div>)}</div>
    <div className="label shrink-0 border-b border-rule p-3 text-compare-muted">AI ${(data.ai.spend?.month_to_date_usd??0).toFixed(2)} / ${data.ai.spend?.monthly_cap_usd??50} MTD</div>
    <div className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
      <div className="grid shrink-0 lg:grid-cols-[minmax(0,3fr)_minmax(230px,1fr)]">
        <div className="min-w-0 lg:border-r lg:border-rule">
          <div className="flex flex-wrap gap-1 border-b border-rule p-3" aria-label="Sector filter">{["all", ...SECTORS].map(s => <Button key={s} variant="ghost" className={`label h-8 px-2 ${sector === s ? "bg-ink text-void" : "text-compare-muted"}`} aria-pressed={sector === s} onClick={() => update({ sector: s, page: 0 })}>{s}</Button>)}</div>
          <div className="flex flex-wrap gap-2 border-b border-rule p-3"><QueryBar label="Search library domains" placeholder="QUERY DOMAIN" value={q} onChange={e => update({ q: e.target.value, page: 0 })}/><label className="label flex items-center gap-2 min-[1280px]:hidden">SORT<select aria-label="Library sort" value={sortKey} onChange={e => update({ sort: e.target.value })} className="border border-rule bg-void p-2">{keys.map(k => <option key={k} value={k}>{k.toUpperCase().replaceAll("_", " ")}</option>)}</select></label><Button variant="ghost" size="icon" className="min-[1280px]:hidden" aria-label={desc ? "Sort ascending" : "Sort descending"} onClick={() => update({ desc: !desc })}>{desc ? "↓" : "↑"}</Button></div>
          <table className="library-table w-full table-fixed text-label"><thead><tr>{([{ h: "DOMAIN", g: "domain" }, { h: "SECTOR", g: "sector" }, { h: "H1 FAMILY", g: "h1-family" }, { h: "BODY FAMILY", g: "body-family" }, { h: "L/D", g: "theme" }, { h: "ACCENT", g: "accent" }, { h: "HERO", g: "hero" }, { h: "SPACE", g: "whitespace" }, { h: "CHANGE", g: "last-change" }, { h: "EV 30D", g: "events-30d" }]).map(({ h: label, g }, i) => <th key={label} className="border-b border-rule text-left"><span className="flex items-center"><Button variant="ghost" className="label h-auto min-w-0 justify-start px-2 py-2" onClick={() => update({ sort: keys[i] ?? "domain", desc: sort === keys[i] ? !desc : false })}>{label}{sort === keys[i] ? desc ? " ↓" : " ↑" : ""}</Button><Info g={g} /></span></th>)}</tr></thead><tbody>{rows.map(r => r.domain && <tr key={r.domain} className="border-b border-rule hover:bg-g900">
            <td data-label="DOMAIN" className="p-2 font-semibold"><Link to="/library/$domain" params={{ domain: r.domain }} className="text-ink hover:text-signal">{r.domain}</Link></td>
            <td data-label="SECTOR" className="p-2 text-compare-muted">{r.sector}</td><td data-label="H1" className="p-2">{r.h1_family ?? nm}</td><td data-label="BODY" className="p-2">{r.body_family ?? nm}</td>
            <td data-label="THEME" className="p-2" title={r.theme ?? "Unknown"}>{r.theme === "dark" ? "D ◐" : r.theme === "light" ? "L ○" : nm}</td><td data-label="ACCENT" className="p-2"><Swatch color={r.accent}/></td><td data-label="HERO" className="p-2">{r.hero_media ? traitLabel(`hero_media:${r.hero_media}`).name : nm}</td><td data-label="SPACE" className="p-2">{pct(r.whitespace_ratio)}</td><td data-label="CHANGE" className="p-2"><Relative date={r.last_change_at}/></td><td data-label="EV 30D" className="p-2">{r.events_30d ?? 0}</td>
          </tr>)}</tbody></table>
          {rows.length === 0 && <p className="p-3 text-compare-muted">No library site matches this search in this sector. Try part of the domain, or switch the sector to all.</p>}
          <div className="label flex items-center justify-between border-b border-rule p-3"><span>{filtered.length} SITES · {current + 1}/{Math.max(1, Math.ceil(filtered.length / 50))}</span><div><Button variant="ghost" size="icon" aria-label="Previous library page" disabled={current === 0} onClick={() => update({ page: current - 1 })}>←</Button><Button variant="ghost" size="icon" aria-label="Next library page" disabled={(current + 1) * 50 >= filtered.length} onClick={() => update({ page: current + 1 })}>→</Button></div></div>
        </div>
        <LibraryBand title="EVENT TAPE" g="p-event-tape"><div className="lg:max-h-[720px] lg:overflow-y-auto">{tape.length === 0 ? <p className="p-3 text-compare-muted">No confirmed changes in the last 7 days for this sector. A change shows here once two captures in a row agree, so check back after the next daily capture.</p> : tape.map(e => <div key={e.id} className={`border-b border-rule p-3 ${e.severity === 3 ? "text-signal" : e.severity === 2 ? "text-ink" : "text-compare-muted"}`}><div className="label"><Relative date={e.detected_at}/> · {e.domain && <Link to="/library/$domain" params={{ domain: e.domain }}>{e.domain}</Link>}</div><div className="label mt-1">{e.type}</div><p>{e.summary}</p></div>)}</div></LibraryBand>
      </div>
      <LibraryBand title="SECTOR GRID" g="p-sector-grid"><table className="library-table w-full text-label"><thead><tr>{[{ h: "SECTOR", g: "sector" }, { h: "SITES", g: "sites" }, { h: "SNAPSHOTTED", g: "snapshotted" }, { h: "DARK", g: "dark-share" }, { h: "SERIF H1", g: "serif-share" }, { h: "MEDIAN SPACE", g: "median-space" }, { h: "EVENTS 30D", g: "events-30d" }].map(({ h: k, g }) => <th className="p-3 text-left label" key={k}>{k}<Info g={g} /></th>)}</tr></thead><tbody>{data.sectors.map(r => <tr key={r.sector} className="border-t border-rule"><td data-label="SECTOR" className="p-3">{r.sector}</td><td data-label="SITES" className="p-3">{r.sites}</td><td data-label="SNAPSHOTTED" className="p-3">{r.sites_snapshotted}</td><td data-label="DARK" className="p-3"><BarMark value={r.dark_theme_share}/></td><td data-label="SERIF H1" className="p-3"><BarMark value={r.serif_headline_share}/></td><td data-label="MEDIAN SPACE" className="p-3"><BarMark value={r.median_whitespace_ratio}/></td><td data-label="EVENTS 30D" className="p-3">{r.events_30d}</td></tr>)}</tbody></table></LibraryBand>
      <LibraryAiTrends data={data.ai} sector={sector} total={sector==='all'?totals.sites:data.sectors.find(s=>s.sector===sector)?.sites??0}/>
    </div>
  </div>;
}
export function LibraryTicker() { const { data } = useSuspenseQuery(libraryQuery()); return <>{data.events.filter(e => (e.severity ?? 0) >= 2).slice(0, 12).map(e => <span key={e.id} className="mr-8 inline-flex gap-2"><span className="normal-case text-ink">{e.domain}</span><span className="text-g500">{e.summary ?? e.type?.replace(/_/g, " ")}</span></span>)}</>; }