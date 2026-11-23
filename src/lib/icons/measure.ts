// W3d Part 2 · the colour an app icon sits on, per App Store category and across categories. Pure: rows in, numbers out, so the study,
// its check and the tests read one result. An icon's ground is the palette colour holding most of it, named by the same families the
// strips draw (colour-family.ts), with white, grey and black named as themselves; under MIXED_BELOW the icon has no ground ("mixed").
import { familyOf } from "../colour-family";
import { HUE_FAMILIES, familyLabel } from "../art/accent";
import { oklab } from "../art/palette";
import { longDate, weekMonday } from "../digest/week";

/** An icon whose largest colour holds less than this share has no ground: "mixed". */
export const MIXED_BELOW = 0.35;
/** A category with fewer stored apps than this in the week is left out (a short chart is not a top 100). */
export const CATEGORY_MIN_APPS = 80;
/** The study exists for readers only when the newest week holds at least this many categories of at least CATEGORY_MIN_APPS apps. */
export const STUDY_MIN_CATEGORIES = 12;
/** "Mostly one colour": the leading ground holds more than this share of the category. */
export const MOSTLY = 0.5;
/** App names shown per lean. */
export const LEAN_EXAMPLES = 3;
/** Grounds in the strips' order: the eight hues, then white, grey, black; mixed last. */
export const GROUNDS = [...HUE_FAMILIES, "white", "grey", "black", "mixed"] as const;
export type Ground = (typeof GROUNDS)[number];
export type ShownGround = Exclude<Ground, "mixed">;
export const groundLabel = (g: Ground) => familyLabel(g);

export type IconPalette = readonly { hex: string; share: number }[];
export type IconIn = { app_id: string; rank: number; name: string; maker: string; link: string; palette: IconPalette; genre_id: number; genre_name: string; week: string; removed_at?: string | null };
export type IconGround = { ground: Ground; hex: string; share: number };

/** The colour named for a hex: a hue, or white, grey or black. */
export function colourOf(hex: string): ShownGround {
  const id = familyOf(hex).id;
  return id === "n-white" ? "white" : id === "n-grey" ? "grey" : id === "n-black" ? "black" : (id.split("-")[0] as ShownGround);
}
/** The icon's ground: its largest-share colour (the first listed on a tie), or "mixed" when that share is under MIXED_BELOW. The hex is
 * always the largest colour's own measured hex (a mixed icon's swatch is still its largest colour). */
export function groundOf(palette: IconPalette): IconGround {
  const top = palette.reduce<{ hex: string; share: number } | null>((m, c) => (!m || c.share > m.share ? c : m), null);
  if (!top) return { ground: "mixed", hex: "#808080", share: 0 };
  const hex = top.hex.toUpperCase();
  return { ground: top.share < MIXED_BELOW ? "mixed" : colourOf(hex), hex, share: top.share };
}
const ORDER = new Map(GROUNDS.map((g, k) => [g, k]));
const zero = () => Object.fromEntries(GROUNDS.map(g => [g, 0])) as Record<Ground, number>;

export type IconCell = { app_id: string; rank: number; name: string; link: string; hex: string; ground: Ground; L: number };
export type CategoryReading = {
  id: number; name: string; apps: number;
  counts: Record<Ground, number>;
  /** Shown grounds by count, most first (strip order on ties); mixed is never among them. */
  top: { ground: ShownGround; n: number }[];
  /** The ground with the most icons, and every ground tied with it (one entry when there is no tie). */
  leading: { grounds: ShownGround[]; n: number; share: number };
  mixedShare: number;
  /** Each icon's own ground colour, by ground in strip order then lightest first, so the row reads as bands. */
  cells: IconCell[];
};
export type Lean = { category: string; ground: ShownGround; n: number; apps: number; allN: number; allApps: number; points: number; examples: { name: string; link: string }[] };
export type WeekReading = { week: string | null; categories: CategoryReading[]; leftOut: { name: string; apps: number }[]; all: { apps: number; counts: Record<Ground, number> }; leans: Lean[] };

/** The newest week with stored, not-removed rows. */
export const newestWeek = (rows: readonly Pick<IconIn, "week" | "removed_at">[]) => rows.reduce<string | null>((m, r) => (r.removed_at ? m : !m || r.week > m ? r.week : m), null);

