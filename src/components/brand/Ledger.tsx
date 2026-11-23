// <Ledger>: the ruled index used for every list of stories, signals, brands, issues and reports (brand/README.md, "Layout moves").
// Continuous 1.5 px rules; a number column in Big Shoulders 900; the title in Newsreader; facts in Big Shoulders 700; tags as small
// capitals in ink chips; time right-aligned. Rows are links at least 44 px tall, highlighted yellow on hover and focus.
// On narrow screens a row keeps the number, the title and one fact; the rest wraps under the title.
import { isValidElement, type ReactNode } from "react";
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
  /** S1 · something set before the chips and the title in the same line box (the Tape's favicon); nothing when absent, never a hole. */
  lead?: ReactNode;
};
/** "No. 45": the figure in Big Shoulders 900 with "No." as a small label; never wraps (the list sizes the figure for its longest number). */
export const StoryNo = ({ n, blank = false }: { n: number | string; blank?: boolean }) => <span data-story-number="" className="ledger-no"><span className="ledger-no-label" {...(blank ? { "aria-hidden": true, style: { visibility: "hidden" } } : {})}>No.</span>{" "}<span className="ledger-no-fig">{n}</span></span>;
/** S1 · the figure count of a list built from LedgerItems outside <Ledger> (the live column): its longest story number. */
export const ledgerDigits = (ns: readonly (number | string | null | undefined)[]): number => Math.max(1, ...ns.map(n => (n == null ? 1 : String(n).length)));
/** S1 · a number cell holds its list's widest label: the real number and an invisible stand-in of the longest one ("0" × digits, with
 *  "No." when the list carries story numbers) share one grid cell, so every row's column is the same width in the number's own font. */
function Fit({ n, digits, story }: { n: ReactNode; digits: number; story: boolean }) {
  const ghost = "0".repeat(Math.max(1, digits));
  return <span className="ledger-fit"><span>{n}</span><span aria-hidden="true" className="ledger-ghost">{story ? <StoryNo n={ghost} /> : ghost}</span></span>;
}
const NO = /^No\.\s?(\d+)$/;
const numberOf = (n: ReactNode) => { if (typeof n !== "string") return n; const m = NO.exec(n); return m ? <StoryNo n={m[1]!} /> : n; };
/** S1 · the text of a number cell, when it can be read: a string, a number, or a StoryNo ("No. 94"). */
function labelOf(n: ReactNode): string | null {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (isValidElement(n) && n.type === StoryNo) return `No. ${String((n.props as { n: number | string }).n)}`;
  return null;
}
/** S1 · the number column of a list: none when no row has a number; otherwise as many figure widths as the longest number in THIS list
 *  (the column is `max-content`, and each figure is given that width so titles align down the list). Pure, so tests can read it. */
export function numberColumn(rows: readonly Pick<LedgerRow, "number">[]): { numbered: boolean; digits: number; story: boolean } {
  const cells = rows.map(r => r.number).filter(n => n != null && n !== "" && n !== false);
  if (!cells.length) return { numbered: false, digits: 0, story: false };
  let digits = 1, story = false;
  for (const c of cells) {
    const l = labelOf(c); if (l == null) continue;
    const m = NO.exec(l); if (m) story = true;
    digits = Math.max(digits, (m ? m[1]! : l).length);
  }
  return { numbered: true, digits, story };
}
function LinkOf({ r, children }: { r: LedgerRow; children: ReactNode }) {
  if (r.external) return <a href={r.href} className="ledger-link" target="_blank" rel="noopener">{children}<span className="sr-only"> (opens in a new tab)</span></a>;
  return r.plain ? <a href={r.href} className="ledger-link">{children}</a> : <Receipt href={r.href} receipt={r.receipt} className="ledger-link">{children}</Receipt>;
}
export function LedgerItem({ r, small, plain = false, inlineTags = false, digits = 2, story }: { r: LedgerRow; small?: boolean; plain?: boolean; inlineTags?: boolean; digits?: number; story?: boolean }) {
  const [first, ...more] = r.facts ?? [];
  const tags = r.tags && r.tags.length > 0 ? r.tags : null;
  return <li className={r.after ? "ledger-row ledger-row-split" : "ledger-row"} id={r.id} data-ledger-row="" data-drop={r.drop ? "" : undefined}>
    <LinkOf r={r}>
      {!plain && <span className={`ledger-num ${small ? "ledger-num-sm" : ""}`.trim()} data-ledger-number=""><Fit n={numberOf(r.number ?? "")} digits={digits} story={story ?? (labelOf(r.number) != null ? NO.test(labelOf(r.number)!) : isValidElement(r.number) && r.number.type === StoryNo)} /></span>}
      <span className="ledger-title">{r.lead}{tags && <span className={`ledger-tags ${inlineTags ? "" : "max-md:hidden"}`.trim()}>{tags.map(t => <span key={t} className="ledger-tag">{t}</span>)}</span>}{r.title}{r.line && <span className="ledger-line">{r.line}</span>}</span>
      <span className="ledger-fact">{first ?? ""}</span>
      {(more.length > 0 || r.time || (tags && !inlineTags)) && <span className="ledger-rest">
        {tags && !inlineTags && <span className="inline-flex gap-1 md:hidden">{tags.map(t => <span key={t} className="ledger-tag">{t}</span>)}</span>}
        {more.map((f, i) => <span key={i} className="ledger-fact">{f}</span>)}
        {r.time && <span className="ledger-time ledger-muted">{r.time}</span>}
      </span>}
    </LinkOf>
    {r.after && <span className="ledger-after">{r.after}</span>}
  </li>;
}
/** A ledger, optionally with a caption heading read by screen readers as the list's name. */
export function Ledger({ rows, label, small, className = "", inlineTags = false, children }: { rows: LedgerRow[]; label?: string; small?: boolean; className?: string; inlineTags?: boolean; children?: ReactNode }) {
  const col = numberColumn(rows);
  return <ul className={`ledger ${col.numbered ? "" : "ledger-plain"} ${className}`.replace(/\s+/g, " ").trim()} aria-label={label} data-ledger="" data-ledger-digits={col.numbered ? col.digits : undefined}>
    {rows.map(r => <LedgerItem key={r.key} r={r} plain={!col.numbered} inlineTags={inlineTags} digits={col.digits} story={col.story} {...(small ? { small } : {})} />)}{children}</ul>;
}
