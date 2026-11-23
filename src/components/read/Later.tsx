// P1 · shell first: one boundary for content that arrives after the page shell. Until it is in, the slot holds placeholder blocks in
// the page's surface tint with the same outer size as the content (row heights for lists, the real aspect ratio for pictures and
// charts, line-height blocks for text), so nothing moves when it lands. A soft highlight sweeps across the blocks every 1.6 s
// ("glisten"); with reduced motion the blocks stay still. Placeholders are aria-hidden and the slot is aria-busy until its content is
// in; no loading words. If the section fails, only this slot shows the plain failed line (voice.ts) with a retry.
import { Component, Suspense, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { laterFocus } from "@/lib/route-focus";
import { QueryClientContext, QueryErrorResetBoundary, type QueryClient } from "@tanstack/react-query";
import { say } from "@/lib/voice";

/** One placeholder shape. Sizes are the content's own: a list row's height, a picture's width/height ratio, text lines. */
export type Shape =
  | { kind: "rows"; n: number; height: number; gap?: number }
  | { kind: "picture"; ratio: number; maxWidth?: number }
  | { kind: "text"; lines: number; width?: string }
  | { kind: "block"; height: number };
/** Row heights the Read lists use (ledger row with one fact line; compact story row), in CSS pixels. */
export const ROW = { ledger: 76, compact: 52, tile: 44, terminal: 24 } as const;

const line = (k: number, width = "100%"): CSSProperties => ({ height: "1lh", width: k % 3 === 2 ? "62%" : width });
export function Placeholder({ shapes, className = "" }: { shapes: readonly Shape[]; className?: string }) {
  return <div aria-hidden="true" data-placeholder="" className={`ph ${className}`}>{shapes.map((s, i) => {
    switch (s.kind) {
      case "rows": return <div key={i} className="ph-rows" style={{ display: "grid", rowGap: s.gap ?? 0 }}>{Array.from({ length: s.n }, (_, k) => <span key={k} className="ph-b ph-row" style={{ height: s.height }} />)}</div>;
      case "picture": return <span key={i} className="ph-b" style={{ display: "block", aspectRatio: String(s.ratio), maxWidth: s.maxWidth }} />;
      case "text": return <div key={i} className="ph-text">{Array.from({ length: s.lines }, (_, k) => <span key={k} className="ph-b ph-line" style={line(k, s.width)} />)}</div>;
      case "block": return <span key={i} className="ph-b" style={{ display: "block", height: s.height }} />;
    }
  })}</div>;
}

class Catch extends Component<{ children: ReactNode; onReset: () => void; failed: (retry: () => void) => ReactNode }, { error: boolean }> {
  override state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  override componentDidCatch(e: unknown) { console.error("deferred section failed", e instanceof Error ? e.message.slice(0, 120) : "UnknownError"); }
  override render() { return this.state.error ? this.props.failed(() => { this.props.onReset(); this.setState({ error: false }); }) : this.props.children; }
}
export function SectionFailed({ retry }: { retry: () => void }) {
  const v = say("read.section.failed");
  return <p className="ed-small" role="status" data-later-failed="">{v.text} <button type="button" onClick={retry} className="ed-tap cursor-pointer underline">{v.next[0]?.label}</button></p>;
}
/** S1 polish · a retry starts the failed reads afresh: a read that failed while the page was being sent arrives in the browser as a
 *  finished failure, and resetting the boundary alone then shows the part with no data and never asks again. Dropping the failed
 *  entries makes the slot's own read run again when it comes back (placeholder first, then the content). */
function dropFailed(qc: QueryClient | undefined) { qc?.removeQueries({ predicate: q => q.state.status === "error" }); }
/** S1 polish · one region's failures (the front page's rail, its left column): when several of its slots fail, the failed line is shown
 *  once, in the first failed slot in page order, and its one "Try again" retries every failed slot of the region. The others stay
 *  empty. Pure bookkeeping, so tests can drive it. */
export type FailStore = { order: () => number; add: (k: number, retry: () => void) => void; drop: (k: number) => void; first: () => number | null; retryAll: () => void; subscribe: (f: () => void) => () => void; version: () => number };
export function failStore(): FailStore {
  let n = 0, v = 0;
  const failed = new Map<number, () => void>(), subs = new Set<() => void>();
  const emit = () => { v++; subs.forEach(f => f()); };
  return {
    order: () => n++,
    add: (k, retry) => { failed.set(k, retry); emit(); },
    drop: k => { if (failed.delete(k)) emit(); },
    first: () => (failed.size ? Math.min(...failed.keys()) : null),
    retryAll: () => { for (const r of [...failed.values()]) r(); },
    subscribe: f => { subs.add(f); return () => { subs.delete(f); }; },
    version: () => v,
  };
}
const FailCtx = createContext<FailStore | null>(null);
/** Wrap the slots of one page region; they then share one failed line and one retry. */
export function FailGroup({ children }: { children: ReactNode }) {
  const [s] = useState(failStore);
  return <FailCtx.Provider value={s}>{children}</FailCtx.Provider>;
}
const noSub = () => () => undefined, zero = () => 0;
function Failed({ retry, order }: { retry: () => void; order: number | null }) {
  const g = useContext(FailCtx);
  const latest = useRef(retry); latest.current = retry;
  useSyncExternalStore(g?.subscribe ?? noSub, g?.version ?? zero, zero);
  useLayoutEffect(() => {
    if (!g || order == null) return;
    g.add(order, () => latest.current());
    return () => g.drop(order);
  }, [g, order]);
  if (!g || order == null) return <SectionFailed retry={retry} />;
  return g.first() === order ? <SectionFailed retry={g.retryAll} /> : null;
}
/** The slot once its content is in: if route focus was waiting on the placeholder's heading, the real heading takes it. */
function Ready({ children, id, className }: { children: ReactNode; id?: string | undefined; className?: string | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!laterFocus.pending) return;
    const a = document.activeElement, h = ref.current?.querySelector<HTMLElement>("h1");
    if (!h || (a && a !== document.body && document.contains(a))) return;
    laterFocus.pending = false;
    if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
  }, []);
  return <div ref={ref} data-later="" data-later-ready="" id={id} className={className}>{children}</div>;
}
/** A deferred slot: placeholders (aria-busy) until the children's data is in; a failure stays inside the slot. `before` is drawn
 * above the placeholders only (a page's title block, when the whole page body is the deferred part and draws its own). */
