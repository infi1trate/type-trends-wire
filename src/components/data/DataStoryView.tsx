import { WhyNow } from "@/components/read/WhyNow";
import { studyBand } from "@/lib/pop/rules";
// A STUDY page (E4) reads as one piece of writing with pictures: the dark headline block, an opening, three to five scenes (on wide screens
// the figure holds while the scene paragraphs scroll past and switch its state; below 1024 px each scene draws its figure state inline
// above its paragraph), what to do with it, the limits, then 01 Evidence and 02 Related. Arrow keys and J / K move between scenes.
// The older stepper (one caption per step, Previous / Next) stays for the brand tool at /data/where-you-sit.
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
import { dataHref } from "@/lib/ia";
import { Deferred } from "@/components/read/Deferred";
import type { Figure } from "@/lib/data-stories/types";

const figureName = (f: Figure) => ("title" in f && f.title ? f.title : "Figure");
import { Raised } from "@/components/brand/Containers";
import { Ledger, StoryNo } from "@/components/brand/Ledger";
import { storyTime } from "@/lib/stories";
import { studyLabel } from "@/lib/data-stories/registry";
import { FiltersScope, Trail } from "@/components/brand/Illustration";
import { type CoverTrail } from "@/lib/data-stories/cover";
import type { StudyPage } from "@/lib/data-stories/types";
import { factsSheet, numbersInText } from "@/lib/data-stories/writer";
import { StoryCover } from "@/components/read/Covers";
import { FigureTable } from "./Tables";
import { ChartTitleQuiet } from "@/components/chartkit";
import { line as voiced } from "@/lib/voice";

