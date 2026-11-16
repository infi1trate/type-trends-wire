// Polling for /front.json with injected timers and browser signals, so tests drive it without a browser.
// About every 60 s while the tab is visible; paused while hidden (one poll on return); exponential back-off on errors; never under Save-Data.
export const POLL_MS = 60_000, POLL_MAX_MS = 10 * 60_000;
export type PollResult<T> = { status: 200; etag: string | null; data: T } | { status: 304 };
export type PollEnv = {
  hidden: () => boolean; saveData: () => boolean;
  setTimer: (fn: () => void, ms: number) => unknown; clearTimer: (t: unknown) => void;
  onVisibility: (fn: () => void) => () => void;
};
export type PollState = "idle" | "waiting" | "paused" | "save-data" | "stopped";
export function createPoller<T>(fetchOnce: (etag: string | null) => Promise<PollResult<T>>, onData: (d: T) => void, env: PollEnv, o: { interval?: number; max?: number } = {}) {
  const base = o.interval ?? POLL_MS, max = o.max ?? POLL_MAX_MS;
  let etag: string | null = null, delay = base, timer: unknown = null, state: PollState = "idle", inflight = false, off: (() => void) | null = null, errors = 0;
  const clear = () => { if (timer !== null) env.clearTimer(timer); timer = null; };
  const schedule = (ms: number) => {
    clear();
    if (state === "stopped") return;
    if (env.saveData()) { state = "save-data"; return; }
    if (env.hidden()) { state = "paused"; return; }
    state = "waiting"; timer = env.setTimer(tick, ms);
  };
  async function tick() {
    timer = null;
    if (state === "stopped" || inflight) return;
    if (env.saveData()) { state = "save-data"; return; }
    if (env.hidden()) { state = "paused"; return; }
    inflight = true;
    try {
      const r = await fetchOnce(etag);
      if (r.status === 200) { etag = r.etag; onData(r.data); }
      delay = base; errors = 0;
    } catch { errors++; delay = Math.min(max, delay * 2); }
    finally { inflight = false; }
    schedule(delay);
  }
  return {
    start() {
      if (state !== "idle" && state !== "stopped") return;
      state = "idle";
      off = env.onVisibility(() => { if (state === "paused" && !env.hidden()) void tick(); else if (env.hidden() && state === "waiting") { clear(); state = "paused"; } });
      schedule(delay);
    },
    stop() { clear(); off?.(); off = null; state = "stopped"; },
    state: () => state, delay: () => delay, errors: () => errors,
  };
}
/** The browser environment: document visibility, navigator.connection.saveData, window timers. Call only in effects. */
export function browserPollEnv(): PollEnv {
  return {
    hidden: () => document.visibilityState === "hidden",
    saveData: () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    setTimer: (fn, ms) => window.setTimeout(fn, ms), clearTimer: t => window.clearTimeout(t as number),
    onVisibility: fn => { document.addEventListener("visibilitychange", fn); return () => document.removeEventListener("visibilitychange", fn); },
  };
}
