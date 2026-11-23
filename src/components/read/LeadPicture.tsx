// I3 · renders one lead-picture plan (src/lib/lead-picture.ts) in an existing picture slot: fixed 3:2 boxes, a pair side by side
// (stacked below 480 px), a 2×2 mosaic, the counted headlines set in type, measured colour swatches, or the brand's own social card.
// Every picture keeps its credit, live-site link and "Report this image"; the lead slot loads eagerly, everything else lazily.
import { Link } from "@tanstack/react-router";
import { sharedLine, type LeadItem, type LeadPlan } from "@/lib/lead-picture";
import { hexName } from "@/lib/agency/changes";
import { Swatches, pr } from "@/components/digest/Editorial";
import { BrandMark } from "./BrandMark";
import { LEAD_SIZES } from "@/lib/first-paint";

/** `high` (C1b): whether the picture asks for high priority; by default every eager picture does. Today's stack asks it for its first
 *  picture only (the one its first flush announces), so the second does not compete with it. */
export function LeadFigure({ i, sizes, eager, label, compact = false, bare = false, high = eager }: { i: LeadItem; sizes: string; eager: boolean; label?: string | undefined; compact?: boolean; bare?: boolean; high?: boolean }) {
  return <figure className="min-w-0" data-lead-item={i.asset.split(":")[0]}>
    {label && <p className="ed-kicker mb-2">{label}</p>}
    <a href={i.live} target="_blank" rel="noopener" aria-label={`Open ${i.domain} (live site)`} className="lead-box block" {...pr(i.live)}>
      <img src={i.src} srcSet={i.srcSet ?? undefined} sizes={i.srcSet ? sizes : undefined} width={i.width} height={i.height} alt={i.alt}
        loading={eager ? "eager" : "lazy"} fetchPriority={eager && high ? "high" : "auto"} decoding="async" />
    </a>
    {bare ? null : compact ? <figcaption className="ed-caption mt-1 flex flex-nowrap gap-x-3" data-lead-compact="">
      <a href={i.live} target="_blank" rel="noopener" className="ed-tap min-w-0" title={i.domain} {...pr(i.live)}><span className="min-w-0 truncate">{i.domain}</span></a>
      <a href={i.report} className="ed-tap shrink-0" aria-label={`Report this image of ${i.domain}`}>Report</a>
    </figcaption> : <figcaption className="ed-caption mt-1">
      <span className="block">{i.section} · {i.domain} · captured <time dateTime={i.date} className="whitespace-nowrap">{i.date}</time></span>
      <span className="flex flex-wrap gap-x-4">
        <a href={i.live} target="_blank" rel="noopener" className="ed-tap" {...pr(i.live)}>Live site ↗</a>
        <a href={i.report} className="ed-tap">Report this image</a>
      </span>
    </figcaption>}
  </figure>;
}

/** The plan as a figure, or null when the plan has nothing to show here (chart: the slot's own chart stays; none). `compact` (I3b, the
 *  front lead only): one line under each picture (the domain linking to the live site, then Report) and one shared line under the whole
 *  picture saying what the pictures are, when they were captured and which first screens rotate. Story pages keep the full captions. */
/** S1 · whether LeadPicture draws anything for this plan (a chart or "none" plan draws nothing: the slot's own chart takes the space). */
export const planDraws = (plan: LeadPlan) => (plan.kind === "pair" || plan.kind === "single" || plan.kind === "card" || plan.kind === "mosaic") ? plan.items.length > 0
  : plan.kind === "words" ? !!plan.words : plan.kind === "swatches" ? !!plan.swatches : plan.kind === "marks" ? !!plan.marks : false;

