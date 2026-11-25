// Motion in the browser (lib/motion.ts holds the rules): the arriving mark, figures that count to their value, bars that grow and
// the first-view trigger the trail uses. The resting frame is always the rendered markup, so with reduced motion (or before the
// script runs) everything is already in place and readable; motion only ever replays toward that frame.
import { useEffect, useRef, useState, type RefObject } from "react";
import { MotionLock, MOTION_MS, arriveMs, countFrame, motionAllowed } from "@/lib/motion";
import { FigureNumber } from "./FigureNumber";
import { Wordmark } from "./Wordmark";

/** The page's one lock: a second animation that wants to start while another plays simply rests on its last frame. */
export const motionLock = new MotionLock();
if (typeof document !== "undefined" && document.documentElement.hasAttribute("data-arrive")) motionLock.claim(arriveMs());

const reduced = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
const inTerminal = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-mode") === "dark";

/** True once, the first time the element enters view and the lock is free; false forever after (and always with reduced motion). */
export function useFirstView<T extends Element>(duration: number, threshold = 0.35): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null), [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || !motionAllowed({ reduced: reduced(), terminal: inTerminal() })) return;
    let done = false, timer = 0;
    const io = new IntersectionObserver(es => {
      if (done || !es.some(e => e.isIntersecting)) return;
      done = true; io.disconnect();
      if (motionLock.claim(duration)) { setOn(true); timer = window.setTimeout(() => setOn(false), duration + 50); }
    }, { threshold });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, [duration, threshold]);
  return [ref, on];
}

/** The mark in the shell. On the first page of a session the head script sets html[data-arrive] and CSS lifts the letters in. */
export function ArrivingMark({ height }: { height: number }) {
  return <span className="m-arrive inline-flex" data-motion-pattern="arrive"><Wordmark height={height} ground="ink" decorative letters /></span>;
}

/** Count: a figure that rolls to its value the first time it enters view. The text is the final value until then. */
export function Count({ text, className = "" }: { text: string; className?: string }) {
  const [ref, on] = useFirstView<HTMLSpanElement>(MOTION_MS.move), [shown, setShown] = useState(text);
  useEffect(() => {
    if (!on) { setShown(text); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = (t - t0) / MOTION_MS.move; setShown(countFrame(text, k)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, text]);
  // P2c · the final value always holds the figure's width (invisible while the roll plays over it), so a narrower frame ("1.3%" on the
  // way to "8.5%") can never pull the unit beside it up a line and back: the roll moves no layout.
  const rolling = shown !== text;
  return <span ref={ref} className={`relative inline-block ${className}`} data-motion-pattern="count"><span className="sr-only">{text}</span>
    <span aria-hidden="true" className={rolling ? "invisible" : undefined}><FigureNumber text={text} /></span>
    {rolling && <span aria-hidden="true" className="absolute left-0 top-0 whitespace-nowrap" data-count-frame=""><FigureNumber text={shown} /></span>}
  </span>;
}

/** A bar that grows from its start the first time it enters view (transform only). */
export function useGrow<T extends Element>(): [RefObject<T | null>, string] {
  const [ref, on] = useFirstView<T>(MOTION_MS.move);
  return [ref, on ? "m-grow-on" : ""];
}
