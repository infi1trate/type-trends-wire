import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { familyHistoryQuery, sparkQuery, typeIndexQuery, type FamilyRow } from "@/lib/data";
import { computeBand } from "@/lib/bands";
import { Info } from "./Info";
import { BandTag, Delta, Empty, LineChart, Loading, PanelHeader, QueryBar, Seg, Sparkline } from "./primitives";

const CATS = ["ALL", "SANS", "SERIF", "DISPLAY", "HAND", "MONO"] as const;
const CAT_MAP: Record<string, string> = {
  SANS: "sans-serif", SERIF: "serif", DISPLAY: "display", HAND: "handwriting", MONO: "monospace",
};
const catShort = (c: string) =>
  ({ "sans-serif": "SANS", serif: "SERIF", display: "DISP", handwriting: "HAND", monospace: "MONO" })[c.toLowerCase()] ??
  c.toUpperCase().slice(0, 5);
const SORTS = ["RISING 7D", "RISING 28D", "FALLING 28D", "TRENDING NOW"] as const;
const PAGE = 50;

const nz = (v: number | null, fb: number) => (v === null ? fb : v);
const sorters: Record<(typeof SORTS)[number], (a: FamilyRow, b: FamilyRow) => number> = {
  "RISING 7D": (a, b) => nz(b.delta7, -1e9) - nz(a.delta7, -1e9) || a.popularity_rank - b.popularity_rank,
  "RISING 28D": (a, b) => nz(b.delta28, -1e9) - nz(a.delta28, -1e9) || a.popularity_rank - b.popularity_rank,
  "FALLING 28D": (a, b) => nz(a.delta28, 1e9) - nz(b.delta28, 1e9) || a.popularity_rank - b.popularity_rank,
  "TRENDING NOW": (a, b) => a.trending_rank - b.trending_rank,
};

const th = "label sticky top-0 z-10 h-8 border-b border-rule bg-g900 px-2 font-normal text-g500";

