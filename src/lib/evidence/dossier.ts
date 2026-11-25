// Y1 · THE EVIDENCE DESK'S DOSSIER (pure). For a signal that really moved, dated outside facts in four drawers, matched by rule first:
// Platform (browser feature dates from platform-dates.json for css:* traits; download-count turns from the indicators table for the
// signal's topic), Business (news-wire and Product Hunt items naming a brand that shows the trait), Culture (news-wire items whose own
// title or summary carries one of the trait's keywords), Calendar (the same quarter's share in earlier years, from our own history).
// A model may propose wire matches; those are marked "model" and must quote matching words found in the item's title or summary.
// Structure signals (nav/ask/furn/page/phone) use Business and Calendar only; furn:ask_ai matches wire items about AI assistants/agents.
import { BRAND_NAME } from "../brand";
import platform from "@/data/platform-dates.json";
import { timing, type Phase, type Quarter } from "./timing";

export const DRAWERS = ["platform", "business", "culture", "calendar"] as const;
export type Drawer = (typeof DRAWERS)[number];
export type Entry = {
  drawer: Drawer; date: string; /** YYYY-MM or YYYY-MM-DD */ sentence: string; source: string; link: string | null; brand: string | null;
  match: "rule" | "model"; /** model entries only: the matching words quoted from the item's own title or summary (stored, not shown) */ quote?: string;
  phase?: Phase; id: string;
};
export type PlatformRow = { trait: string; feature: string; chrome: string | null; safari: string | null; firefox: string | null; all_three: string | null; source: string | null };
export const PLATFORM: readonly PlatformRow[] = (platform as { rows: PlatformRow[] }).rows;
export const STRUCTURE_PREFIXES = ["nav:", "ask:", "furn:", "page:", "phone:"];
export const isStructure = (k: string) => STRUCTURE_PREFIXES.some(p => k.startsWith(p));
export const drawersFor = (k: string): Drawer[] => isStructure(k) ? ["business", "calendar"] : k.startsWith("css:") ? ["platform", "business", "culture", "calendar"] : ["platform", "business", "culture", "calendar"];

/** Keyword lists per trait, kept in code (whole-word, case-insensitive). A trait not listed has no Culture matching. */
export const KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  "furn:ask_ai": ["ai assistant", "ai agent", "agents", "agentic", "chatbot", "copilot", "ask ai"],
  "css:starting_style": ["entry animation", "@starting-style", "starting-style"], "combo:motion_rich": ["motion design", "animation", "animated"],
  "css:view_transitions": ["view transition", "view transitions"], "css:scroll_timeline": ["scroll-driven", "scroll animation"],
  "combo:big_type": ["big type", "oversized type", "giant type", "large type"], "combo:editorial_serif": ["serif", "editorial typography"],
  "headline:serif": ["serif"], "css:variable_fonts": ["variable font", "variable fonts"], "imagery:3d_render": ["3d render", "3d"],
  "combo:immersive_3d": ["webgl", "3d", "immersive"], "hero_media:webgl": ["webgl", "three.js"], "combo:playful_brand": ["playful"],
  "palette:vivid": ["vivid colour", "vivid color", "bold colour", "bright colour"], "combo:organic": ["organic", "biophilic"],
  "imagery:data_viz": ["data visualisation", "data visualization", "infographic"], "components:marquee": ["marquee"],
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The first keyword (as written in the text) found in title or summary, or null. */
export function keywordIn(text: string, words: readonly string[]): string | null {
  for (const w of words) { const m = new RegExp(`(^|[^a-z0-9])(${esc(w)})(?![a-z0-9])`, "i").exec(text); if (m) return m[2]!; }
  return null;
}
/** Whether a model's quote really appears in the item's own title or summary (the standards desk re-checks this). */
export const quoteHolds = (quote: string, item: { title: string; excerpt: string | null }) => !!quote.trim() && `${item.title} ${item.excerpt ?? ""}`.toLowerCase().includes(quote.trim().toLowerCase());

