import { tagPhrase } from "./labels";
// F7 Vibe Map: pure, deterministic tag-space projection. No I/O, no AI, no images.
// Vector = closed-vocab AI tags + theme/serif/mono → TF-IDF-ish weights → PCA (power iteration) → k-means.
export const VIBE_DIMS = ["aesthetic", "tone", "imagery", "hero_layout", "color_mood", "components"] as const;
export const VIBE_MIN_CONFIDENCE = 0.4;
export const VIBE_K_RANGE = [6, 7, 8] as const;
export const VIBE_MIN_DF = 2;
export const VIBE_COMMON_SHARE = 0.5, VIBE_COMMON_DAMP = 0.5;
export const VIBE_HISTORY_MIN_SITES = 30;
export const VIBE_SEED = 20261;
const SERIF = /(serif|georgia|times|garamond|canela|tiempos|lora|fraunces|playfair|editorial|domaine|recoleta)/i;
const MONO = /(mono|courier|consolas|menlo|monaco|code|terminal)/i;

export type VibeSite = { domain: string; sector: string; quarter: string; tokens: string[] };
export type VibePoint = { domain: string; sector: string; x: number; y: number; cluster: number; tokens: string[] };
export type VibeCluster = { id: number; name: string; n: number; share: number; centroid: [number, number]; top_tags: { tag: string; share: number; lift_pts: number }[]; top_sectors: { sector: string; n: number }[] };
export type VibeAxis = { negative: string[]; positive: string[]; explained: number };
export type VibeModel = { tokens: string[]; weights: number[]; mean: number[]; components: [number[], number[]]; axes: [VibeAxis, VibeAxis]; k: number; silhouette: number; silhouettes: Record<string, number>; n: number; points: VibePoint[]; clusters: VibeCluster[] };

/** Tokens for one site sample, or null when its AI tags are missing, blocked, low-confidence or below 0.4 confidence. */
export function siteTokens(row: { theme?: string | null; h1_family?: string | null; body_family?: string | null; ai_tags?: unknown }): string[] | null {
  const t = row.ai_tags;
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const tags = t as Record<string, unknown>;
  if (tags["blocked_reason"] != null || tags["low_confidence"] === true) return null;
  if (typeof tags["confidence"] !== "number" || tags["confidence"] < VIBE_MIN_CONFIDENCE) return null;
  const out = new Set<string>();
  for (const d of VIBE_DIMS) { const v = tags[d]; for (const x of Array.isArray(v) ? v : typeof v === "string" ? [v] : []) if (typeof x === "string" && x && x !== "none") out.add(`${d}:${x}`); }
  if (row.theme === "dark" || row.theme === "light") out.add(`theme:${row.theme}`);
  if (row.h1_family && SERIF.test(row.h1_family) && !/sans/i.test(row.h1_family)) out.add("headline:serif");
  if ((row.h1_family && MONO.test(row.h1_family)) || (row.body_family && MONO.test(row.body_family))) out.add("type:mono");
  return [...out].sort();
}

/** Human phrase for a token; deterministic template, never an LLM. Lives in labels.ts with every other trait name. */
export { tagPhrase };
export const axisLabel = (a: VibeAxis) => `← ${a.negative.map(tagPhrase).join(" · ")}   ${a.positive.map(tagPhrase).join(" · ")} →`;