export function TypeIndex({ compact = false, onOpenFull }: { compact?: boolean; onOpenFull?: () => void }) {
  const { data, isLoading, error } = useQuery(typeIndexQuery());
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("RISING 7D");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<FamilyRow | null>(null);
  const section = useRef<HTMLElement>(null);
  const [compactRows, setCompactRows] = useState(10);
  useEffect(() => {
    if (!compact || !section.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (window.innerWidth < 768) { setCompactRows(10); return; }
      const rowHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
      setCompactRows(Math.max(10, Math.ceil((entry.contentRect.height - rowHeight * 2) / rowHeight)));
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [compact]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (compact) return [...data.rows].sort((a, b) => a.popularity_rank - b.popularity_rank).slice(0, compactRows);
    const ql = q.trim().toLowerCase();
    return data.rows
      .filter((r) => cat === "ALL" || r.category.toLowerCase() === CAT_MAP[cat])
      .filter((r) => !ql || r.family.toLowerCase().includes(ql))
      .sort(sorters[sort]);
  }, [data, cat, sort, q, compact, compactRows]);

  useEffect(() => setPage(0), [cat, sort, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = compact ? filtered : filtered.slice(page * PAGE, page * PAGE + PAGE);
  const fams = useMemo(() => visible.map((r) => r.family), [visible]);
  const { data: spark } = useQuery(sparkQuery(fams, data?.latest ?? null));

  const hideSm = "hidden md:table-cell";
  return (
    <section ref={section} className="flex min-h-0 flex-1 flex-col" aria-label="Type index">
      <PanelHeader
        title={compact ? "TYPE INDEX" : "F2 SUPPLY · GOOGLE FONTS POPULARITY"}
        g="p-type-index"
        meta={data?.latest ? <>SUPPORTING · SNAPSHOT {data.latest} · {data.rows.length} FAMILIES</> : null}
      />
      {!compact && (
        <div className="flex flex-col gap-2 border-b border-rule p-3 lg:flex-row lg:items-center">
          <Seg label="Category" options={CATS} value={cat} onChange={setCat} />
          <Seg label="Sort" options={SORTS} value={sort} onChange={setSort} />
          <QueryBar label="Filter by family name" placeholder="FILTER FAMILY" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {isLoading ? (
        <div className="p-3"><Loading /></div>
      ) : error ? (
        <div role="alert" className="p-3 text-live">The type index couldn’t load ({String((error as Error).message)}). Try again in a minute.</div>
      ) : !data || data.rows.length === 0 ? (
        <Empty why="No Google Fonts snapshot yet. Rankings are collected once a day, so the index fills in after the next daily run." />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr>
                <th scope="col" className={`${th} text-right`}>RANK<Info g="rank" /></th>
                <th scope="col" className={`${th} text-left`}>FAMILY<Info g="family" /></th>
                {!compact && <th scope="col" className={`${th} text-left ${hideSm}`}>CAT<Info g="category" /></th>}
                {!compact && <th scope="col" className={`${th} text-center ${hideSm}`}>VF<Info g="variable" /></th>}
                <th scope="col" className={`${th} text-right ${hideSm}`}>POP Δ7D<Info g="pop-7d" /></th>
                <th scope="col" className={`${th} text-right`}>{compact ? "Δ28D" : "POP Δ28D"}<Info g="pop-28d" /></th>
                <th scope="col" className={`${th} text-right`}>TRND<Info g="trending" /></th>
                {!compact && <th scope="col" className={`${th} text-left`}>STAGE<Info g="stage" /></th>}
                <th scope="col" className={`${th} text-left ${hideSm}`}>28D<Info g="sparkline-28d" /></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.family}
                  tabIndex={0}
                  onClick={() => (compact ? onOpenFull?.() : setOpen(r))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") compact ? onOpenFull?.() : setOpen(r);
                  }}
                  className="h-10 cursor-pointer border-b border-rule hover:bg-g900 focus-visible:bg-g900 md:h-8"
                >
                  <td className="num px-2 text-g500">{r.popularity_rank}</td>
                  <td className="truncate px-2 font-semibold text-ink">{r.family}</td>
                  {!compact && <td className={`label px-2 text-g500 ${hideSm}`}>{catShort(r.category)}</td>}
                  {!compact && <td className={`px-2 text-center text-ink ${hideSm}`}>{r.is_variable ? "●" : ""}</td>}
                  <td className={`num px-2 ${hideSm}`}><Delta v={r.delta7} /></td>
                  <td className="num px-2"><Delta v={r.delta28} /></td>
                  <td className="num px-2 text-ink">{r.trending_rank}</td>
                  {!compact && <td className="px-2"><BandTag band={r.band} /></td>}
                  <td className={`px-2 ${hideSm}`}><Sparkline ranks={spark?.get(r.family)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!compact && pages > 1 && (
            <div className="label flex items-center justify-between border-b border-rule p-3 text-g500">
              <button className="h-10 px-2 hover:text-ink disabled:opacity-40 md:h-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>◀ PREV</button>
              <span className="tabular-nums">PAGE {page + 1}/{pages} · {filtered.length} ROWS</span>
              <button className="h-10 px-2 hover:text-ink disabled:opacity-40 md:h-8" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>NEXT ▶</button>
            </div>
          )}
        </div>
      )}
      {open && <Drawer row={open} latest={data?.latest ?? ""} onClose={() => setOpen(null)} />}
    </section>
  );
}

function useGoogleFont(family: string) {
  useEffect(() => {
    const id = `gf-${family.replace(/\W/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

function Drawer({ row, latest, onClose }: { row: FamilyRow; latest: string; onClose: () => void }) {
  const { data: hist, isLoading } = useQuery(familyHistoryQuery(row.family));
  useGoogleFont(row.family);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const full = hist && hist.length ? computeBand(hist) : row;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-void/70" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${row.family} detail`}
        className="flex h-full w-full flex-col overflow-y-auto border-l border-rule bg-void md:w-[420px] xl:w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-rule bg-g900 px-3">
          <span className="label text-g500">DETAIL</span>
          <button autoFocus onClick={onClose} className="label h-10 px-2 text-g500 hover:text-ink md:h-8">ESC ✕</button>
        </div>
        <div className="border-b border-rule p-3">
          <div className="text-hero font-semibold text-ink break-words md:text-mega">{row.family}</div>
          <div className="label mt-2 text-g500">[FONT] · {row.category.toUpperCase()}{row.is_variable ? " · VARIABLE" : ""}</div>
        </div>
        <dl className="grid grid-cols-4 border-b border-rule">
          {[
            ["POP", `#${row.popularity_rank}`],
            ["TRND", `#${row.trending_rank}`],
            ["Δ7D", <Delta key="7" v={full.delta7} />],
            ["Δ28D", <Delta key="28" v={full.delta28} />],
          ].map(([k, v], i) => (
            <div key={i} className="border-r border-rule p-3 last:border-r-0">
              <dt className="label text-g500">{k}</dt>
              <dd className="text-hero tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-b border-rule p-3">
          <BandTag band={full.band} /> <span className="text-g500">— {full.reason}</span>
        </div>
        <div className="border-b border-rule p-3">
          <div className="label mb-2 text-g500">POPULARITY RANK · HISTORY (▲ = CLIMBING)</div>
          {isLoading ? <Loading /> : <LineChart points={(hist ?? []).map((h) => ({ date: h.captured_on, rank: h.popularity_rank }))} />}
        </div>
        <div className="border-b border-rule p-3">
          <div className="label mb-2 text-g500">SPECIMEN</div>
          <p className="break-words text-ink" style={{ fontFamily: `"${row.family}", var(--tk-font-mono)`, fontSize: 28, lineHeight: "36px" }}>
            The quick brown fox — 0123456789
          </p>
        </div>
        <div className="p-3">
          <div className="label mb-1 text-g500">RECEIPTS</div>
          <div className="label text-ink">
            SOURCE Google Fonts Developer API · SNAPSHOT {latest} · {hist?.length ?? "…"} DAYS OF HISTORY
          </div>
        </div>
      </aside>
    </div>
  );
}
