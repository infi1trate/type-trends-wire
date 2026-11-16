// The vanguard: brands worth a full daily crawl (the crawler asks for them in GET /api/public/library-state). Pure.
export const VANGUARD_TOP_TRENDSETTERS = 30;
export const VANGUARD_STORY_DAYS = 14;
export const VANGUARD_STORY_TYPES: readonly string[] = ["move", "rebrand", "counter_move"];
export const VANGUARD_MAX = 45;

export type VanguardInput = {
  /** Trendsetter ranks in the reader run. */
  trendsetters: { domain: string; rank: number }[];
  /** Stories with the editor's overlay applied (state is the shown state). */
  stories: { type: string; state: string; domains: string[]; happened_at: string }[];
  /** Active library sites. */
  active: Iterable<string>;
  now: number;
};
/**
 * Top VANGUARD_TOP_TRENDSETTERS by trendsetter rank, then any brand with a published MOVE, REBRAND or COUNTER-MOVE story in the last
 * VANGUARD_STORY_DAYS days (newest story first), active library sites only, capped at VANGUARD_MAX, returned sorted by domain.
 */
export function vanguardList(i: VanguardInput): string[] {
  const active = new Set(i.active), picked: string[] = [], seen = new Set<string>();
  const add = (d: string) => { if (picked.length >= VANGUARD_MAX || seen.has(d) || !active.has(d)) return; seen.add(d); picked.push(d); };
  [...i.trendsetters].sort((a, b) => a.rank - b.rank || a.domain.localeCompare(b.domain)).filter(t => active.has(t.domain)).slice(0, VANGUARD_TOP_TRENDSETTERS).forEach(t => add(t.domain));
  const since = i.now - VANGUARD_STORY_DAYS * 864e5;
  [...i.stories].filter(s => s.state === "published" && VANGUARD_STORY_TYPES.includes(s.type) && Date.parse(s.happened_at) >= since && Date.parse(s.happened_at) <= i.now + 36e5)
    .sort((a, b) => b.happened_at.localeCompare(a.happened_at)).forEach(s => s.domains.forEach(add));
  return picked.sort((a, b) => a.localeCompare(b));
}
