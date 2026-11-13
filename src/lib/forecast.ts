// Pure, dependency-free trend forecasting. No I/O.
export type SeriesPoint = { quarter: string; share: number | null; denom: number; coverage: number };
export type Model = "logistic" | "linear";
export type Stage = "emerging" | "accelerating" | "peaking" | "declining" | "flat";
export type Projection = { h: number; quarter: string; mid: number; lo: number; hi: number };
export type Fit = { model: Model; params: number[]; sse: number; score: number };
export type ForecastResult =
  | { status: "insufficient_data"; usable: number; current_share: number | null }
  | { status: "ok"; usable: number; model: Model; fits: { logistic: Fit; linear: Fit }; params: number[]; current_share: number; latest: string; momentum: number; stage: Stage; projections: Projection[]; fitted: { quarter: string; value: number }[] };

export const THRESHOLDS = { denomAll: 15, denomSector: 8, coverage: 0.25, minQuarters: 4, bootstrap: 200, seed: 20250701, interval: 0.8 } as const;
export const qIndex = (q: string) => { const m = /^(\d{4})Q([1-4])$/.exec(q); if (!m) throw new Error(`Bad quarter ${q}`); return Number(m[1]!) * 4 + Number(m[2]!) - 1; };
export const qLabel = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
export const qAdd = (q: string, n: number) => qLabel(qIndex(q) + n);

export function usablePoints(points: SeriesPoint[], scope: string) {
  const minDenom = scope === "all" ? THRESHOLDS.denomAll : THRESHOLDS.denomSector;
  return points.filter((p): p is SeriesPoint & { share: number } => p.share !== null && Number.isFinite(p.share) && p.denom >= minDenom && p.coverage >= THRESHOLDS.coverage)
    .sort((a, b) => qIndex(a.quarter) - qIndex(b.quarter));
}

export const logistic = ([L = 1, k = 0, t0 = 0]: number[], t: number) => L / (1 + Math.exp(-k * (t - t0)));
export const linear = ([a = 0, b = 0]: number[], t: number) => a + b * t;
const predict = (m: Model, p: number[], t: number) => (m === "logistic" ? logistic(p, t) : linear(p, t));
const wsse = (m: Model, p: number[], x: number[], y: number[], w: number[]) => x.reduce((s, t, i) => s + w[i]! * (y[i]! - predict(m, p, t)) ** 2, 0);

export function fitLinear(x: number[], y: number[], w: number[]): number[] {
  const W = w.reduce((a, b) => a + b, 0), mx = x.reduce((s, t, i) => s + w[i]! * t, 0) / W, my = y.reduce((s, v, i) => s + w[i]! * v, 0) / W;
  const sxx = x.reduce((s, t, i) => s + w[i]! * (t - mx) ** 2, 0), sxy = x.reduce((s, t, i) => s + w[i]! * (t - mx) * (y[i]! - my), 0);
  const b = sxx > 0 ? sxy / sxx : 0; return [my - b * mx, b];
}

// Bounded grid + coordinate refine. L in [max(share_max, eps), 1]; x is centered quarter index.
export function fitLogistic(x: number[], y: number[], w: number[], start?: number[]): number[] {
  const yMax = Math.max(1e-4, ...y), lo = [Math.min(1, yMax), -4, Math.min(...x) - 12], hi = [1, 4, Math.max(...x) + 12];
  const clamp = (p: number[]) => p.map((v, i) => Math.min(hi[i]!, Math.max(lo[i]!, v)));
  let best = start ? clamp(start) : [lo[0]!, 0.5, (lo[2]! + hi[2]!) / 2], bestE = wsse("logistic", best, x, y, w);
  if (!start) {
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 24; b++) for (let c = 0; c <= 20; c++) {
      const p = [lo[0]! + (hi[0]! - lo[0]!) * a / 8, lo[1]! + (hi[1]! - lo[1]!) * b / 24, lo[2]! + (hi[2]! - lo[2]!) * c / 20];
      const e = wsse("logistic", p, x, y, w); if (e < bestE) { bestE = e; best = p; }
    }
  }
  let step = [(hi[0]! - lo[0]!) / 8, (hi[1]! - lo[1]!) / 24, (hi[2]! - lo[2]!) / 20].map(s => s * (start ? 0.5 : 1));
  for (let it = 0; it < (start ? 12 : 40); it++) {
    let improved = false;
    for (let d = 0; d < 3; d++) for (const dir of [1, -1]) {
      const p = clamp(best.map((v, i) => (i === d ? v + dir * step[d]! : v))); const e = wsse("logistic", p, x, y, w);
      if (e < bestE) { bestE = e; best = p; improved = true; }
    }
    if (!improved) step = step.map(s => s / 2);
  }
  return best;
}

