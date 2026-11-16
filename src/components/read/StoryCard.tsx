// STORY in both modes: a Read card (kicker → headline → deck → time + receipts) and a dense Terminal row.
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { Story } from "@/lib/stories";
import { storyTime } from "@/lib/stories";
import { AppLink } from "@/components/terminal/AppLink";
import { BasisWord } from "@/components/digest/Editorial";
import { BasisChip } from "@/components/terminal/SignalBits";
import { numberLabel } from "@/lib/stories/numbers";

export function Receipt({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return href.startsWith("/") ? <AppLink href={href} {...rest}>{children}</AppLink> : <a href={href} target="_blank" rel="noopener" {...rest}>{children}</a>;
}
export function StoryCard({ s, lead = false, tour }: { s: Story; lead?: boolean; tour?: string | undefined }) {
  return <article className={lead ? "" : "ed-hair pt-4"} data-tour={tour}>
    <p className="ed-kicker flex flex-wrap items-center gap-2">{s.kicker}{s.basis && <BasisWord b={s.basis} />}</p>
    <h3 className={`${lead ? "ed-h1" : "ed-h3"} mt-2`}><Receipt href={s.evidence} className="no-underline hover:underline">{s.headline}</Receipt></h3>
    {s.deck && <p className={`${lead ? "ed-standfirst mt-4" : "ed-small mt-2"}`}>{s.deck}</p>}
    <p className="ed-data ed-muted mt-2 flex flex-wrap gap-x-3">{s.number != null && <span>{numberLabel(s.number)}</span>}<time dateTime={s.at}>{storyTime(s.at)}</time>{s.corrected && <span>Corrected {s.corrected.slice(0, 10)}</span>}<Receipt href={s.evidence} className="ed-tap">{s.evidence.startsWith("/") ? "Receipts →" : "Source ↗"}</Receipt></p>
  </article>;
}
/** RELATED block list on signal, brand and pattern pages. */
export function RelatedStories({ stories, empty }: { stories: Story[]; empty: string }) {
  return stories.length ? <div className="grid grid-cols-1 gap-8 md:grid-cols-2">{stories.map(s => <StoryCard key={s.id} s={s} />)}</div> : <p className="ed-small">{empty}</p>;
}
/** The compact story card (terminal row): one token-driven rendering for every mode, so it reads right on the dark terminal, the Read
 * pages and the kit. `kicker`, `line` and `time` let the front page's live column add its type chip, one line and relative time. */
/** The compact story row. `n` is the row's left column: a position, or the story's permanent number ("NO. 48") with `wide`. */
export function StoryRow({ s, n, tour, id, kicker, line, time, wide }: { s: Story; n?: number | string | undefined; tour?: string | undefined; id?: string | undefined; kicker?: ReactNode; line?: string | null | undefined; time?: ReactNode; wide?: boolean }) {
  return <li className="tk-row" id={id}>
    <Receipt href={s.evidence} data-tour={tour} className={`tk-row-link group grid min-h-11 gap-x-2 gap-y-1 p-3 ${wide ? "grid-cols-[8ch_1fr] md:grid-cols-[8ch_1fr_auto]" : "grid-cols-[3ch_1fr] md:grid-cols-[3ch_1fr_auto]"}`}>
      <span className={`num label ${wide ? "tk-row-ink" : "tk-row-muted"}`} data-story-number={wide ? "" : undefined}>{n ?? "·"}</span>
      <span className="tk-row-ink min-w-0">{kicker ?? <span className="label tk-row-muted">{s.kicker.toUpperCase()} · </span>}<span className="group-hover:underline">{s.headline}</span>{s.basis && <> <BasisChip basis={s.basis} /></>} <span aria-hidden>→</span>{line && <span className="tk-row-line">{line}</span>}</span>
      <span className="label tk-row-muted col-start-2 md:col-start-3">{time ?? <time dateTime={s.at}>{storyTime(s.at).toUpperCase()}</time>}</span>
    </Receipt>
  </li>;
}
