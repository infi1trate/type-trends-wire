import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARRIVE_KEY, HEAD_SCRIPT, LOOP_KEYFRAMES, MOTION_LOOPS, MOTION_MS, MotionLock, PATTERNS, TERMINAL_MOTION, arriveMs, arriveOnce, countFrame, letterDelays, motionAllowed, type SessionStore } from "./motion";

const CSS = readFileSync("src/styles.css", "utf8");
const mem = (): SessionStore & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, get: k => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };

describe("motion", () => {
  it("five patterns: arrive, press, cut, count, draw", () => {
    expect(PATTERNS.map(p => p.id)).toEqual(["arrive", "press", "cut", "count", "draw"]);
  });
  it("the mark arrives once per session: letters stagger 110ms", () => {
    const s = mem();
    expect(arriveOnce(s)).toBe(true); expect(arriveOnce(s)).toBe(false); expect(arriveOnce(s)).toBe(false);
    expect(s.m.get(ARRIVE_KEY)).toBe("1");
    expect(arriveOnce(null)).toBe(false);
    expect(arriveOnce({ get: () => { throw new Error("blocked"); }, set: () => {} })).toBe(false);
    expect(MOTION_MS.stagger).toBe(110);
    expect(letterDelays()).toEqual([0, 110, 220, 330]); expect(arriveMs()).toBe(MOTION_MS.arrive + 330);
    expect(HEAD_SCRIPT).toContain(JSON.stringify(ARRIVE_KEY));
  });
  it("one thing moves at a time on a screen", () => {
    let t = 0; const lock = new MotionLock(() => t);
    expect(lock.claim(300)).toBe(true); expect(lock.busy()).toBe(true);
    t = 100; expect(lock.claim(300)).toBe(false);
    t = 300; expect(lock.claim(300)).toBe(true);
  });
  it("the ticker and the live dot are the only loops; the terminal keeps the live tick and the cursor", () => {
    expect([...MOTION_LOOPS]).toEqual(["ticker", "live-dot"]); expect([...TERMINAL_MOTION]).toEqual(["live-dot", "cursor"]);
    const loops = [...CSS.matchAll(/animation:\s*([\w-]+)[^;]*\binfinite\b/g)].map(m => m[1]!);
    expect(loops.length).toBeGreaterThan(0);
    for (const k of loops) expect(Object.keys(LOOP_KEYFRAMES), k).toContain(k);
    expect(motionAllowed({ reduced: false, terminal: true })).toBe(false); expect(motionAllowed({ reduced: true })).toBe(false); expect(motionAllowed({ reduced: false })).toBe(true);
  });
  it("reduced motion: every one-shot animation rests on its last frame (nothing waits hidden)", () => {
    const block = CSS.slice(CSS.indexOf("/* Motion (brand/motion/slug-motion.css"));
    const animated = [...block.matchAll(/^([^@{}\n][^{}\n]*)\{[^}]*animation: slug-/gm)].map(m => m[1]!.trim());
    expect(animated.length).toBeGreaterThanOrEqual(6);
    const reduced = block.slice(block.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const sel of animated) for (const one of sel.split(",").map(s => s.trim().replace(/:not\([^)]*\)/g, ""))) expect(reduced, one).toContain(one);
    // Every slug-* keyframe ends at the resting frame, so "animation: none" shows the same thing.
    for (const m of CSS.matchAll(/@keyframes (slug-[\w-]+) (\{(?:[^{}]|\{[^{}]*\})*\})/g)) expect(m[2], m[1]).toMatch(/(100%|to) \{ [^}]*(none|scale\(1\)|stroke-dashoffset: 0|inset\(0 0 0 0\))/);
  });
  it("count rolls to the exact value and ends on it", () => {
    expect(countFrame("47.0%", 1)).toBe("47.0%"); expect(countFrame("47.0%", 0)).toMatch(/^0(\.0)?%$/);
    expect(countFrame("No. 12", 1)).toBe("No. 12");
  });
});
