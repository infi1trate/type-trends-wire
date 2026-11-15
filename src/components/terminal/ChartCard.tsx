import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { cardText, type CardModel } from "@/lib/chart/card";
import { stageName } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export const cardUrls = (week: string) => ({ page: `${SITE_URL}/chart/${week}`, png: `/chart/${week}.png`, portrait: `/chart/${week}-1080x1350.png`, svg: `/chart/${week}.svg` });
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

/** Chart of the Week block: the stored card image, copy/download actions and receipts. */
export function ChartOfWeek({ card, heading = true }: { card: { week: string; model: CardModel; created_at: string } | null; heading?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!card) return <p className="p-3 text-compare-muted">No chart card for this week yet. A card is drawn after each Sunday forecast once its trait has at least two usable quarters of history.</p>;
  const m = card.model, u = cardUrls(card.week), t = cardText(m);
  const copy = async () => { try { await navigator.clipboard.writeText(u.page); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } };
  return <div className="flex flex-col gap-3 p-3">
    {heading && <p className="text-body text-ink">{t.call}</p>}
    <a href={u.png} target="_blank" rel="noopener" className="block w-full max-w-[1200px] border border-rule">
      <img src={u.png} width={1200} height={675} className="block h-auto w-full" alt={`Chart of the week ${m.week}: ${t.name} quarterly share, currently ${pct(m.share)}, stage ${stageName(m.stage) ?? "not staged yet"}.`} />
    </a>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="label" onClick={() => void copy()} aria-live="polite">{copied ? "LINK COPIED" : "COPY LINK"}</Button>
      <Button asChild variant="outline" className="label"><a href={u.png} download={`dsgn-terminal-${m.week}-1200x675.png`}>DOWNLOAD PNG 1200×675</a></Button>
      <Button asChild variant="outline" className="label"><a href={u.portrait} download={`dsgn-terminal-${m.week}-1080x1350.png`}>DOWNLOAD PNG 1080×1350</a></Button>
      <Button asChild variant="outline" className="label"><a href={u.svg} target="_blank" rel="noopener">SVG</a></Button>
    </div>
    <p className="label num text-compare-muted">{t.name} [{t.dimension}] · SHARE {pct(m.share)} · N={m.n ?? "—"} · DATA THROUGH {m.data_through ?? "—"} · FORECAST RUN {m.forecast_run ?? m.run_id} · {m.origin === "call" ? `BRIEF ${m.week} CALL` : "FALLBACK: TOP BREAKOUT ALERT"} · SERIES {m.series.map(s => `${s.q} ${pct(s.s)} (N=${s.n})`).join(" · ")} · <Link to="/" search={{ panel: "brief", trait: m.trait }} className="text-ink underline">TRAIT DRAWER</Link></p>
  </div>;
}