export type WireIn = { id: number; title: string; excerpt: string | null; url: string; source: string; source_kind: string; published_at: string };
export type BrandIn = { domain: string; name: string };
export type IndicatorIn = { key: string; label: string; period_end: string; value: number; source: string };
export type ModelMatch = { wire: number; drawer: "business" | "culture"; quote: string; brand?: string | null };
export type DossierIn = {
  signal: string; name: string; quarters: readonly Quarter[]; wire: readonly WireIn[]; brands: readonly BrandIn[]; indicators: readonly IndicatorIn[];
  model?: readonly ModelMatch[];
};
const OUTLET = new Set(["rss", "hn", "producthunt"]);
const day = (s: string) => s.slice(0, 10);
const monthWord = (m: string) => { const [y, n] = m.split("-"); return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(n) - 1]} ${y}`; };

function platformEntries(signal: string): Entry[] {
  const r = PLATFORM.find(x => x.trait === signal);
  if (!r || !r.source) return [];
  const out: Entry[] = [];
  if (r.all_three) out.push({ id: `p:${signal}:all`, drawer: "platform", date: r.all_three, sentence: `${r.feature} reached all three major browsers (Chrome, Safari and Firefox) in ${monthWord(r.all_three)}.`, source: "MDN", link: r.source, brand: null, match: "rule" });
  const first = [["Chrome", r.chrome], ["Safari", r.safari], ["Firefox", r.firefox]].filter((x): x is [string, string] => !!x[1]).sort((a, b) => a[1].localeCompare(b[1]))[0];
  if (first) out.push({ id: `p:${signal}:first`, drawer: "platform", date: first[1], sentence: `${r.feature} first shipped in ${first[0]} in ${monthWord(first[1])}.`, source: "MDN", link: r.source, brand: null, match: "rule" });
  return out;
}
/** A download-count turn: the week a tracked library's weekly downloads first exceeded double its earliest stored week. */
function indicatorEntries(rows: readonly IndicatorIn[]): Entry[] {
  const by = new Map<string, IndicatorIn[]>(); for (const r of rows) by.set(r.key, [...(by.get(r.key) ?? []), r]);
  return [...by.values()].flatMap(rs => { const s = [...rs].sort((a, b) => a.period_end.localeCompare(b.period_end)), base = s[0];
    const turn = base && base.value > 0 ? s.find(x => x.value >= 2 * base.value) : undefined;
    return turn ? [{ id: `i:${turn.key}:${turn.period_end}`, drawer: "platform" as const, date: day(turn.period_end), sentence: `Weekly downloads of ${turn.label} on ${turn.source} were more than double their first stored week by the week ending ${day(turn.period_end)}.`, source: turn.source, link: null, brand: null, match: "rule" as const }] : []; });
}
export function buildDossier(i: DossierIn, drawers = drawersFor(i.signal)): { entries: Entry[]; riseStart: string | null; riseEnd: string | null } {
  const t = timing(i.quarters), out: Entry[] = [], has = (d: Drawer) => drawers.includes(d);
  if (has("platform")) out.push(...platformEntries(i.signal), ...indicatorEntries(i.indicators));
  const words = KEYWORDS[i.signal] ?? [];
  for (const w of i.wire.filter(x => OUTLET.has(x.source_kind))) {
    const text = `${w.title} ${w.excerpt ?? ""}`;
    if (has("business")) for (const b of i.brands) {
      if (b.name.length < 3) continue;
      const hit = keywordIn(w.title, [b.name, b.domain]);
      if (hit && /launch|rais|fund|series [a-e]|pric|rebrand|acquir|announc/i.test(text))
        out.push({ id: `b:${w.id}:${b.domain}`, drawer: "business", date: day(w.published_at), sentence: `${w.source} reported: “${w.title.slice(0, 140)}”.`, source: w.source, link: w.url, brand: b.domain, match: "rule" });
    }
    if (has("culture") && words.length) { const hit = keywordIn(text, words); if (hit) out.push({ id: `c:${w.id}`, drawer: "culture", date: day(w.published_at), sentence: `${w.source} published “${w.title.slice(0, 140)}”.`, source: w.source, link: w.url, brand: null, match: "rule" }); }
    if (has("business") && i.signal === "furn:ask_ai") { const hit = keywordIn(text, words); if (hit) out.push({ id: `b:${w.id}:ai`, drawer: "business", date: day(w.published_at), sentence: `${w.source} reported: “${w.title.slice(0, 140)}”.`, source: w.source, link: w.url, brand: null, match: "rule" }); }
  }
  for (const m of i.model ?? []) {
    const w = i.wire.find(x => x.id === m.wire);
    if (!w || !has(m.drawer) || !quoteHolds(m.quote, w) || out.some(e => e.link === w.url)) continue;
    out.push({ id: `m:${w.id}`, drawer: m.drawer, date: day(w.published_at), sentence: `${w.source} published “${w.title.slice(0, 140)}”.`, source: w.source, link: w.url, brand: m.brand ?? null, match: "model", quote: m.quote });
  }
  if (has("calendar")) out.push(...calendarEntries(i));
  const seen = new Set<string>();
  const entries = out.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true))).map(e => ({ ...e, phase: t.phaseOf(e.date) })).sort((a, b) => a.date.localeCompare(b.date));
  return { entries, riseStart: t.riseStart, riseEnd: t.riseEnd };
}
/** Calendar: when the newest quarter's share sits clearly above the same quarter in earlier years too, the season is a pattern. */
function calendarEntries(i: DossierIn): Entry[] {
  const qs = [...i.quarters].filter(q => q.s != null && q.n >= 15), last = qs.at(-1);
  if (!last) return [];
  const qn = last.q.slice(4), same = qs.filter(q => q.q.endsWith(qn) && q.q !== last.q), other = qs.filter(q => !q.q.endsWith(qn));
  if (same.length < 2 || other.length < 2) return [];
  const avg = (xs: Quarter[]) => xs.reduce((t, x) => t + x.s!, 0) / xs.length;
  if (avg(same) < avg(other) * 1.5) return [];
  const season = { Q1: "first", Q2: "second", Q3: "third", Q4: "fourth" }[qn] ?? qn;
  return [{ id: `k:${i.signal}:${qn}`, drawer: "calendar", date: `${same[0]!.q.slice(0, 4)}-${String((Number(qn.slice(1)) - 1) * 3 + 1).padStart(2, "0")}`, sentence: `In ${BRAND_NAME}'s own history, ${i.name} has been more common in the ${season} quarter of the year than in the others since ${same[0]!.q.slice(0, 4)}.`, source: BRAND_NAME, link: `/signals/${encodeURIComponent(i.signal)}`, brand: null, match: "rule" }];
}
