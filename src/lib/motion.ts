// Motion, pure (brand/README.md, "Motion"; brand/motion/slug-motion.css): the five patterns, their timings from the theme's motion
// tokens, the one-thing-at-a-time lock, the two allowed loops and the once-per-session arrival of the mark.
import { activeTheme } from "./theme";

const ms = (v: string) => (v.endsWith("ms") ? Number(v.slice(0, -2)) : v.endsWith("s") ? Number(v.slice(0, -1)) * 1000 : Number(v));
const M = activeTheme.shared.motion as unknown as Record<string, string>;
/** Timings in ms, read from the theme tokens (Tap, Move, Wipe, Arrive, Draw and the letter stagger). */
export const MOTION_MS = { tap: ms(M["tap"]!), move: ms(M["move"]!), wipe: ms(M["wipe"]!), arrive: ms(M["arrive"]!), draw: ms(M["draw"]!), stagger: ms(M["stagger"]!) } as const;
/** The five patterns, each with its timing token and easing. */
export const PATTERNS = [
  { id: "arrive", name: "The mark arrives", token: "arrive", ease: "ooze", what: "The four letters rise and settle one after another, 110 ms apart. Only on the gate and on the first page of a session, once." },
  { id: "press", name: "Press", token: "tap", ease: "linear", what: "Raised controls travel into their shadow on press; a sticker pops when it appears." },
  { id: "cut", name: "Cut", token: "wipe", ease: "cut", what: "Page changes wipe with a hard edge where the browser supports view transitions, and simply change where it does not. Never a fade or a slide." },
  { id: "count", name: "Count", token: "move", ease: "ooze", what: "Figures roll to their value and bars grow the first time they enter view; a new story drops into the live column and settles." },
  { id: "draw", name: "Draw", token: "draw", ease: "settle", what: "The trail draws along its path and each gumball sticks as the head passes it." },
] as const;
export type PatternId = (typeof PATTERNS)[number]["id"];
/** The only animations that repeat. The terminal's blinking cursor is the third, and it lives only in the terminal. */
export const MOTION_LOOPS = ["ticker", "live-dot"] as const;
export const TERMINAL_MOTION = ["live-dot", "cursor"] as const;
/** CSS keyframe names allowed to run `infinite`, and the loop each one is. */
/** `glisten` is the loading placeholder's sweep (P1): it runs only while a deferred section is on its way, never on content, and stops
 * under reduced motion. */
export const LOOP_KEYFRAMES: Record<string, (typeof MOTION_LOOPS)[number] | "cursor" | "placeholder"> = { crawl: "ticker", "pulse-dot": "live-dot", blink: "cursor", glisten: "placeholder" };
/** The placeholder sweep's period. */
export const GLISTEN_MS = 1600;

/** How long the arrival takes for n letters: the Arrive timing plus the stagger between letters. */
export const arriveMs = (letters = 4) => MOTION_MS.arrive + MOTION_MS.stagger * (letters - 1);
/** Each letter's delay in the arrival. */
export const letterDelays = (letters = 4) => Array.from({ length: letters }, (_, i) => i * MOTION_MS.stagger);

/** Session storage as two functions, so tests can run in memory. */
export type SessionStore = { get(k: string): string | null; set(k: string, v: string): void };
export const ARRIVE_KEY = "slug:arrived";
/** True the first time in a session (and records it); false afterwards and when storage is unavailable. */
export function arriveOnce(store: SessionStore | null): boolean {
  if (!store) return false;
  try { if (store.get(ARRIVE_KEY)) return false; store.set(ARRIVE_KEY, "1"); return true; } catch { return false; }
}
/** Runs in <head> before the first paint: marks the first page of a session for the arrival (and clears it once played),
 * and flags Save-Data so illustrations render flat. The markup never depends on it, so server and browser agree. */
export const HEAD_SCRIPT = `(function(){var d=document.documentElement;try{var s=window.sessionStorage;if(!s.getItem(${JSON.stringify(ARRIVE_KEY)})){s.setItem(${JSON.stringify(ARRIVE_KEY)},"1");d.setAttribute("data-arrive","");setTimeout(function(){d.removeAttribute("data-arrive")},${arriveMs() + 400})}}catch(e){}try{var c=navigator.connection;if(c&&c.saveData)d.setAttribute("data-save-data","")}catch(e){}})();`;

/** One thing moves at a time: a claim succeeds only when nothing else is moving; loops never claim. */
export class MotionLock {
  private until = 0;
  constructor(private now: () => number = () => Date.now()) {}
  claim(duration: number): boolean { const t = this.now(); if (t < this.until) return false; this.until = t + duration; return true; }
  busy(): boolean { return this.now() < this.until; }
}
/** Motion plays only when the reader allows it and never in the terminal (which keeps the live tick and the cursor). */
export const motionAllowed = (o: { reduced: boolean; terminal?: boolean }) => !o.reduced && !o.terminal;

/** Count: the value shown at progress t (0 to 1) while a figure rolls to its value, keeping its decimals, prefix and unit. */
export function countFrame(text: string, t: number): string {
  const m = text.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!m) return text;
  const raw = m[0], dec = raw.includes(".") ? raw.split(".")[1]!.length : 0, target = Number(raw.replace(/,/g, "")), k = Math.max(0, Math.min(1, t));
  const eased = 1 - (1 - k) ** 3, v = target * eased;
  const s = dec ? v.toFixed(dec) : String(Math.round(v));
  return text.slice(0, m.index) + (raw.includes(",") ? Number(s).toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s) + text.slice(m.index! + raw.length);
}