export function CaptionText({ c }: { c: Caption }) {
  return <>{c.map((s, k) => (typeof s === "string" ? <span key={k}>{s}</span> : <Receipt key={k} href={s.href} drawer className="underline decoration-1 underline-offset-2" data-num={isNum(s) ? "" : undefined}>{isNum(s) ? s.n : s.r}</Receipt>))}</>;
}
export function StoryHead({ s, kicker, trail, label = "Tool" }: { s: Pick<StoryModel, "number" | "question" | "deck" | "template" | "dataThrough">; kicker?: ReactNode; trail?: CoverTrail | null; label?: string }) {
  const text = <>
    <p className="ed-kicker flex flex-wrap gap-x-3"><span>{label}</span>{kicker}</p>
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
/** The tool's ending (where-you-sit): what the numbers are based on and a way on. */
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
    <p className="ed-data mt-6"><Link to="/data" className="ed-tap inline-flex min-h-[44px] items-center">All studies →</Link></p>
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
    <div className="sticky top-0 z-10 self-start border-b py-3 lg:col-span-7 lg:top-4 lg:border-b-0" data-stepper-picture="" style={{ background: "var(--sys-color-page)", borderColor: "var(--sys-color-rule)" }}>
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

// THE STUDY PAGE (E4) ------------------------------------------------------------------------------------------------------------
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const wide = () => typeof window !== "undefined" && window.innerWidth >= 1024;
/** One numbered block in the quiet column, as the story page sets "01 Evidence" and "02 Related". */
export function StudyBlock({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="ed-wrap d-air" data-block={title.toLowerCase()}>
    <div className="d-quiet">
      <header className="d-quiet-label ed-rule pt-3"><span className="ed-kicker block">{String(n).padStart(2, "0")}</span><h2 id={id} className="ed-h3 mt-1">{title}</h2></header>
      <div className="min-w-0">{children}</div>
    </div>
  </section>;
}
const scenePara = "ed-body";
/** Text columns never pass 68 characters (inline, so it holds over the house measure on .ed-body). */
const MEASURE = { maxWidth: "68ch" } as const;
/** The scenes: on wide screens the figure holds (sticky) while the paragraphs scroll and switch its state; narrower, each scene draws its
 *  figure state inline above its paragraph. ← → J K (and Home / End) move between scenes; one polite announcement per change. */
export function Scenes({ s, scene, onScene, allFigures = false }: { s: StudyPage; scene: number; onScene: (j: number) => void; allFigures?: boolean }) {
  const n = s.scenes.length, k = clampStep(scene, n), cur = s.scenes[k], fig = cur ? s.figures[cur.view.figure] : undefined, text = s.text.scenes;
  const root = useRef<HTMLDivElement>(null), blocks = useRef<(HTMLLIElement | null)[]>([]), quiet = useRef(0), prev = useRef<number | null>(null);
  const [said, setSaid] = useState("");
  useEffect(() => { if (prev.current !== null && prev.current !== k) setSaid(`Scene ${k + 1} of ${n}. ${text[k]?.lead ?? ""}`); prev.current = k; }, [k, n, text]);
  const go = useCallback((j: number) => {
    const t = clampStep(j, n);
    if (t === k) return;
    onScene(t); quiet.current = Date.now() + 700;
    blocks.current[t]?.scrollIntoView?.({ behavior: reduced() ? "auto" : "smooth", block: wide() ? "center" : "start" });
  }, [k, n, onScene]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(root.current?.contains(e.target as Node) || e.target === document.body)) return;
      const a = keyAction({ key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, target: e.target as HTMLElement });
      if (!a) return;
      e.preventDefault(); go(applyAction(k, a, n));
    };
    document.addEventListener("keydown", on); return () => document.removeEventListener("keydown", on);
  }, [go, k, n]);
  // Deep link (?step= maps to its scene): open there before scrolling takes over.
  useEffect(() => { if (k > 0) { quiet.current = Date.now() + 1200; blocks.current[k]?.scrollIntoView?.({ behavior: "auto", block: wide() ? "center" : "start" }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Wide screens: the paragraph crossing the middle of the screen is the current scene.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !wide()) return;
    const io = new IntersectionObserver(es => { if (Date.now() < quiet.current) return; const hit = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (hit) { const j = Number((hit.target as HTMLElement).dataset["scene"]) - 1; if (Number.isFinite(j)) onScene(clampStep(j, n)); } }, { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.5, 1] });
    blocks.current.forEach(b => b && io.observe(b)); return () => io.disconnect();
  }, [n, onScene]);
  return <div ref={root} className="ed-wrap mt-[var(--sys-gap-section)] lg:grid lg:grid-cols-12 lg:gap-10" data-scenes="" data-composition="data-story">
    <div className="hidden self-start lg:sticky lg:top-4 lg:col-span-7 lg:block" data-scene-figure="">
      {fig && cur && <Deferred eager={allFigures} label={figureName(fig)} style={{ minHeight: "22rem" }}><FigureView fig={fig} view={cur.view} live /></Deferred>}
      <div className="no-print mt-3 flex items-center justify-end gap-2" role="group" aria-label="Move between scenes">
        <Raised className="tk-t-kicker min-h-[44px] min-w-[44px]" onClick={() => go(k - 1)} disabled={k === 0} aria-label="Previous scene">←</Raised>
        <Raised className="tk-t-kicker min-h-[44px] min-w-[44px]" onClick={() => go(k + 1)} disabled={k >= n - 1} aria-label="Next scene">→</Raised>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-announce="">{said}</p>
    </div>
    <ol className="lg:col-span-5" aria-label="Scenes">{s.scenes.map((sc, j) => { const f = s.figures[sc.view.figure], t = text[j];
      return <li key={sc.id} id={`scene-${j + 1}`} ref={el => { blocks.current[j] = el; }} data-scene={j + 1} aria-current={j === k ? "step" : undefined}
        className="break-inside-avoid border-t py-8 first:border-t-0 first:pt-0 lg:flex lg:min-h-[60vh] lg:items-center lg:border-t-0 lg:py-10 lg:first:pt-10" style={{ borderColor: "var(--sys-color-rule)" }}>
        <div className="w-full">
          {f && <div className="mb-5 lg:hidden" data-scene-inline=""><Deferred eager={allFigures || j === 0} label={figureName(f)} style={{ minHeight: "16rem" }} noscript={<a href={`?figures=all#scene-${j + 1}`} className="ed-tap ed-data underline">Draw this scene's figure ({figureName(f)}) →</a>}><ChartTitleQuiet.Provider value={j > 0 && s.scenes[j - 1]?.view.figure === sc.view.figure}><FigureView fig={f} view={sc.view} /></ChartTitleQuiet.Provider></Deferred></div>}
          <p className={`${scenePara} transition-colors duration-200 motion-reduce:transition-none ${j === k ? "" : "lg:opacity-60"}`} style={MEASURE}><strong className="font-semibold">{t?.lead || sc.lead}.</strong> {t?.body}</p>
        </div>
      </li>; })}</ol>
  </div>;
}
/** 01 Evidence: what the numbers are based on (with the template names), the numbers the text uses with their receipts, and the data
 *  behind the charts in one disclosure. */
export function StudyEvidence({ s }: { s: StudyPage }) {
  const nums = numbersInText(s.text, factsSheet(s));
  return <>
    <WhyNow kind="study" id={s.slug} />
    <h3 className="ed-kicker">What the numbers are based on</h3>
    <dl className="ed-data mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
      <div><dt className="ed-muted">Brands</dt><dd>{s.basis.brands}</dd></div><div><dt className="ed-muted">Captures</dt><dd>{s.basis.captures}</dd></div><div><dt className="ed-muted">Period</dt><dd>{s.basis.period}</dd></div>
    </dl>
    <p className="ed-small mt-3 max-w-[68ch]">{s.basis.rule} <Link to="/what-we-show" className="ed-tap">How we measure →</Link></p>
    {s.basis.lines.map(l => <p key={l} className="ed-small ed-muted mt-1 max-w-[68ch]">{l}</p>)}
    <p className="ed-small ed-muted mt-1 max-w-[68ch]" data-templates="">Built from: {s.template}.</p>
    {nums.length > 0 && <div className="mt-10"><h3 className="ed-kicker">The numbers</h3>
      <ul className="ledger mt-3" data-study-numbers="">{nums.map(x => <li key={x.text} className="ledger-row px-2 py-3"><span className="ed-small"><Receipt href={x.href} drawer className="ed-tap underline decoration-1 underline-offset-2">{x.text}</Receipt></span></li>)}</ul></div>}
    <div className="mt-10"><h3 className="ed-kicker">Each figure's data</h3>
      <ul className="ledger mt-3" data-study-figures="">{Object.entries(s.figures).map(([id, f]) => <li key={id} className="ledger-row px-2 py-3"><span className="ed-small"><Receipt href={`${dataHref({ type: "study", id: s.slug })}#fig-${id}`} receipt={`figure:${s.slug}:${id}`} className="ed-tap underline decoration-1 underline-offset-2">{f.title} →</Receipt></span></li>)}</ul></div>
    <FigureTables s={s} />
    <p className="ed-data mt-6">Browse the collection: <Receipt href={s.collection.href} className="ed-tap underline">{s.collection.label} →</Receipt></p>
  </>;
}
/** The data behind the charts: one disclosure; its tables are drawn when it is first opened (they would double the page's first response),
 *  and every figure keeps its own screen-reader table. */
function FigureTables({ s }: { s: StudyPage }) {
  const [open, setOpen] = useState(false);
  return <details className="mt-10" data-figure-tables="" onToggle={e => { if ((e.currentTarget as HTMLDetailsElement).open) setOpen(true); }}>
    <summary className="ed-kicker inline-flex min-h-[44px] cursor-pointer items-center">The data behind the charts</summary>
    {open && <div className="mt-3">{Object.entries(s.figures).map(([id, f]) => <FigureTable key={id} fig={f} />)}</div>}
  </details>;
}
export type StudyRelatedData = { stories: { id: string; number?: number | null | undefined; headline: string; deck?: string | undefined; kicker: string; at: string }[]; more: { label: string; href: string }[]; inWorks: boolean };
/** 02 Related: stories that fed this study, more in its series (or the shelf), then all studies. */
export function StudyRelated({ r }: { r: StudyRelatedData }) {
  return <>
    <h3 className="ed-kicker">Stories that fed this study</h3>
    {r.stories.length
      ? <Ledger className="mt-3" label="Stories that fed this study" rows={r.stories.map(x => ({ key: x.id, href: `/stories/${encodeURIComponent(x.id)}`, number: x.number != null ? <StoryNo n={x.number} /> : "·", title: x.headline, ...(x.deck ? { line: x.deck } : {}), tags: [x.kicker.split(" · ")[0] ?? x.kicker], time: <time dateTime={x.at}>{storyTime(x.at)}</time> }))} />
      : <p className="ed-small mt-3">{voiced("data.studyRelated.1")}</p>}
    <h3 className="ed-kicker mt-10">More in this series</h3>
    {r.more.length
      ? <ul className="mt-2 grid gap-1">{r.more.map(m => <li key={m.href}><Receipt href={m.href} className="ed-tap inline-flex min-h-[44px] items-center underline">{m.label} →</Receipt></li>)}</ul>
      : <p className="ed-small mt-2"><a href="/data#in-the-works" className="ed-tap inline-flex min-h-[44px] items-center underline">Next in this series is in the works.</a></p>}
    <p className="ed-data mt-6"><Link to="/data" className="ed-tap inline-flex min-h-[44px] items-center">All studies →</Link></p>
  </>;
}
export function DataStoryView({ s, scene, onScene, allFigures = false, related }: { s: StudyPage; scene: number; onScene: (j: number) => void; allFigures?: boolean; related?: ReactNode }) {
  const t = s.text;
  return <DigestShell label="Studies" section="signals">
    <article className="digest-data pb-8" data-story={s.slug} data-study-text={t.source}>
      <FiltersScope><StoryCover band={studyBand(s.number)} seed={s.number} headline={t.headline} long={t.headline.length > 48} deck={s.question} italicDeck object={null}
        kicker={<Link to="/data" className="ed-tap no-underline hover:underline">{`${s.seriesTitle} · ${studyLabel(s.number)}`}</Link>}
        left={s.dataThrough ? <>Data through <time dateTime={s.dataThrough}>{dayText(s.dataThrough)}</time></> : null}
        right={t.stale && t.at ? <span data-text-from="">Text from {dayText(t.at)}</span> : null} /></FiltersScope>
      <div className="ed-wrap mt-10 md:mt-14"><p className={scenePara} style={MEASURE} data-study-opening="">{t.opening}</p></div>
      <Scenes s={s} scene={scene} onScene={onScene} allFigures={allFigures} />
      {t.use && <section aria-labelledby="study-use" className="ed-wrap mt-[var(--sys-gap-section)]" data-study-use=""><h2 id="study-use" className="ed-kicker">What to do with it</h2><p className={`${scenePara} mt-2`} style={MEASURE}>{t.use}</p></section>}
      {s.limits.length > 0 && <section aria-labelledby="study-limits" className="ed-wrap mt-[var(--sys-gap-section)]" data-study-limits=""><h2 id="study-limits" className="ed-kicker">Limits</h2><p className="ed-small mt-2 max-w-[68ch]">{s.limits.join(" ")}</p></section>}
      <StudyBlock n={1} id="study-evidence" title="Evidence"><StudyEvidence s={s} /></StudyBlock>
      <StudyBlock n={2} id="study-related" title="Related">{related ?? null}</StudyBlock>
    </article>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
