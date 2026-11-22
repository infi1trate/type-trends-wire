// <Ledger>: the ruled index used for every list of stories, signals, brands, issues and reports (brand/README.md, "Layout moves").
// Continuous 1.5 px rules; a number column in Big Shoulders 900; the title in Newsreader; facts in Big Shoulders 700; tags as small
// capitals in ink chips; time right-aligned. Rows are links at least 44 px tall, highlighted yellow on hover and focus.
// On narrow screens a row keeps the number, the title and one fact; the rest wraps under the title.
import type { ReactNode } from "react";
import { Receipt } from "@/components/read/StoryCard";

export type LedgerRow = {
  key: string; href: string;
  /** The number column: a story number, a rank, an issue number. Omit for unnumbered lists. */
  number?: ReactNode;
  title: ReactNode;
  /** One line under the title (a deck, a fact sentence). */
  line?: ReactNode;
  /** Facts in Big Shoulders 700; the first is kept beside the title on narrow screens. */
  facts?: ReactNode[];
  tags?: string[];
  time?: ReactNode;
  id?: string;
  /** A plain link (a file download), not an in-app navigation. */
  plain?: boolean;
  /** U2 · the receipt this row opens in place (`change:<id>`…); without one the row navigates. */
  receipt?: string | undefined;
  /** A row that has just arrived (the live column): it drops in and settles once. */
  drop?: boolean;
  /** N3 · a link to another site: opens in a new tab (rel="noopener"); the row says so to screen readers. */
  external?: boolean;
  /** N3 · a second link beside the row's own (never nested inside it), e.g. the brand a wire pick names. */
  after?: ReactNode;
};
/** "No. 45": the figure in Big Shoulders 900 with "No." as a small label; never wraps (the column is sized for four digits). */
export const StoryNo = ({ n }: { n: number | string }) => <span data-story-number="" className="ledger-no"><span className="ledger-no-label">No.</span>{" "}<span className="ledger-no-fig">{n}</span></span>;
const NO = /^No\.\s?(\d+)$/;
const numberOf = (n: ReactNode) => { if (typeof n !== "string") return n; const m = NO.exec(n); return m ? <StoryNo n={m[1]!} /> : n; };
function LinkOf({ r, children }: { r: LedgerRow; children: ReactNode }) {
  if (r.external) return <a href={r.href} className="ledger-link" target="_blank" rel="noopener">{children}<span className="sr-only"> (opens in a new tab)</span></a>;
  return r.plain ? <a href={r.href} className="ledger-link">{children}</a> : <Receipt href={r.href} receipt={r.receipt} className="ledger-link">{children}</Receipt>;
}
export function LedgerItem({ r, small }: { r: LedgerRow; small?: boolean }) {
  const [first, ...more] = r.facts ?? [];
  return <li className={r.after ? "ledger-row ledger-row-split" : "ledger-row"} id={r.id} data-ledger-row="" data-drop={r.drop ? "" : undefined}>
    <LinkOf r={r}>
      <span className={`ledger-num ${small ? "ledger-num-sm" : ""}`.trim()} data-ledger-number="">{numberOf(r.number ?? "")}</span>
      <span className="ledger-title">{r.tags && r.tags.length > 0 && <span className="mr-2 inline-flex gap-1 align-middle max-md:hidden">{r.tags.map(t => <span key={t} className="ledger-tag">{t}</span>)}</span>}{r.title}{r.line && <span className="ledger-line">{r.line}</span>}</span>
      <span className="ledger-fact">{first ?? ""}</span>
      {(more.length > 0 || r.time || (r.tags && r.tags.length > 0)) && <span className="ledger-rest">
        {r.tags && r.tags.length > 0 && <span className="inline-flex gap-1 md:hidden">{r.tags.map(t => <span key={t} className="ledger-tag">{t}</span>)}</span>}
        {more.map((f, i) => <span key={i} className="ledger-fact">{f}</span>)}
        {r.time && <span className="ledger-time ledger-muted">{r.time}</span>}
      </span>}
    </LinkOf>
    {r.after && <span className="ledger-after">{r.after}</span>}
  </li>;
}
/** A ledger, optionally with a caption heading read by screen readers as the list's name. */
export function Ledger({ rows, label, small, className = "", children }: { rows: LedgerRow[]; label?: string; small?: boolean; className?: string; children?: ReactNode }) {
  return <ul className={`ledger ${className}`.trim()} aria-label={label} data-ledger="">{rows.map(r => <LedgerItem key={r.key} r={r} {...(small ? { small } : {})} />)}{children}</ul>;
}
