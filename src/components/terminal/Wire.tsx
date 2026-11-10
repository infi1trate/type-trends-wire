import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { wireQuery, type WireItem } from "@/lib/data";
import { Empty, Loading, PanelHeader, QueryBar, Seg } from "./primitives";

const TAGS = ["ALL", "TYPE", "COLOR", "BRAND", "UI", "WEB", "MOTION", "AI"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (s: string) => {
  const d = new Date(s);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** Subscribe once to realtime INSERTs; prepends into the wire cache and reports new ids. */
export function useWireRealtime(onNew: (id: number) => void) {
  const qc = useQueryClient();
  const cb = useRef(onNew);
  cb.current = onNew;
  useEffect(() => {
    const ch = supabase
      .channel(`wire-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wire_items" }, (payload) => {
        const row = payload.new as WireItem;
        qc.setQueryData<WireItem[]>(["wire"], (old) => [row, ...(old ?? []).filter((o) => o.id !== row.id)].slice(0, 200));
        qc.invalidateQueries({ queryKey: ["wire-24h"] });
        cb.current(row.id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

export function Wire({ compact = false, freshIds }: { compact?: boolean; freshIds: Set<number> }) {
  const { data, isLoading, error } = useQuery(wireQuery());
  const [tag, setTag] = useState<(typeof TAGS)[number]>("ALL");
  const [source, setSource] = useState("ALL");
  const [q, setQ] = useState("");

  const sources = useMemo(() => [...new Set((data ?? []).map((d) => d.source))].sort(), [data]);
  const rows = useMemo(() => {
    const all = data ?? [];
    if (compact) return all.slice(0, 15);
    const ql = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (tag === "ALL" || r.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) &&
        (source === "ALL" || r.source === source) &&
        (!ql || r.title.toLowerCase().includes(ql) || (r.excerpt ?? "").toLowerCase().includes(ql)),
    );
  }, [data, tag, source, q, compact]);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Wire">
      <PanelHeader title={compact ? "WIRE · LATEST 15" : "F8 WIRE"} meta={<span aria-live="polite">{rows.length} ITEMS</span>} />
      {!compact && (
        <div className="flex flex-col gap-2 border-b border-rule p-3 lg:flex-row lg:items-center">
          <Seg label="Tag" options={TAGS} value={tag} onChange={setTag} />
          <label className="flex h-10 items-center border border-rule md:h-8">
            <span className="sr-only">Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="label h-full bg-void px-2 text-ink outline-none"
            >
              <option value="ALL">ALL SOURCES</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <QueryBar label="Filter wire" placeholder="FILTER TITLE / EXCERPT" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {isLoading ? (
        <div className="p-3"><Loading /></div>
      ) : error ? (
        <div className="label p-3 text-signal">ERR · {String((error as Error).message)}</div>
      ) : rows.length === 0 ? (
        (data ?? []).length === 0 ? <Empty /> : <div className="label p-3 text-g500">NO MATCHES</div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`group relative flex min-h-10 items-baseline gap-3 border-b border-rule px-3 py-2 hover:bg-g900 md:min-h-8 md:py-1.5 ${
                freshIds.has(r.id) ? "animate-slide-in new-rule" : ""
              }`}
            >
              <time className="shrink-0 tabular-nums text-g500">{hhmm(r.published_at)}</time>
              <span className="label hidden w-[18ch] shrink-0 truncate text-g500 sm:inline">{r.source.toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">
                  {r.title}
                </a>
                <span className="label ml-2 text-g500 sm:hidden">{r.source.toUpperCase()}</span>
                {r.tags.length > 0 && (
                  <span className="label ml-2 text-g500">{r.tags.map((t) => `[${t.toLowerCase()}]`).join(" ")}</span>
                )}
              </span>
              {r.excerpt && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-3 right-3 top-full z-20 hidden border border-rule bg-void p-2 text-g500 group-hover:block"
                >
                  {r.excerpt.slice(0, 280)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
