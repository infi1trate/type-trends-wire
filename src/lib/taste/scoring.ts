export type Candidate = { share: number; momentum?: number | null; stage?: string | null; trendsetter_share?: number | null; trendsetter_sites?: number; trendsetter_n?: number; vanguard_spread?: number | null; sector_share?: number | null; scope?: string };
export function rankCandidates<T extends Candidate>(items: T[], { biasAgainstConsensus = true }: { biasAgainstConsensus?: boolean } = {}) {
  return items.map(item => {
    const lead = Math.max(0, (item.trendsetter_share ?? item.share) - item.share) * 100;
    const momentum = item.momentum ?? 0, vanguard = Math.max(0, item.vanguard_spread ?? 0);
    const saturated = item.share >= .35 || item.stage === "peaking";
    const penalty = biasAgainstConsensus && saturated ? 25 + Math.max(0, item.share - .35) * 100 : 0;
    const decline = Math.max(0, -momentum) * 2 + (item.stage === "declining" ? 15 : 0);
    const score = Number((lead * .5 + vanguard * .25 + Math.max(0, momentum) * 2 - penalty - decline).toFixed(3));
    const why = [`${(item.share * 100).toFixed(1)}% adoption in ${item.scope ?? "all"}`];
    if (item.trendsetter_n) why.push(`used by ${item.trendsetter_sites ?? 0} of the top ${item.trendsetter_n} trendsetters vs ${(item.share * 100).toFixed(1)}% of the comparison scope`);
    if (item.momentum != null) why.push(`momentum ${momentum >= 0 ? "+" : ""}${momentum.toFixed(1)} pts/quarter`);
    if (vanguard) why.push(`vanguard lead +${vanguard.toFixed(1)} pts`);
    if (penalty) why.push(`${item.stage === "peaking" ? "peaking" : "saturated"} in ${item.scope ?? "all"} (${(item.share * 100).toFixed(0)}%) — down-ranked`);
    if (decline) why.push("declining adoption — down-ranked");
    if (item.momentum == null) why.push("insufficient quarterly coverage; momentum unknown");
    return { ...item, score, why };
  }).sort((a, b) => b.score - a.score);
}