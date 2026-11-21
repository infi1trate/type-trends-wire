import { StoryLink } from "@/components/dataview/StoryLink";
import { useCallback, useEffect, useState } from "react";
import { BASIS_WORD, basis as basisOf, type Basis } from "@/lib/labels";
import { TIERS, TIER_WORD, type Tier } from "@/lib/tiers";
import type { Signal } from "@/lib/signals";
import { DimTag, Info, StageBadge } from "./Info";

/** MEASURED / AI ESTIMATE: one small word chip, outlined, no color. */
export function BasisChip({ k, basis, info = false }: { k?: string; basis?: Basis; info?: boolean }) {
  const b = basis ?? (k ? basisOf(k) : "measured");
  return <span className="inline-flex items-center"><span className="tk-chip inline-block whitespace-nowrap border border-dashed px-1" data-basis={b}>{BASIS_WORD[b]}</span>{info && <Info g={b === "ai" ? "basis-ai" : "basis-measured"} />}</span>;
}
export function TierChip({ tier, info = false }: { tier: Tier; info?: boolean }) {
  return <span className="inline-flex items-center"><span className="label inline-block whitespace-nowrap px-1 leading-[14px] text-g500 underline underline-offset-2">{TIER_WORD[tier]}</span>{info && <Info g={`tier-${tier}`} />}</span>;
}
/** "72 · Rising" — the one Momentum figure. */
export function MomentumText({ s }: { s: Pick<Signal, "momentum_index" | "direction"> }) {
  return <span className="label tabular-nums text-ink">{s.momentum_index ?? <span className="text-g500" title="Not ranked: no next-wave score this run (over 35% share, too few sites or a residual value).">—</span>}{s.direction ? <span className="text-g500"> · {s.direction}</span> : null}</span>;
}
export function ConfidenceText({ s }: { s: Pick<Signal, "confidence" | "confidence_reason"> }) {
  return <span className="label text-ink" title={s.confidence_reason}>{s.confidence}</span>;
}

const TIER_KEY = "dsgn.signals.tier";
/** The All signals tier filter, remembered per device. Read after hydration; storage failures fall back to memory. */
export function useTierChoice(): [Tier, (t: Tier) => void] {
  const [tier, setTier] = useState<Tier>("headline");
  useEffect(() => { try { const v = window.localStorage.getItem(TIER_KEY); if (v && (TIERS as readonly string[]).includes(v)) setTier(v as Tier); } catch { /* private mode: memory only */ } }, []);
  const set = useCallback((t: Tier) => { setTier(t); try { window.localStorage.setItem(TIER_KEY, t); } catch { /* memory only */ } }, []);
  return [tier, set];
}

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
/** Signal rows in terminal density: name [DIM] BASIS, stage, share, Momentum, Confidence. Mobile stacks each row. */
export function SignalTable({ rows, onOpen, reasons = false, caption }: { rows: Signal[]; onOpen: (key: string) => void; reasons?: boolean; caption: string }) {
  const th = "label sticky top-0 z-10 h-8 border-b border-rule bg-g900 px-2 text-left font-normal text-g500";
  return <>
    <ul className="divide-y divide-rule md:hidden" aria-label={caption}>{rows.map(s => <li key={s.key}>
      <button type="button" onClick={() => onOpen(s.key)} className="flex min-h-11 w-full flex-col gap-1 p-2 text-left hover:bg-g900 focus-visible:bg-g900">
        <span className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold text-ink">{s.name}</span><DimTag d={s.dimension} /><BasisChip basis={s.basis} /></span>
        <span className="label flex flex-wrap gap-x-3 text-g500"><StageBadge stage={s.stage} /><span>SHARE {pct(s.share)}</span><span>MOMENTUM <MomentumText s={s} /></span><span>CONFIDENCE <ConfidenceText s={s} /></span></span>
        {reasons && <span className="text-g500">{s.reasons.join(" ")}</span>}
      </button>
      <StoryLink row={{ signal: s.key }} className="px-2" />
    </li>)}</ul>
    <table className="hidden w-full border-collapse text-body md:table">
      <caption className="sr-only">{caption}</caption>
      <thead><tr>
        <th scope="col" className={th}>SIGNAL<Info g="signal" /></th>
        <th scope="col" className={th}>STAGE<Info g="stage" /></th>
        <th scope="col" className={`${th} text-right`}>SHARE<Info g="share" /></th>
        <th scope="col" className={th}>MOMENTUM<Info g="momentum-index" /></th>
        <th scope="col" className={th}>CONFIDENCE<Info g="confidence" /></th>
        {reasons && <th scope="col" className={th}>WHY THIS TIER<Info g={`tier-${rows[0]?.tier ?? "headline"}`} /></th>}
        <th scope="col" className={th}><span className="sr-only">Story</span></th>
      </tr></thead>
      <tbody>{rows.map(s => <tr key={s.key} tabIndex={0} onClick={() => onOpen(s.key)} onKeyDown={e => { if (e.key === "Enter") onOpen(s.key); }} className="h-8 cursor-pointer border-b border-rule align-middle hover:bg-g900 focus-visible:bg-g900">
        <td className="px-2"><span className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold text-ink">{s.name}</span><DimTag d={s.dimension} /><BasisChip basis={s.basis} /></span></td>
        <td className="px-2"><StageBadge stage={s.stage} /></td>
        <td className="num px-2 text-ink">{pct(s.share)}</td>
        <td className="px-2"><MomentumText s={s} /></td>
        <td className="px-2"><ConfidenceText s={s} /></td>
        {reasons && <td className="px-2 text-g500">{s.reasons.slice(1).join(" ") || s.reasons[0]}</td>}
        <td className="px-2 text-right" onClick={e => e.stopPropagation()}><StoryLink row={{ signal: s.key }} /></td>
      </tr>)}</tbody>
    </table>
  </>;
}
