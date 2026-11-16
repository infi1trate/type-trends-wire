// A DATA STORY page: the question, the picture you step through, one or two sentences per step, and the same ending every time.
// Without JavaScript (and in print) every step renders as a readable sequence of figure plus caption; once hydrated it becomes a stepper:
// the picture stays in view while captions advance by arrow keys, J / K, Previous / Next, Home / End or scrolling.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useHydrated } from "@tanstack/react-router";
import type { Caption, StoryModel } from "@/lib/data-stories/types";
import { capText, isNum, dayText, pctText } from "@/lib/data-stories/text";
import { announcement, applyAction, clampStep, counter, keyAction } from "@/lib/data-stories/stepper";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { Receipt } from "@/components/read/StoryCard";
import { FigureView } from "./Figures";
import { Deferred } from "@/components/read/Deferred";
import type { Figure } from "@/lib/data-stories/types";

const figureName = (f: Figure) => ("title" in f && f.title ? f.title : "Figure");
import { Raised } from "@/components/brand/Containers";
import { FiltersScope, Trail } from "@/components/brand/Illustration";
import { coverTrail, type CoverTrail } from "@/lib/data-stories/cover";

export function CaptionText({ c }: { c: Caption }) {
  return <>{c.map((s, k) => (typeof s === "string" ? <span key={k}>{s}</span> : <Receipt key={k} href={s.href} className="underline decoration-1 underline-offset-2" data-num={isNum(s) ? "" : undefined}>{isNum(s) ? s.n : s.r}</Receipt>))}</>;
}
export function StoryHead({ s, kicker, trail }: { s: Pick<StoryModel, "number" | "question" | "deck" | "template" | "dataThrough">; kicker?: ReactNode; trail?: CoverTrail | null }) {
  const text = <>
    <p className="ed-kicker flex flex-wrap gap-x-3"><Link to="/data" className="ed-tap no-underline">Data story {s.number}</Link><span>{s.template}</span>{kicker}</p>
    <h1 className="ed-h1 mt-3 max-w-[22ch]">{s.question}</h1>
    <p className="ed-standfirst mt-4 max-w-[60ch]">{s.deck}</p>
    {s.dataThrough && <p className="ed-data ed-muted mt-3">Data through <time dateTime={s.dataThrough}>{dayText(s.dataThrough)}</time></p>}
  </>;
  if (!trail) return <header className="ed-wrap pt-8 md:pt-12">{text}</header>;
  // The cover: the story's own series as the trail, beside the question (one illustration in the viewport).
  return <FiltersScope><header className="ed-wrap grid grid-cols-1 gap-8 pt-8 md:pt-12 lg:grid-cols-12" data-cover="data-story">
    <div className="lg:col-span-7">{text}</div>
    <div className="lg:col-span-5 lg:self-end"><Trail points={trail.points} label={trail.label} format={trail.unit === "share" ? pctText : String} w={520} h={300} seed={s.number} /></div>
  </header></FiltersScope>;
}
export function StoryEnding({ s }: { s: StoryModel }) {
  return <footer className="ed-wrap mt-16" aria-labelledby="ds-basis">
    <h2 id="ds-basis" className="ed-h3 ed-rule pt-3">What the numbers are based on</h2>
    <dl className="ed-data mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
      <div><dt className="ed-muted">Brands</dt><dd>{s.basis.brands}</dd></div><div><dt className="ed-muted">Captures</dt><dd>{s.basis.captures}</dd></div><div><dt className="ed-muted">Period</dt><dd>{s.basis.period}</dd></div>
    </dl>
    <p className="ed-small mt-3 max-w-[70ch]">{s.basis.rule} <Link to="/what-we-show" className="ed-tap">How we measure →</Link></p>
    {s.basis.lines.map(l => <p key={l} className="ed-small ed-muted mt-1 max-w-[70ch]">{l}</p>)}
    <p className="ed-data mt-6">Browse the collection: <Receipt href={s.collection.href} className="ed-tap underline">{s.collection.label} →</Receipt></p>
    <h3 className="ed-kicker mt-6">Related</h3>
    <ul className="mt-2 grid gap-1">{s.related.map(r => <li key={r.href}><Receipt href={r.href} className="ed-tap underline">{r.label}</Receipt></li>)}</ul>
  </footer>;
}

/** The no-JS / print sequence: one block per step, figure then caption. Before hydration only the first step's figure is drawn (the stepper
 * takes over straight after); the others draw as they come near the screen, and all of them draw for printing. */