export function LeadPicture({ plan, eager = true, className = "", tileSizes = LEAD_SIZES.mosaic, compact = false, stack = false }: { plan: LeadPlan; eager?: boolean; className?: string; tileSizes?: string; compact?: boolean; stack?: boolean }) {
  const line = compact ? sharedLine(plan) : plan.caption;
  const cap = line ? <figcaption className="ed-caption mt-2" data-lead-caption="">{line}</figcaption> : null;
  const wrap = (kind: string, body: React.ReactNode) => <figure className={`min-w-0 ${className}`} data-lead-picture={kind} data-lead-rule={plan.rule}>{body}{cap}</figure>;
  // S1 · the front lead's two first screens as a composed stack from 1024 px (the first across the column, the second at 58% over its
  // lower-left corner); below that, two equal pictures side by side. Fixed 3:2 boxes either way, so nothing moves when they load.
  // S1 polish: one caption block under the whole stack, from the stack's left edge: line one names both captures in order, each with
  // its live-site link and one Report link; line two is the credit. Nothing sits between or under the overlapping pictures.
  if (stack && plan.kind === "mosaic" && plan.items.length === 2) return <figure className={`min-w-0 ${className}`} data-lead-picture="stack" data-lead-rule={plan.rule}>
    <div className="lead-stack" data-lead-stack="">
      {plan.items.map((i, k) => <div key={i.asset} className="min-w-0"><LeadFigure i={i} sizes={k === 0 ? LEAD_SIZES.stackFirst : LEAD_SIZES.stackSecond} eager={eager} high={k === 0} bare /></div>)}
    </div>
    <figcaption className="ed-caption lead-stack-cap" data-lead-caption="">
      <span className="flex flex-wrap gap-x-6" data-lead-names="">{plan.items.map(i => <span key={i.asset} className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
        <a href={i.live} target="_blank" rel="noopener" className="ed-tap min-w-0 [overflow-wrap:anywhere]" {...pr(i.live)}>{i.domain}</a>
        <span aria-hidden="true">·</span>
        <a href={i.report} className="ed-tap shrink-0" aria-label={`Report this image of ${i.domain}`}>Report</a>
      </span>)}</span>
      {line && <span className="block">{line}</span>}
    </figcaption>
  </figure>;
  if (plan.kind === "pair") return wrap("pair", <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:gap-6">
    {plan.items.map(i => <LeadFigure key={i.asset} i={i} sizes={LEAD_SIZES.pair} eager={eager} compact={compact} label={compact ? (i.role === "before" ? "Before" : "After") : `${i.role === "before" ? "Before" : "After"} · ${i.date}`} />)}
  </div>);
  if (plan.kind === "single" || plan.kind === "card") return wrap(plan.kind, <div className="max-w-[720px]">{plan.items[0] && <LeadFigure i={plan.items[0]} sizes={LEAD_SIZES.single} eager={eager} compact={compact} />}</div>);
  if (plan.kind === "mosaic") return wrap("mosaic", <ul className={`grid grid-cols-2 gap-x-4 ${compact ? "gap-y-3" : "gap-y-6"}`}>
    {plan.items.map((i, k) => <li key={i.asset} className="min-w-0"><LeadFigure i={i} sizes={tileSizes} eager={eager && k < 2} compact={compact} /></li>)}
  </ul>);
  if (plan.kind === "words" && plan.words) return wrap("words", <ul className="ledger" data-lead-words="">{plan.words.map((w, k) => <li key={k} className="ledger-row flex flex-col gap-1 px-2 py-3 md:flex-row md:items-baseline md:gap-4">
    {w.href ? <Link to="/brands/$domain" params={{ domain: w.domain ?? "" }} className="ed-tap ed-kicker inline-flex min-h-11 shrink-0 items-center md:w-40">{w.name}</Link> : <span className="ed-kicker shrink-0 md:w-40">{w.name}</span>}
    <span className="ed-h3 min-w-0 break-words">{w.line}</span>
  </li>)}</ul>);
  if (plan.kind === "swatches" && plan.swatches) return wrap("swatches", <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
    {(["before", "after"] as const).map(k => <div key={k} className="min-w-0"><p className="ed-kicker mb-2">{k === "before" ? "Before" : "After"}</p>
      <Swatches colors={plan.swatches![k].map(hex => ({ hex, name: hexName(hex) }))} label={`${plan.swatches!.domain} colours ${k}`} /></div>)}
  </div>);
  if (plan.kind === "marks" && plan.marks) return wrap("marks", <ul className="flex flex-wrap gap-4">{plan.marks.map(m => <li key={m.domain} className="ed-kicker inline-flex items-center gap-2"><BrandMark icon={m.icon} size={24} />{m.name}</li>)}</ul>);
  return null;
}