/** P2 · `reserve` is a minimum height for the placeholder only (for example "100dvh" when the whole page body streams in): the slot
 *  then already reaches past the bottom of the screen, so the footer is never on screen to be pushed down when the content lands. */
export function Later({ children, shapes, className, id, before, reserve, placeholderClassName }: { children: ReactNode; shapes: readonly Shape[]; className?: string; id?: string; before?: ReactNode; reserve?: string; placeholderClassName?: string }) {
  const g = useContext(FailCtx), qc = useContext(QueryClientContext);
  const [order] = useState(() => g?.order() ?? null);
  return <QueryErrorResetBoundary>{({ reset }) => <Catch onReset={() => { dropFailed(qc); reset(); }} failed={retry => <div data-later="" id={id} className={className}>{before}<div className={before ? "ed-wrap mt-8" : undefined}><Failed retry={retry} order={order} /></div></div>}>
    <Suspense fallback={<div data-later="" id={id} className={className} aria-busy="true" data-later-reserve={reserve ? "" : undefined} style={reserve ? { minHeight: reserve } : undefined}>{before}<Placeholder shapes={shapes} className={before ? "ed-wrap mt-8" : placeholderClassName ?? ""} /></div>}>
      <Ready id={id} className={className}>{children}</Ready>
    </Suspense>
  </Catch>}</QueryErrorResetBoundary>;
}
/** A page title block for a placeholder slot: the same classes as the views' own headers, so the swap doesn't move the title. */
export function TitleBlock({ kicker, title, deck, h1 = "ed-cover", wrap = "ed-wrap pt-8 md:pt-12" }: { kicker: ReactNode; title: ReactNode; deck?: ReactNode; h1?: string; wrap?: string }) {
  return <header className={wrap}><p className="ed-kicker">{kicker}</p><h1 className={`${h1} mt-3 break-words`}>{title}</h1>{deck === undefined ? <div className="mt-5 max-w-[62ch]"><Placeholder shapes={[{ kind: "text", lines: 2 }]} /></div> : deck}</header>;
}
