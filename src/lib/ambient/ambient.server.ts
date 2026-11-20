// Loads what the ambient board shows from loaders the product already has (front model, story index, brand page, collection wall,
// Morning Line, data story), all memoised; nothing here queries per scene. Anonymous SELECT-only, no AI. Picks rotate by UTC day.
import { memoBy } from "../memo";
import { loadFront } from "../front/front.server";
import { storyIndex } from "../stories/read.server";
import { streamOf } from "../stories/view";
import { latestSignals } from "../signals.server";
import { label } from "../labels";
import { rowKey } from "../signals";
import { pct } from "../digest/copy";
import { dataShelf } from "../data-stories/build";
import { dayNumber } from "../front/chart-day";
import type { FrontStory } from "../front/front";
import type { AmbientInput, AmbientStory } from "./playlist";

const story = (s: FrontStory): AmbientStory => ({ id: s.id, number: s.number, headline: s.headline, typeName: s.typeName, sector: s.sector, sectorName: s.sectorName, at: s.at, line: s.line });
const pick = <T,>(xs: readonly T[], day: string): T | null => (xs.length ? xs[dayNumber(day) % xs.length]! : null);
const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

async function build(sector: string): Promise<AmbientInput> {
  const m = await loadFront(sector, "all");
  const [move, collection, figure, data] = await Promise.all([safe(moveOf()), safe(collectionOf(m.collections.map(c => c.slug), m.today)), safe(figureOf()), safe(dataOf(m.today))]);
  const l = m.lead, spark = l?.evidence?.kind === "spark" ? l.evidence : null;
  const line = m.chart?.kind === "line" ? m.chart.series[0] : null;
  const chart = line && line.points.length >= 2 ? { title: m.chart!.title, name: line.label, note: m.chart!.note, points: line.points }
    : spark && spark.points.length >= 2 ? { title: `${spark.name}, quarter by quarter`, name: spark.name, note: "Share of tracked homepages, well-covered quarters, all sectors.", points: spark.points.map((y, i) => ({ x: spark.quarters?.[i] ?? `Q${i + 1}`, y })) } : null;
  return {
    now: m.now, today: m.today, state: m.state, sector: m.sector, ticker: m.ticker, freshness: m.freshness,
    lead: l ? { ...story(l.story), label: l.label, why: l.story.line ?? null } : null,
    stories: m.column.items.map(story), chart, move, collection, figure, data,
  };
}
/** Brands tried, newest move first, for one with a redrawn pair (a folded back-and-forth row has none). */
const MOVE_TRIES = 4;
/** The newest move story's brand, and that brand page's newest redrawn before / after pair. */
async function moveOf(): Promise<AmbientInput["move"]> {
  const domains = [...new Set(streamOf(await storyIndex()).filter(x => (x.type === "move" || x.type === "rebrand" || x.type === "counter_move") && x.domains.length > 0).map(x => x.domains[0]!))].slice(0, MOVE_TRIES);
  const { loadBrand } = await import("../read.server");
  for (const d of domains) {
    const b = await loadBrand(d), t = b?.timeline.find(x => x.pair);
    if (b && t?.pair) return { domain: b.domain, name: b.name, text: t.text, at: t.at, pair: t.pair };
  }
  return null;
}
async function collectionOf(slugs: string[], day: string): Promise<AmbientInput["collection"]> {
  const slug = pick(slugs, day);
  if (!slug) return null;
  const { loadCollection } = await import("../gallery.server");
  const c = await loadCollection(slug, 1);
  return c.kind === "live" ? { slug: c.slug, number: c.number, title: c.title, tiles: c.gallery.tiles.slice(0, 12) } : null;
}
/** The Morning Line's figure for today, as its signal's share of tracked homepages (all sectors). */
async function figureOf(): Promise<AmbientInput["figure"]> {
  const { loadMorning } = await import("../editions/editions.server");
  const e = (await loadMorning(null))?.edition, f = e?.figure;
  // A chart's trait carries its scope ("css:subgrid:all"); a signal key is "dimension:value".
  const key = f ? (f.kind === "chart" ? f.trait.replace(/:[^:]+$/, "") : f.key) : null;
  if (!key) return null;
  const { snap } = await latestSignals("all"), row = snap.rows.find(r => r.scope === "all" && rowKey(r) === key);
  const v = row?.current_share != null ? pct(row.current_share, 0) : null;
  return v ? { value: v, name: label(key).name, key, caption: `${label(key).name}: ${v} of tracked homepages, all sectors, in the latest forecast.` } : null;
}
/** One live study (rotating by day): its key figure and the step that states it (else the last step). */
async function dataOf(day: string): Promise<AmbientInput["data"]> {
  const e = pick(dataShelf(), day);
  if (!e) return null;
  const { loadDataStory } = await import("../data-stories/page.server");
  const p = await loadDataStory(e.slug);
  if (p.kind !== "live") return null;
  const st = p.story, says = (x: (typeof st.steps)[number]) => x.caption.some(c => typeof c === "object" && "n" in c && c.n === st.key.n);
  const stepOf = st.steps.find(says) ?? st.steps.at(-1), figure = stepOf ? st.figures[stepOf.view.figure] : undefined;
  return stepOf && figure ? { slug: st.slug, number: st.number, question: st.question, headline: st.text.headline, key: st.key, step: stepOf, figure } : null;
}
export const AMBIENT_TTL_MS = 30_000;
const boards = memoBy(AMBIENT_TTL_MS, (sector: string) => build(sector), { key: s => s, max: 20 });
export const loadAmbient = (sector: string) => boards(sector);