// Weighted SSE normalised by mean weight, AIC-style penalty: n·ln(SSE/n) + 2·params·penalty.
export function modelScore(sse: number, n: number, params: number, meanW: number, penalty = 1.5) {
  return n * Math.log(Math.max(sse / meanW, 1e-10) / n) + 2 * params * penalty;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const quantile = (s: number[], q: number) => { const a = [...s].sort((m, n) => m - n), i = (a.length - 1) * q, f = Math.floor(i); return a[f]! + (a[Math.min(a.length - 1, f + 1)]! - a[f]!) * (i - f); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const slope = (m: Model, p: number[], t: number) => { if (m === "linear") return p[1]!; const s = logistic(p, t); return p[1]! * s * (1 - s / p[0]!); };

export function classifyStage(m: Model, p: number[], xs: number[], share: number): Stage {
  const t = xs[xs.length - 1]!, s1 = slope(m, p, t), s0 = slope(m, p, t - 1), L = m === "logistic" ? p[0]! : 1;
  if (xs.slice(-3).every(v => slope(m, p, v) < 0)) return "declining";
  if (share < 0.1 && s1 > 0) return "emerging";
  if (s1 > 0 && s1 - s0 < -1e-6 && (share > 0.3 || share >= 0.85 * L)) return "peaking";
  // Linear fits have constant slope; meaningful steady growth (≥0.5 pts/quarter) counts as accelerating.
  if (s1 > 0 && (s1 - s0 > 1e-6 || (m === "linear" && s1 >= 0.005))) return "accelerating";
  return "flat";
}

export function forecastSeries(points: SeriesPoint[], scope: string, horizons = [1, 2, 4]): ForecastResult {
  const use = usablePoints(points, scope);
  if (use.length < THRESHOLDS.minQuarters) return { status: "insufficient_data", usable: use.length, current_share: use.at(-1)?.share ?? null };
  const origin = qIndex(use[0]!.quarter), x = use.map(p => qIndex(p.quarter) - origin), y = use.map(p => p.share), w = use.map(p => p.denom), n = x.length, meanW = w.reduce((a, b) => a + b, 0) / n;
  const lp = fitLogistic(x, y, w), ln = fitLinear(x, y, w);
  const fits = { logistic: { model: "logistic" as const, params: lp, sse: wsse("logistic", lp, x, y, w), score: 0 }, linear: { model: "linear" as const, params: ln, sse: wsse("linear", ln, x, y, w), score: 0 } };
  fits.logistic.score = modelScore(fits.logistic.sse, n, 3, meanW); fits.linear.score = modelScore(fits.linear.sse, n, 2, meanW);
  const win = fits.logistic.score < fits.linear.score ? fits.logistic : fits.linear;
  const resid = x.map((t, i) => y[i]! - predict(win.model, win.params, t)), rand = mulberry32(THRESHOLDS.seed), last = x[n - 1]!;
  const samples = horizons.map(() => [] as number[]);
  for (let b = 0; b < THRESHOLDS.bootstrap; b++) {
    const yb = x.map((t, i) => clamp01(predict(win.model, win.params, t) + resid[Math.floor(rand() * n)]!));
    const pb = win.model === "logistic" ? fitLogistic(x, yb, w, win.params) : fitLinear(x, yb, w);
    horizons.forEach((h, i) => samples[i]!.push(clamp01(predict(win.model, pb, last + h) + resid[Math.floor(rand() * n)]!)));
  }
  const alpha = (1 - THRESHOLDS.interval) / 2, latest = use[n - 1]!.quarter;
  return { status: "ok", usable: n, model: win.model, fits, params: win.params, current_share: y[n - 1]!, latest,
    momentum: slope(win.model, win.params, last) * 100, stage: classifyStage(win.model, win.params, x, y[n - 1]!),
    projections: horizons.map((h, i) => ({ h, quarter: qAdd(latest, h), mid: clamp01(predict(win.model, win.params, last + h)), lo: quantile(samples[i]!, alpha), hi: quantile(samples[i]!, 1 - alpha) })),
    fitted: Array.from({ length: last + 1 + Math.max(...horizons) }, (_, t) => ({ quarter: qLabel(origin + t), value: clamp01(predict(win.model, win.params, t)) })) };
}

export type Backtest = { status: "ok"; cutoff: string; train: number; test: number; mae_pts: number; hit_rate: number; predictions: { quarter: string; predicted: number; actual: number }[] } | { status: "insufficient_data"; cutoff: string };
export function backtestSeries(points: SeriesPoint[], scope: string, cutoff = "2025Q2"): Backtest {
  const use = usablePoints(points, scope), c = qIndex(cutoff), train = use.filter(p => qIndex(p.quarter) <= c), test = use.filter(p => qIndex(p.quarter) > c);
  if (train.length < THRESHOLDS.minQuarters || !test.length) return { status: "insufficient_data", cutoff };
  const f = forecastSeries(train, scope, test.map(p => qIndex(p.quarter) - qIndex(train[train.length - 1]!.quarter)));
  if (f.status !== "ok") return { status: "insufficient_data", cutoff };
  const base = train[train.length - 1]!.share;
  const predictions = test.map((p, i) => ({ quarter: p.quarter, predicted: f.projections[i]!.mid, actual: p.share }));
  const hits = predictions.filter(p => Math.sign(Math.round((p.predicted - base) * 1e4)) === Math.sign(Math.round((p.actual - base) * 1e4))).length;
  return { status: "ok", cutoff, train: train.length, test: test.length, mae_pts: predictions.reduce((s, p) => s + Math.abs(p.predicted - p.actual), 0) / test.length * 100, hit_rate: hits / test.length, predictions };
}
export const median = (v: number[]) => v.length ? quantile(v, 0.5) : null;
