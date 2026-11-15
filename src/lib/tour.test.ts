import { describe, it, expect, beforeEach } from "vitest";
import { tourStore, availableSteps, _resetTourMemory, TOUR_KEY } from "./tour";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
beforeEach(() => _resetTourMemory());

describe("tour", () => {
  it("shows once: done after finish, persisted under dsgn.tour.done", () => {
    const st = mem(), t = tourStore(() => st);
    expect(t.done()).toBe(false);
    t.finish();
    expect(st.m.get(TOUR_KEY)).toBe("1");
    expect(tourStore(() => st).done()).toBe(true);
  });
  it("skip persists the same way and replay resets it", () => {
    const st = mem(), t = tourStore(() => st);
    t.finish(); t.reset();
    expect(t.done()).toBe(false);
    expect(st.m.has(TOUR_KEY)).toBe(false);
  });
  it("falls back to memory when storage throws", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
    const t = tourStore(() => broken);
    expect(t.done()).toBe(false);
    expect(() => t.finish()).not.toThrow();
    expect(t.done()).toBe(true);
    expect(tourStore(() => { throw new Error("no storage"); }).done()).toBe(true);
  });
  it("skips steps whose target is missing", () => {
    expect(availableSteps(sel => !sel.includes("site")).map(s => s.id)).toEqual(["today", "trait", "console"]);
  });
});
