// The board's behaviour with injected timers and browser objects, so tests drive it without a browser: keys, the pointer that hides,
// the screen wake lock, the feed that keeps the last good data, the per-scene shift that spares the panel, and the type scale.

// KEYS ----------------------------------------------------------------------------------------------
export type BoardAction = "pause" | "prev" | "next" | "fullscreen" | "leave";
/** Space pauses, the arrow keys step, F toggles full screen, Escape leaves. */
export function boardKey(key: string): BoardAction | null {
  if (key === " " || key === "Spacebar") return "pause";
  if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") return "prev";
  if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") return "next";
  if (key === "f" || key === "F") return "fullscreen";
  if (key === "Escape") return "leave";
  return null;
}
export const step = (i: number, n: number, dir: 1 | -1) => (n <= 0 ? 0 : (i + dir + n) % n);

// TIMERS --------------------------------------------------------------------------------------------
export type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void };
export const POINTER_IDLE_MS = 3000, TAP_BAR_MS = 5000;
/** Shown on activity, hidden after `ms` of stillness. Used for the pointer (3 s) and the touch bar (5 s). */
export function idle(t: Timers, ms: number, onChange: (shown: boolean) => void) {
  let timer: unknown = null, shown = false;
  const hide = () => { timer = null; if (shown) { shown = false; onChange(false); } };
  return {
    poke() { if (timer !== null) t.clear(timer); if (!shown) { shown = true; onChange(true); } timer = t.set(hide, ms); },
    stop() { if (timer !== null) t.clear(timer); timer = null; },
    shown: () => shown,
  };
}

// WAKE LOCK -----------------------------------------------------------------------------------------
type Sentinel = { release: () => Promise<void>; released?: boolean };
export type WakeNavigator = { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
export const wakeLockSupported = (nav: WakeNavigator | undefined) => !!nav?.wakeLock && typeof nav.wakeLock.request === "function";
/** Keeps the screen awake where the Screen Wake Lock API exists; re-requests when the page becomes visible again (browsers drop it). */
export function wakeLock(nav: WakeNavigator | undefined) {
  let s: Sentinel | null = null, want = false;
  const acquire = async () => { if (!want || !wakeLockSupported(nav) || (s && !s.released)) return; try { s = await nav!.wakeLock!.request("screen"); } catch { s = null; } };
  return {
    supported: wakeLockSupported(nav),
    async request() { want = true; await acquire(); return !!s; },
    async visible() { await acquire(); },
    async release() { want = false; const x = s; s = null; if (x) await x.release().catch(() => undefined); },
    held: () => !!s && !s.released,
  };
}

// THE FEED -------------------------------------------------------------------------------------------
/** The data on screen, when it was last good, and whether it is late (a failed poll or late data): the board never shows an error. */
export type Feed<T> = { data: T; goodAt: number; stale: boolean };
export const feedStart = <T,>(data: T, at: number): Feed<T> => ({ data, goodAt: at, stale: false });
export const feedGood = <T,>(_f: Feed<T>, data: T, at: number): Feed<T> => ({ data, goodAt: at, stale: false });
export const feedFail = <T,>(f: Feed<T>): Feed<T> => ({ ...f, stale: true });
/** Data older than this (two missed polls and a bit) also reads as late. */
export const LATE_MS = 3 * 60_000;
export const isLate = (f: Feed<unknown>, now: number, dataLate = false) => f.stale || dataLate || now - f.goodAt > LATE_MS;
const p2 = (n: number) => String(n).padStart(2, "0");
export const asOfText = (at: number) => { const d = new Date(at); return `as of ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`; };

// SPARING THE PANEL ----------------------------------------------------------------------------------
/** The whole board moves a few pixels on every scene change; the mark's slab swaps corner, so nothing bright stays put for two scenes. */
const SHIFTS: readonly [number, number][] = [[0, 0], [6, 4], [-5, 6], [4, -6], [-6, -3], [3, 5]];
export const shiftOf = (n: number): [number, number] => SHIFTS[((n % SHIFTS.length) + SHIFTS.length) % SHIFTS.length]!;
export const slabCorner = (n: number): "left" | "right" => (n % 2 === 0 ? "left" : "right");

// TYPE FOR DISTANCE ----------------------------------------------------------------------------------
/** Sizes as a share of the screen's height (1 unit = 1% of the height, capped by width on very wide or tall screens). At 1080p one unit is
 * 10.8 px: the headline (7.4) reads from five metres, and the smallest text (2.6) is 28 px. */
export const BOARD_TYPE = { headline: 7.4, figure: 16, title: 4.6, body: 3.2, small: 2.6 } as const;
export const pxAt = (units: number, height: number) => (units * height) / 100;

// POLLING --------------------------------------------------------------------------------------------
/** One poll of /front.json with its ETag: 304 refreshes "last heard"; 200 loads the board's input again and hands it on (the board applies
 * it when the current scene ends); any failure keeps the last good data, marks it late and rethrows so the poller backs off. */
export function boardPoll<T>(d: { head: (etag: string | null) => Promise<{ status: number; etag: string | null }>; load: () => Promise<T>; now: () => number; feed: (f: (x: Feed<T>) => Feed<T>) => void; fresh: (data: T) => void }) {
  return async (etag: string | null): Promise<{ status: 304 } | { status: 200; etag: string | null; data: null }> => {
    try {
      const r = await d.head(etag);
      if (r.status === 304) { const at = d.now(); d.feed(f => feedGood(f, f.data, at)); return { status: 304 }; }
      if (r.status !== 200) throw new Error(`front.json answered ${r.status}`);
      const next = await d.load(), at = d.now();
      d.fresh(next); d.feed(f => feedGood(f, next, at));
      return { status: 200, etag: r.etag, data: null };
    } catch (e) { d.feed(feedFail); throw e; }
  };
}
