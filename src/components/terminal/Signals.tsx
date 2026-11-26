import { line as voiced } from "@/lib/voice";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { signalsQuery } from "@/lib/data";
import { headlineOnly, ofTier, type Signal } from "@/lib/signals";
import { judgment, TIERS, TIER_WORD, type Tier } from "@/lib/tiers";
import { type Dimension } from "@/lib/labels";
import { signalList } from "@/lib/what-we-show";
import { useSearch } from "@tanstack/react-router";
import { lensSignals } from "@/lib/sector-lens";
import { sectorName } from "@/lib/labels";
import { TraitDrawer } from "./Forecast";
import { useRestatedLine } from "@/components/read/RestatedLine";
import { Empty, Loading, PanelHeader, Seg } from "./primitives";
import { SignalTable, useTierChoice } from "./SignalBits";

/** Opens the shared signal drawer for any key. */
export function useSignalDrawer() {
  const [open, setOpen] = useState<string | null>(null);
  const node = open ? <TraitDrawer dimension={open.slice(0, open.indexOf(":"))} value={open.slice(open.indexOf(":") + 1)} onClose={() => setOpen(null)} /> : null;
  return { open: setOpen, node };
}

const byMomentum = (a: Signal, b: Signal) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || (b.share ?? 0) - (a.share ?? 0) || a.name.localeCompare(b.name);
/** Headline signals for one dimension (or a set of dimensions): the default list on each panel. */
export function HeadlineStrip({ dims, title, g, max, match }: { dims: Dimension[]; title: string; g: string; max?: number; match?: (key: string) => boolean }) {
  const { data } = useSuspenseQuery(signalsQuery()), isLoading = false;
  const drawer = useSignalDrawer(), restated = useRestatedLine();
  const { sector } = useSearch({ strict: false });
  const lens = useMemo(() => lensSignals(data.snap.rows, data.tiers, sector), [data, sector]);
  const rows = useMemo(() => headlineOnly(lens.signals).filter(s => dims.includes(s.dimension) && (!match || match(s.key))).sort(byMomentum).slice(0, max ?? 999), [lens, dims, max, match]);
  return <section aria-label={title} className="shrink-0 border-b border-rule">
    <PanelHeader title={title} g={g} meta={data ? <>{rows.length} HEADLINE · {sectorName(lens.scope).toUpperCase()} · RUN {data.snap.run_id}</> : null} />
    {restated && <p className="border-b border-rule px-3 py-2 text-g500" data-restated="">{restated}</p>}
    {lens.note && <p className="border-b border-rule px-3 py-2 text-g500">{lens.note}</p>}
    {isLoading ? <div className="p-3"><Loading /></div> : rows.length ? <div className="max-h-[50vh] overflow-auto"><SignalTable rows={rows} onOpen={drawer.open} caption={title} /></div>
      : <Empty why={voiced("terminal.signals.1")} />}
    {drawer.node}
  </section>;
}

/** F1 "All signals": headline by default; the tier filter (remembered per device) reaches supporting and archive. */
export function AllSignals({ compact = false }: { compact?: boolean }) {
  const { data } = useSuspenseQuery(signalsQuery()), isLoading = false;
  const [tier, setTier] = useTierChoice();
  const drawer = useSignalDrawer();
  const { sector } = useSearch({ strict: false });
  const lens = useMemo(() => lensSignals(data.snap.rows, data.tiers, sector), [data, sector]);
  const counts = useMemo(() => Object.fromEntries(TIERS.map(t => [t, 0])) as Record<Tier, number>, []);
  const signals = lens.signals;
  for (const t of TIERS) counts[t] = ofTier(signals, t).length;
  const rows = useMemo(() => ofTier(signals, tier).sort(byMomentum), [signals, tier]);
  const unstaged = useMemo(() => { if (tier === "headline" || !data) return []; const staged = new Set(signals.map(s => s.key)); return signalList(data.tiers).filter(r => r.tier === tier && !staged.has(r.key)); }, [data, signals, tier]);
  const opts = TIERS.map(t => `${TIER_WORD[t]} ${counts[t]}`) as unknown as readonly string[];
  return <section aria-label="All signals" className="flex min-h-0 flex-1 flex-col">
    <PanelHeader title={compact ? "SIGNALS" : "ALL SIGNALS"} g="p-all-signals" meta={data?.snap.run_id ? <>{sectorName(lens.scope).toUpperCase()} · RUN {data.snap.run_id}</> : null} />
    {lens.note && <p className="border-b border-rule px-3 py-2 text-g500">{lens.note}</p>}
    <div className="flex flex-wrap items-center gap-2 border-b border-rule p-2">
      <Seg label="Tier" options={opts} value={opts[TIERS.indexOf(tier)]!} onChange={v => setTier(TIERS[opts.indexOf(v)]!)} />
      <span className="label text-g500">{tier === "headline" ? "Shown by default everywhere." : tier === "supporting" ? "Evidence: shown inside headline signals." : "Collected, never deleted, not shown by default."}</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {isLoading ? <div className="p-3"><Loading /></div> : <SignalTable rows={rows} onOpen={drawer.open} reasons={tier !== "headline"} caption={`${TIER_WORD[tier]} signals`} />}
      {unstaged.length > 0 && <div className="border-t border-rule p-3"><h3 className="label text-g500">NOT FORECAST · {unstaged.length}</h3><ul className="mt-1 space-y-1">{unstaged.map(r => <li key={r.key} className="text-g500"><span className="text-ink">{r.name}</span> [{r.dimension}] · {judgment(r.key).why}</li>)}</ul></div>}
      {!isLoading && !rows.length && !unstaged.length && <Empty why={voiced("terminal.signals.2")} />}
    </div>
    {drawer.node}
  </section>;
}

/** Which headline signals open each panel (dimension, optionally narrowed by key). */
const COMPOSITION = new Set(["combo:soft_ui", "combo:quiet_minimal", "combo:big_type", "combo:numbers_up_front", "combo:product_led_hero"]);
export const PANEL_HEADLINES = {
  type: { dims: ["FONT"], title: "HEADLINE · TYPE" },
  color: { dims: ["COLOR"], title: "HEADLINE · COLOR" },
  layout: { dims: ["LAYOUT"], title: "HEADLINE · LAYOUT" },
  composition: { dims: ["LAYOUT", "VIBE", "FONT"], title: "HEADLINE · COMPOSITION", match: (k: string) => COMPOSITION.has(k) },
  lexicon: { dims: ["VIBE"], title: "HEADLINE · VOICE", match: (k: string) => /^(tone|ai_positioning):/.test(k) || k === "combo:ai_forward" || k === "combo:playful_brand" },
  vibe: { dims: ["VIBE"], title: "HEADLINE · VIBE" },
} satisfies Record<string, { dims: Dimension[]; title: string; match?: (k: string) => boolean }>;
export function PanelHeadlines({ panel }: { panel: keyof typeof PANEL_HEADLINES }) {
  const p = PANEL_HEADLINES[panel];
  return <HeadlineStrip dims={p.dims} title={p.title} g="p-headline" {...("match" in p ? { match: p.match } : {})} />;
}