export function StepSequence({ s, full = false }: { s: StoryModel; full?: boolean }) {
  return <ol className="ed-wrap mt-10 grid gap-12" data-sequence="">{s.steps.map((st, k) => { const fig = s.figures[st.view.figure];
    return <li key={st.id} id={`step-${k + 1}`} className="break-inside-avoid" data-step={k + 1}>
      <p className="ed-kicker">{counter(k, s.steps.length)}</p>
      {fig && <div className="mt-2"><Deferred eager={full || k === 0} label={figureName(fig)} style={{ minHeight: "18rem" }} noscript={<a href={`?figures=all#step-${k + 1}`} className="ed-tap ed-data underline">Draw this step's figure ({figureName(fig)}) →</a>}><FigureView fig={fig} view={st.view} /></Deferred></div>}
      <p className="ed-body mt-3 max-w-[60ch]"><CaptionText c={st.caption} /></p>
    </li>; })}</ol>;
}

export function Stepper({ s, step, onStep }: { s: StoryModel; step: number; onStep: (k: number) => void }) {
  const n = s.steps.length, k = clampStep(step, n), cur = s.steps[k]!, fig = s.figures[cur.view.figure];
  const [said, setSaid] = useState(""), prev = useRef<number | null>(null), root = useRef<HTMLDivElement>(null), blocks = useRef<(HTMLLIElement | null)[]>([]);
  const quiet = useRef(0);
  const reduce = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // One polite announcement per change, whatever moved the step.
  useEffect(() => { const a = announcement(prev.current, k, n, capText(cur.caption)); if (prev.current !== null && a) setSaid(a); prev.current = k; }, [k, n, cur]);
  const go = useCallback((j: number, scroll = true) => {
    const t = clampStep(j, n);
    if (t === k) return;
    onStep(t);
    if (scroll) { quiet.current = Date.now() + 700; blocks.current[t]?.scrollIntoView?.({ behavior: reduce() ? "auto" : "smooth", block: "center" }); }
  }, [k, n, onStep]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const inside = root.current?.contains(e.target as Node) || e.target === document.body;
      if (!inside) return;
      const a = keyAction({ key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, target: e.target as HTMLElement });
      if (!a) return;
      e.preventDefault(); go(applyAction(k, a, n));
    };
    document.addEventListener("keydown", on); return () => document.removeEventListener("keydown", on);
  }, [go, k, n]);
  // Deep link: open at ?step= by jumping to its caption block, before scroll stepping takes over.
  useEffect(() => { if (k > 0) { quiet.current = Date.now() + 1200; blocks.current[k]?.scrollIntoView?.({ behavior: "auto", block: "center" }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Scrolling: the caption block crossing the reading line is the current step (mid-screen when wide; below the sticky picture when narrow).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(es => { if (Date.now() < quiet.current) return; const hit = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (hit) { const j = Number((hit.target as HTMLElement).dataset["step"]) - 1; if (Number.isFinite(j)) onStep(clampStep(j, n)); } }, { rootMargin: window.innerWidth >= 1024 ? "-45% 0px -45% 0px" : "-78% 0px -12% 0px", threshold: [0, 0.5, 1] });
    blocks.current.forEach(b => b && io.observe(b)); return () => io.disconnect();
  }, [n, onStep]);
  return <div ref={root} className="ed-wrap mt-8 lg:grid lg:grid-cols-12 lg:gap-10" data-stepper="" data-composition="data-story">
    <div className="sticky top-0 z-10 self-start border-b py-3 lg:col-span-7 lg:top-4 lg:border-b-0" data-stepper-picture="" style={{ background: "var(--tk-surface-page)", borderColor: "var(--tk-rule-hairline)" }}>
      <div className="max-h-[46vh] overflow-y-auto lg:max-h-none lg:overflow-visible">{fig && <FigureView fig={fig} view={cur.view} live />}</div>
      <div className="no-print mt-3 flex items-center gap-2" role="group" aria-label="Step through the story">
        <Raised className="tk-t-kicker" onClick={() => go(k - 1)} disabled={k === 0} aria-label="Previous step">← Previous</Raised>
        <span className="tk-t-data min-w-[8ch] text-center" data-counter="">{counter(k, n)}</span>
        <Raised className="tk-t-kicker" onClick={() => go(k + 1)} disabled={k >= n - 1} aria-label="Next step">Next →</Raised>
        <span className="tk-t-caption tk-c-muted ml-auto hidden md:inline">← → or J K to step · Home / End</span>
      </div>
      <p className="ed-small mt-2 lg:hidden" aria-hidden="true" data-current-caption=""><CaptionText c={cur.caption} /></p>
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-announce="">{said}</p>
    </div>
    <ol className="mt-4 lg:col-span-5 lg:mt-0" aria-label="Steps">{s.steps.map((st, j) => <li key={st.id} ref={el => { blocks.current[j] = el; }} data-step={j + 1} aria-current={j === k ? "step" : undefined}
      className="flex min-h-[40vh] items-center py-6 first:pt-2 last:min-h-[30vh] lg:min-h-[55vh] lg:last:min-h-[40vh]">
      <p data-container={j === k ? "card" : "sheet"} className={`${j === k ? "c-card" : "c-sheet step-card-rest"} ed-body w-full max-w-[46ch] transition-colors duration-200 motion-reduce:transition-none`}>
        <span className="step-num block" aria-hidden="true">{String(j + 1).padStart(2, "0")}</span><span className="ed-kicker block">{counter(j, n)}</span><CaptionText c={st.caption} />
      </p>
    </li>)}</ol>
  </div>;
}

/** Sequence before hydration and while printing; the stepper after. */
export function StoryBody({ s, step, onStep, allFigures = false }: { s: StoryModel; step: number; onStep: (k: number) => void; allFigures?: boolean }) {
  const hydrated = useHydrated(), [printing, setPrinting] = useState(false);
  useEffect(() => {
    const b = () => flushSync(() => setPrinting(true)), a = () => setPrinting(false);
    window.addEventListener("beforeprint", b); window.addEventListener("afterprint", a);
    return () => { window.removeEventListener("beforeprint", b); window.removeEventListener("afterprint", a); };
  }, []);
  return !hydrated || printing ? <StepSequence s={s} full={printing || allFigures} /> : <Stepper s={s} step={step} onStep={onStep} />;
}

export function DataStoryView({ s, step, onStep, allFigures = false }: { s: StoryModel; step: number; onStep: (k: number) => void; allFigures?: boolean }) {
  return <DigestShell label="Data stories" section="signals">
    <article className="digest-data pb-8" data-story={s.slug}>
      <StoryHead s={s} trail={coverTrail(s)} />
      <StoryBody s={s} step={step} onStep={onStep} allFigures={allFigures} />
      <StoryEnding s={s} />
    </article>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
