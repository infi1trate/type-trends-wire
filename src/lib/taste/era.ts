export type HistoryShare = { quarter: string; dimension: string; value: string; share: number | null; denom?: number | null; coverage?: number | null };
export function yearVectors(rows: HistoryShare[]) {
  const groups = new Map<number, Map<string, number[]>>();
  for (const r of rows) {
    const year = Number(r.quarter.slice(0, 4));
    if (!Number.isFinite(year) || r.share == null || r.coverage != null && r.coverage < .3) continue;
    const v = groups.get(year) ?? new Map<string, number[]>(), key = `${r.dimension}:${r.value}`;
    v.set(key, [...(v.get(key) ?? []), r.share]); groups.set(year, v);
  }
  return [...groups].map(([year, v]) => ({ year, vector: Object.fromEntries([...v].map(([k, xs]) => [k, xs.reduce((a, b) => a + b, 0) / xs.length])) }));
}
export function eraSimilarity(traits: string[], rows: HistoryShare[]) {
  const vectors = yearVectors(rows), set = new Set(traits);
  const scores = vectors.map(({ year, vector }) => {
    const keys = new Set([...Object.keys(vector), ...set]); let dot = 0, norm = 0;
    for (const k of keys) { const weight = k.startsWith("framework:") || k.startsWith("css:") ? 1.5 : 1, v = vector[k] ?? 0; if (set.has(k)) dot += v * weight; norm += v * v * weight; }
    const siteNorm = [...set].reduce((n, k) => n + (k.startsWith("framework:") || k.startsWith("css:") ? 1.5 : 1), 0);
    return { year, similarity: norm && siteNorm ? dot / Math.sqrt(norm * siteNorm) : 0, vector };
  }).sort((a, b) => b.similarity - a.similarity || b.year - a.year);
  const best = scores[0], latest = [...vectors].sort((a, b) => b.year - a.year)[0];
  const deltas = traits.map(trait => ({ trait, old_share: best?.vector[trait] ?? 0, current_share: latest?.vector[trait] ?? 0 }));
  return { looks_like_year: best && best.similarity > 0 ? best.year : null, similarity: best?.similarity ?? null, dated_by: [...deltas].sort((a, b) => (b.old_share - b.current_share) - (a.old_share - a.current_share)).filter(t => t.old_share > t.current_share).slice(0, 3), current_by: [...deltas].sort((a, b) => b.current_share - a.current_share).filter(t => t.current_share > 0).slice(0, 3), coverage_note: "Annual averages of observed quarters only; archive gaps can shift the estimate. Similarity is not a design date." };
}