/** Deterministic PRNG (mulberry32). */
export function prng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function vectorize(tokens: string[], vocab: Map<string, number>, weights: number[]) {
  const v = new Array<number>(weights.length).fill(0);
  for (const t of tokens) { const j = vocab.get(t); if (j !== undefined) v[j] = weights[j]!; }
  const norm = Math.hypot(...v); return norm > 0 ? v.map(x => x / norm) : v;
}
/** Leading eigenvector of a symmetric matrix by power iteration from a seeded start; sign-normalized so the largest |loading| is positive. */
export function powerIteration(m: number[][], seed: number, iters = 1000): { vector: number[]; value: number } {
  const d = m.length, rand = prng(seed); let v = Array.from({ length: d }, () => rand() - 0.5);
  const norm = (x: number[]) => { const n = Math.hypot(...x) || 1; return x.map(y => y / n); };
  v = norm(v); let value = 0;
  for (let i = 0; i < iters; i++) {
    const w = m.map(row => row.reduce((s, x, j) => s + x * v[j]!, 0));
    const next = norm(w); value = w.reduce((s, x, j) => s + x * v[j]!, 0);
    const diff = next.reduce((s, x, j) => s + Math.abs(x - v[j]!), 0); v = next; if (diff < 1e-12) break;
  }
  return { vector: signNormalize(v), value };
}
export function signNormalize(v: number[]) { let idx = 0; for (let j = 1; j < v.length; j++) if (Math.abs(v[j]!) > Math.abs(v[idx]!) + 1e-12) idx = j; return (v[idx] ?? 0) < 0 ? v.map(x => (x === 0 ? 0 : -x)) : v; }

