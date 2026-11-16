// STORY in both modes: a Read card (kicker → headline → deck → time + receipts) and a dense Terminal row.
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { Story } from "@/lib/stories";
import { storyTime } from "@/lib/stories";
import { AppLink } from "@/components/terminal/AppLink";
import { BasisWord } from "@/components/digest/Editorial";
import { BasisChip } from "@/components/terminal/SignalBits";

export function Receipt({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return href.startsWith("/") ? <AppLink href={href} {...rest}>{children}</AppLink> : <a href={href} target="_blank" rel="noopener" {...rest}>{children}</a>;
}
export function StoryCard({ s, lead = false, tour }: { s: Story; lead?: boolean; tour?: string | undefined }) {
  return <article className={lead ? "" : "ed-hair pt-4"} data-tour={tour}>
    <p className="ed-kicker flex flex-wrap items-center gap-2">{s.kicker}{s.basis && <BasisWord b={s.basis} />}</p>
    <h3 className={`${lead ? "ed-h1" : "ed-h3"} mt-2`}><Receipt href={s.evidence} className="no-underline hover:underline">{s.headline}</Receipt></h3>
    {s.deck && <p className={`${lead ? "ed-standfirst mt-4" : "ed-small mt-2"}`}>{s.deck}</p>}
    <p className="ed-data ed-muted mt-2 flex flex-wrap gap-x-3"><time dateTime={s.at}>{storyTime(s.at)}</time><Receipt href={s.evidence} className="ed-tap">{s.evidence.startsWith("/") ? "Receipts →" : "Source ↗"}</Receipt></p>
  </article>;
}
export function StoryRow({ s, n, tour }: { s: Story; n?: number; tour?: string | undefined }) {
  return <li className="border-b border-rule last:border-b-0">
    <Receipt href={s.evidence} data-tour={tour} className="group grid min-h-11 grid-cols-[3ch_1fr] gap-x-2 gap-y-1 p-3 hover:bg-g900 focus-visible:bg-g900 md:grid-cols-[3ch_1fr_auto]">
      <span className="num label text-g500">{n ?? "·"}</span>
      <span className="min-w-0 text-ink"><span className="label text-g500">{s.kicker.toUpperCase()} · </span><span className="group-hover:underline">{s.headline}</span>{s.basis && <> <BasisChip basis={s.basis} /></>} <span aria-hidden>→</span></span>
      <span className="label col-start-2 text-g500 md:col-start-3"><time dateTime={s.at}>{storyTime(s.at).toUpperCase()}</time></span>
    </Receipt>
  </li>;
}