export function readCategory(id: number, name: string, apps: readonly IconIn[]): CategoryReading {
  const counts = zero(), cells: IconCell[] = [];
  for (const a of apps) { const g = groundOf(a.palette); counts[g.ground]++; cells.push({ app_id: a.app_id, rank: a.rank, name: a.name, link: a.link, hex: g.hex, ground: g.ground, L: oklab(g.hex).L }); }
  cells.sort((x, y) => ORDER.get(x.ground)! - ORDER.get(y.ground)! || y.L - x.L || x.rank - y.rank);
  const top = GROUNDS.filter((g): g is ShownGround => g !== "mixed" && counts[g] > 0).map(g => ({ ground: g, n: counts[g] })).sort((x, y) => y.n - x.n || ORDER.get(x.ground)! - ORDER.get(y.ground)!);
  const n = top[0]?.n ?? 0;
  return { id, name, apps: apps.length, counts, top, leading: { grounds: top.filter(t => t.n === n && n > 0).map(t => t.ground), n, share: apps.length ? n / apps.length : 0 }, mixedShare: apps.length ? counts.mixed / apps.length : 0, cells };
}

/** One week's reading: categories of at least CATEGORY_MIN_APPS apps (removed apps never count), most concentrated leading ground first;
 * the shares across those categories; and each category's lean. */
export function readWeek(rows: readonly IconIn[], week: string | null = newestWeek(rows)): WeekReading {
  const live = rows.filter(r => !r.removed_at && r.week === week), by = new Map<number, IconIn[]>();
  for (const r of live) { const l = by.get(r.genre_id); if (l) l.push(r); else by.set(r.genre_id, [r]); }
  const categories: CategoryReading[] = [], leftOut: { name: string; apps: number }[] = [];
  for (const [id, apps] of by) {
    const name = apps[0]!.genre_name;
    if (apps.length < CATEGORY_MIN_APPS) leftOut.push({ name, apps: apps.length });
    else categories.push(readCategory(id, name, apps.sort((a, b) => a.rank - b.rank)));
  }
  categories.sort((a, b) => b.leading.share - a.leading.share || a.name.localeCompare(b.name));
  leftOut.sort((a, b) => a.name.localeCompare(b.name));
  const all = { apps: categories.reduce((s, c) => s + c.apps, 0), counts: zero() };
  for (const c of categories) for (const g of GROUNDS) all.counts[g] += c.counts[g];
  return { week, categories, leftOut, all, leans: categories.map(c => leanOf(c, all, live)) };
}

/** A category's lean: the ground whose share in the category is furthest above its share across all categories, in points (ties: the
 * larger count, then strip order). Mixed is not a ground and never a lean. */
export function leanOf(c: CategoryReading, all: WeekReading["all"], rows: readonly IconIn[] = []): Lean {
  let best: { g: ShownGround; pts: number } | null = null;
  for (const g of GROUNDS) {
    if (g === "mixed" || !c.counts[g]) continue;
    const pts = (c.counts[g] / c.apps - (all.apps ? all.counts[g] / all.apps : 0)) * 100;
    if (!best || pts > best.pts + 1e-9 || (Math.abs(pts - best.pts) <= 1e-9 && c.counts[g] > c.counts[best.g])) best = { g, pts };
  }
  const g = best?.g ?? c.top[0]?.ground ?? "white";
  const examples = rows.filter(r => r.genre_id === c.id && !r.removed_at && groundOf(r.palette).ground === g).sort((a, b) => a.rank - b.rank).slice(0, LEAN_EXAMPLES).map(r => ({ name: r.name, link: r.link }));
  return { category: c.name, ground: g, n: c.counts[g], apps: c.apps, allN: all.counts[g], allApps: all.apps, points: Math.round((best?.pts ?? 0) * 10) / 10, examples };
}
/** "Finance leans green: 15 of 100, against 6 of 100 across all categories". */
export const leanText = (l: Lean) => `${l.category} leans ${l.ground}: ${l.n} of ${l.apps}, against ${Math.round((l.allN / Math.max(1, l.allApps)) * 100)} of 100 across all categories`;
/** "Blue 23 · White 21 · Green 15" (and "· 12 mixed" when any icon has no ground). */
export const topText = (c: CategoryReading) => [...c.top.slice(0, 3).map(t => `${groundLabel(t.ground)} ${t.n}`), ...(c.counts.mixed ? [`${c.counts.mixed} mixed`] : [])].join(" · ");