const dist2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
/** Deterministic k-means (k-means++ init from a fixed seed, Lloyd iterations, best of 5 seeded restarts by inertia). */
export function kmeans(points: [number, number][], k: number, seed = VIBE_SEED): { labels: number[]; centroids: [number, number][]; inertia: number } {
  let best: { labels: number[]; centroids: [number, number][]; inertia: number } | null = null;
  for (let r = 0; r < 5; r++) {
    const rand = prng(seed + k * 101 + r * 7919), cents: [number, number][] = [points[Math.floor(rand() * points.length)]!];
    while (cents.length < k) { const d = points.map(p => Math.min(...cents.map(c => dist2(p, c)))), tot = d.reduce((a, b) => a + b, 0); let t = rand() * tot, i = 0; while (i < d.length - 1 && t > d[i]!) { t -= d[i]!; i++; } cents.push(points[i]!); }
    let labels = new Array<number>(points.length).fill(0);
    for (let it = 0; it < 100; it++) {
      const next = points.map(p => { let b = 0; for (let c = 1; c < k; c++) if (dist2(p, cents[c]!) < dist2(p, cents[b]!) - 1e-15) b = c; return b; });
      for (let c = 0; c < k; c++) {
        const m = points.filter((_, i) => next[i] === c);
        if (m.length) cents[c] = [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length];
        else { let far = 0; points.forEach((p, i) => { if (dist2(p, cents[next[i]!]!) > dist2(points[far]!, cents[next[far]!]!)) far = i; }); cents[c] = points[far]!; }
      }
      const same = next.every((l, i) => l === labels[i]); labels = next; if (same && it > 0) break;
    }
    const inertia = points.reduce((s, p, i) => s + dist2(p, cents[labels[i]!]!), 0);
    if (!best || inertia < best.inertia - 1e-12) best = { labels, centroids: cents.map(c => [c[0], c[1]] as [number, number]), inertia };
  }
  return best!;
}
export function silhouette(points: [number, number][], labels: number[]): number {
  const n = points.length; if (n < 3) return 0; let total = 0;
  for (let i = 0; i < n; i++) {
    const sums = new Map<number, { s: number; c: number }>();
    for (let j = 0; j < n; j++) { if (i === j) continue; const e = sums.get(labels[j]!) ?? { s: 0, c: 0 }; e.s += Math.sqrt(dist2(points[i]!, points[j]!)); e.c++; sums.set(labels[j]!, e); }
    const own = sums.get(labels[i]!); if (!own || own.c === 0) continue;
    const a = own.s / own.c; let b = Infinity; for (const [l, e] of sums) if (l !== labels[i]) b = Math.min(b, e.s / e.c);
    total += b === Infinity ? 0 : (b - a) / Math.max(a, b);
  }
  return total / n;
}
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Fit the map on current samples (one per site). Same input in any order → identical coordinates and clusters. */
export function fitVibe(input: VibeSite[]): VibeModel {
  const sites = [...input].sort((a, b) => a.domain.localeCompare(b.domain)), n = sites.length;
  const df = new Map<string, number>(); for (const s of sites) for (const t of new Set(s.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const tokens = [...df].filter(([, c]) => c >= VIBE_MIN_DF).map(([t]) => t).sort();
  const vocab = new Map(tokens.map((t, i) => [t, i]));
  const weights = tokens.map(t => { const d = df.get(t)!; const idf = Math.log((n + 1) / (d + 1)) + 1; return r4(d / n > VIBE_COMMON_SHARE ? idf * VIBE_COMMON_DAMP : idf); });
  const X = sites.map(s => vectorize(s.tokens, vocab, weights)), d = tokens.length;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j]!, 0) / Math.max(1, n));
  const Xc = X.map(r => r.map((x, j) => x - mean[j]!));
  const C = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => Xc.reduce((s, r) => s + r[a]! * r[b]!, 0) / Math.max(1, n)));
  const trace = C.reduce((s, r, i) => s + r[i]!, 0) || 1;
  const pc1 = powerIteration(C, VIBE_SEED);
  const C2 = C.map((row, a) => row.map((x, b) => x - pc1.value * pc1.vector[a]! * pc1.vector[b]!));
  const pc2 = powerIteration(C2, VIBE_SEED + 1);
  const components: [number[], number[]] = [pc1.vector.map(r4), pc2.vector.map(r4)];
  const axis = (v: number[], value: number): VibeAxis => { const order = v.map((x, j) => [x, j] as const); const pos = [...order].sort((a, b) => b[0] - a[0] || a[1] - b[1]).filter(x => x[0] > 0).slice(0, 2), neg = [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]).filter(x => x[0] < 0).slice(0, 2); return { positive: pos.map(x => tokens[x[1]]!), negative: neg.map(x => tokens[x[1]]!), explained: r4(value / trace) }; };
  const coords = Xc.map(r => [r4(r.reduce((s, x, j) => s + x * components[0][j]!, 0)), r4(r.reduce((s, x, j) => s + x * components[1][j]!, 0))] as [number, number]);
  const silhouettes: Record<string, number> = {}; let pick: { k: number; s: number; labels: number[]; centroids: [number, number][] } | null = null;
  for (const k of VIBE_K_RANGE) {
    if (n < k * 2) continue;
    const km = kmeans(coords, k), s = r4(silhouette(coords, km.labels)); silhouettes[k] = s;
    if (!pick || s > pick.s + 1e-9) pick = { k, s, labels: km.labels, centroids: km.centroids };
  }
  if (!pick) pick = { k: 1, s: 0, labels: coords.map(() => 0), centroids: [[0, 0]] };
  // Stable ids: larger clusters first, then by centroid x.
  const sizes = pick.centroids.map((_, c) => pick!.labels.filter(l => l === c).length);
  const order = pick.centroids.map((_, c) => c).sort((a, b) => sizes[b]! - sizes[a]! || pick!.centroids[a]![0] - pick!.centroids[b]![0] || pick!.centroids[a]![1] - pick!.centroids[b]![1]);
  const remap = new Map(order.map((c, i) => [c, i]));
  const points: VibePoint[] = sites.map((s, i) => ({ domain: s.domain, sector: s.sector, x: coords[i]![0], y: coords[i]![1], cluster: remap.get(pick!.labels[i]!)!, tokens: s.tokens }));
  const prevalence = (list: VibePoint[]) => { const m = new Map<string, number>(); for (const p of list) for (const t of new Set(p.tokens)) m.set(t, (m.get(t) ?? 0) + 1); return m; };
  const overall = prevalence(points), used = new Set<string>();
  const clusters: VibeCluster[] = order.map((orig, id) => {
    const members = points.filter(p => p.cluster === id), prev = prevalence(members);
    const ranked = [...prev].map(([tag, c]) => ({ tag, share: c / members.length, lift: c / members.length - (overall.get(tag) ?? 0) / n })).filter(x => x.share >= 0.25).sort((a, b) => b.lift - a.lift || a.tag.localeCompare(b.tag));
    const name = clusterName(ranked.map(r => r.tag), used, id); used.add(name);
    const sectors = new Map<string, number>(); for (const m of members) sectors.set(m.sector, (sectors.get(m.sector) ?? 0) + 1);
    return { id, name, n: members.length, share: r4(members.length / Math.max(1, n)), centroid: [r4(pick!.centroids[orig]![0]), r4(pick!.centroids[orig]![1])], top_tags: ranked.slice(0, 5).map(r => ({ tag: r.tag, share: r4(r.share), lift_pts: Math.round(r.lift * 1000) / 10 })), top_sectors: [...sectors].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([sector, c]) => ({ sector, n: c })) };
  });
  return { tokens, weights, mean: mean.map(r4), components, axes: [axis(components[0], pc1.value), axis(components[1], pc2.value)], k: pick.k, silhouette: pick.s, silhouettes, n, points, clusters };
}
/** Name from the top two distinguishing tags ("editorial · serif"); falls back to the next tags, then "#id", for uniqueness. */
export function clusterName(rankedTags: string[], taken: Set<string>, id: number): string {
  const tags = rankedTags.slice(0, 4);
  const options = [[0, 1], [0, 2], [1, 2], [0, 3]].map(([a, b]) => [tags[a!], tags[b!]].filter((t): t is string => !!t).map(tagPhrase).join(" · ")).filter(Boolean);
  for (const o of options) if (!taken.has(o)) return o;
  return `${options[0] ?? "mixed"} #${id + 1}`;
}
export function projectTokens(model: Pick<VibeModel, "tokens" | "weights" | "mean" | "components">, tokens: string[]): [number, number] {
  const v = vectorize(tokens, new Map(model.tokens.map((t, i) => [t, i])), model.weights).map((x, j) => x - model.mean[j]!);
  return [r4(v.reduce((s, x, j) => s + x * model.components[0][j]!, 0)), r4(v.reduce((s, x, j) => s + x * model.components[1][j]!, 0))];
}
export function nearestCluster(clusters: Pick<VibeCluster, "id" | "centroid">[], p: [number, number]) { let best = clusters[0]?.id ?? 0, d = Infinity; for (const c of clusters) { const e = dist2(p, c.centroid); if (e < d - 1e-15) { d = e; best = c.id; } } return best; }
/** Project earlier quarters with the current model and compare cluster share against the earliest quarter with ≥30 tagged sites. */
export function clusterMomentum(model: VibeModel, history: VibeSite[]) {
  const byQ = new Map<string, VibeSite[]>(); for (const s of history) byQ.set(s.quarter, [...(byQ.get(s.quarter) ?? []), s]);
  const base = [...byQ].filter(([, l]) => l.length >= VIBE_HISTORY_MIN_SITES).sort((a, b) => a[0].localeCompare(b[0]))[0];
  const projected = history.map(s => { const xy = projectTokens(model, s.tokens); return { ...s, x: xy[0], y: xy[1], cluster: nearestCluster(model.clusters, xy) }; });
  const momentum = new Map<number, { from_quarter: string; from_n: number; from_share: number; now_share: number; delta_pts: number } | null>();
  for (const c of model.clusters) {
    if (!base) { momentum.set(c.id, null); continue; }
    const then = projected.filter(p => p.quarter === base[0]), fromShare = then.filter(p => p.cluster === c.id).length / then.length;
    momentum.set(c.id, { from_quarter: base[0], from_n: then.length, from_share: r4(fromShare), now_share: c.share, delta_pts: Math.round((c.share - fromShare) * 1000) / 10 });
  }
  return { projected, momentum, base_quarter: base?.[0] ?? null };
}
