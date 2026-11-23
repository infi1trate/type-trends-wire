// W3d · Study No. 8: the colour each App Store category's top free apps sit on. Pure over DataInput.icons (one stored week, measured
// colours only: slug keeps no icon picture). Existing chart form only: the swatch strips, here as equal cells, one per icon, in the
// icon's own measured hex. Figure 1 (the wall) is every category's icons by ground; figure 2 (the lean) lights the ground each category
// has most above its share across all categories. Headline and deck are written by rule from the stored counts and claim only those.
import type { DriftBand, DriftFig, Seg, Step, StoryModel } from "./types";
import { cap, num, ref } from "./text";
import { model, type Captures, type Meta } from "./stories";
import type { DataInput } from "./series";
import { ICONS_SLUG } from "./registry";
import { CATEGORY_MIN_APPS, MIXED_BELOW, MOSTLY, STUDY_MIN_CATEGORIES, leanText, readWeek, topText, type CategoryReading, type Lean, type ShownGround, type WeekReading } from "../icons/measure";
import { longDate, weekMonday } from "../digest/week";

const joinAnd = (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const g = (x: ShownGround) => x as string;
/** The categories whose one leading ground holds more than half of them. */
export const mostlyOne = (r: Pick<WeekReading, "categories">) => r.categories.filter(c => c.leading.grounds.length === 1 && c.leading.share > MOSTLY);
/** The headline, by rule. */
export function iconHeadline(r: Pick<WeekReading, "categories">): string {
  const m = mostlyOne(r);
  if (!m.length) return "No App Store category is mostly one colour";
  if (m.length === 1) return `${m[0]!.name} is the one App Store category that is mostly ${m[0]!.leading.grounds[0]}`;
  const gs = [...new Set(m.map(c => c.leading.grounds[0]!))];
  return gs.length === 1 ? `${joinAnd(m.map(c => c.name))} are the App Store categories that are mostly ${gs[0]}`
    : `${joinAnd(m.map(c => `${c.name} (${c.leading.grounds[0]})`))} are the App Store categories that are mostly one colour`;
}
/** "blue leads 11; black leads Entertainment, Music and Photo & Video; red and white tie in Food & Drink". */
export function leadClauses(r: Pick<WeekReading, "categories">): string[] {
  const by = new Map<string, string[]>(), ties: string[] = [];
  for (const c of r.categories) {
    if (c.leading.grounds.length > 1) { ties.push(`${joinAnd(c.leading.grounds.map(g))} tie in ${c.name}`); continue; }
    const k = c.leading.grounds[0]; if (!k) continue;
    by.set(k, [...(by.get(k) ?? []), c.name]);
  }
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  return [...groups.map(([k, names], j) => (j === 0 && names.length >= 3 ? `${k} leads ${names.length}` : `${k} leads ${joinAnd(names)}`)), ...ties];
}
export function iconDeck(r: Pick<WeekReading, "categories" | "week">): string {
  const mon = r.week ? weekMonday(r.week) : null;
  return `The colour under the top 100 free apps in ${r.categories.length} US App Store categories, week of ${mon ? longDate(mon.toISOString()) : "—"}: ${leadClauses(r).join("; ")}.`;
}
/** The check's other half: the headline's and deck's claims read back against counts recomputed from the rows (a rule or a stored
 *  text that names a category, a colour or a count the stored week does not show fails). */
export function iconHeadlineHolds(headline: string, deck: string, r: WeekReading): boolean {
  const m = mostlyOne(r), names = new Set(r.categories.map(c => c.name));
  if (/^No App Store category is mostly one colour$/.test(headline)) { if (m.length) return false; }
  else {
    const named = [...names].filter(n => headline.includes(n));
    if (named.length !== m.length || !m.every(c => named.includes(c.name) && headline.includes(c.leading.grounds[0]!))) return false;
  }
  const dm = /in (\d+) US App Store categories/.exec(deck);
  if (!dm || Number(dm[1]) !== r.categories.length) return false;
  for (const [, ground, n] of deck.matchAll(/(\w+) leads (\d+)\b/g)) if (r.categories.filter(c => c.leading.grounds.length === 1 && c.leading.grounds[0] === ground).length !== Number(n)) return false;
  return true;
}

export type IconStudyFigures = { categories: number; apps: number; leftOut: number; week: string | null; title: string; deck: string; headline: number; ready: boolean };
export function iconStudyFigures(i: Pick<DataInput, "icons">): IconStudyFigures {
  const r = readWeek(i.icons ?? []), title = iconHeadline(r), deck = iconDeck(r);
  return { categories: r.categories.length, apps: r.all.apps, leftOut: r.leftOut.length, week: r.week, title, deck, headline: iconHeadlineHolds(title, deck, r) ? 1 : 0, ready: r.categories.length >= STUDY_MIN_CATEGORIES };
}

const wallBand = (c: CategoryReading): DriftBand => ({ q: c.name, brands: c.apps, swatches: [], cells: c.cells.map(x => x.hex), note: topText(c) });
function leanBand(c: CategoryReading, l: Lean): DriftBand {
  const from = c.cells.findIndex(x => x.ground === l.ground), to = from < 0 ? 0 : from + l.n;
  return { q: c.name, brands: c.apps, swatches: [], cells: c.cells.map(x => x.hex), lit: [Math.max(0, from), to], note: leanText(l), links: l.examples.map(e => ({ label: e.name, href: e.link })) };
}

export function iconsStory(i: DataInput, _caps: Captures, m: Meta): StoryModel {
  const r = readWeek(i.icons ?? []), href = `/data/${ICONS_SLUG}`, title = iconHeadline(r), deck = iconDeck(r);
  const cats = r.categories, leans = [...r.leans].sort((a, b) => b.points - a.points || a.category.localeCompare(b.category));
  const byName = new Map(cats.map(c => [c.name, c]));
  const n = (v: number) => num(String(v), v, href), pct = (v: number) => num(`${Math.round(v * 100)}%`, v, href), cat = (name: string) => ref(name, href);
  const source = "Apple's public charts of top free apps, US App Store; icon colours measured by slug (no icon pictures kept)";
  const wall: DriftFig = { kind: "drift", source, title: "Each category's top free apps, one swatch per icon", scope: "US App Store, top free",
    note: `Each swatch is one icon's ground: the colour holding most of it, in its own measured colour. Rows run most one-colour first.`, rowHead: "Category", bands: cats.map(wallBand) };
  const lean: DriftFig = { kind: "drift", source, title: "Where each category leans", scope: "US App Store, top free", rowHead: "Category",
    note: "Lit: the ground each category has most above its share across all categories.", bands: leans.map(l => leanBand(byName.get(l.category)!, l)) };
  const top = cats[0], last = cats.at(-1), mostly = mostlyOne(r);
  const allTop = (Object.entries(r.all.counts) as [string, number][]).filter(([k]) => k !== "mixed").sort((a, b) => b[1] - a[1])[0];
  const steps: Step[] = [
    { id: "intro", caption: cap`${n(cats.length)} US App Store categories, ${n(r.all.apps)} icons from their charts of top free apps. Each icon is one swatch: the colour that holds most of it.`, view: { figure: "wall", highlight: [] } },
  ];
  if (allTop) steps.push({ id: "across", caption: cap`Across all ${n(cats.length)} categories the commonest ground is ${ref(allTop[0], href)}: ${n(allTop[1])} of ${n(r.all.apps)} icons.`, view: { figure: "wall", highlight: [] } });
  if (top) {
    const tail: Seg[] = mostly.length ? (mostly.length > 1 ? cap` ${n(mostly.length)} categories have one ground holding more than half.` : [" It is the only category where one ground holds more than half."]) : [" No category has one ground holding more than half."];
    steps.push({ id: "most", caption: [...cap`${cat(top.name)} is the most one-colour: ${n(top.leading.n)} of ${n(top.apps)} icons sit on ${top.leading.grounds.join(" and ")}.`, ...tail], view: { figure: "wall", highlight: [], focus: top.name } });
  }
  if (last && last !== top) steps.push({ id: "least", caption: cap`${cat(last.name)} is the least: its commonest ground, ${last.leading.grounds.join(" and ")}, holds ${n(last.leading.n)} of ${n(last.apps)}, and ${n(last.counts.mixed)} of its icons have no colour holding ${pct(MIXED_BELOW)} or more.`, view: { figure: "wall", highlight: [], focus: last.name } });
  const shownLeans = leans.slice(0, 3);
  for (const l of shownLeans) {
    const ex: Seg[] = l.examples.flatMap((e, k) => [k ? (k === l.examples.length - 1 ? " and " : ", ") : " Among them: ", ref(e.name, e.link)]);
    steps.push({ id: `lean-${l.category}`, caption: [...cap`${cat(l.category)} leans ${l.ground}: ${n(l.n)} of ${n(l.apps)}, against ${n(Math.round((l.allN / Math.max(1, l.allApps)) * 100))} of ${n(100)} across all categories.`, ...ex, ...(ex.length ? ["."] : [])], view: { figure: "lean", highlight: [], focus: l.category } });
  }
  steps.push({ id: "caveat", caption: ["The charts change every day, so this is one week's reading. A ground is a measured colour; it says nothing about why a maker chose it."], view: { figure: "wall", highlight: [] } });
  const mon = r.week ? weekMonday(r.week) : null, weekText = mon ? longDate(mon.toISOString()) : "—";
  const key = top ? { n: `${top.leading.n} of ${top.apps}`, label: `${top.name} icons on ${top.leading.grounds.join(" and ")}, the most one-colour category` } : { n: "—", label: "icons on one ground" };
  return model(m, i, { wall, lean }, steps,
    { brands: r.all.apps, captures: r.all.apps, period: `Week of ${weekText}`,
      rule: `An icon's ground is the colour holding the largest share of the icon, named by the same colour families the palette strips use, with white, grey and black named as themselves. When that colour holds less than ${Math.round(MIXED_BELOW * 100)}% of the icon, the icon has no ground and counts as mixed. A category's lean is the ground whose share in that category is furthest above its share across all categories, in points. Categories with fewer than ${CATEGORY_MIN_APPS} apps stored for the week are left out.`,
      lines: [`The lists are Apple's public charts of top free apps in the US App Store, read for the week of ${weekText}.`,
        "slug keeps no icon pictures: each icon is measured once in memory, and only its colours, the app's name, its maker and its App Store link are stored. Every app named links to its App Store page.",
        "The charts change every day, so this is one week's reading. An app's maker can ask for it to be removed."] },
    key,
    { scenes: [
        { id: "intro", lead: "One swatch per icon", steps: ["intro", ...(allTop ? ["across"] : [])] },
        { id: "wall", lead: "Most and least one-colour", steps: [...(top ? ["most"] : []), ...(last && last !== top ? ["least"] : [])] },
        { id: "lean", lead: "Where each category leans", steps: shownLeans.map(l => `lean-${l.category}`) },
        { id: "limits", lead: "One week's reading", steps: ["caveat"] },
      ].filter(s => s.steps.length),
      limits: ["One week of charts that change daily.", "A ground is a measured colour, not a maker's reason.", "Only the top 100 free apps in each category are read."],
      fallback: title,
      ranked: [{ label: "Categories, most one-colour first", order: cats.map(c => c.name) }] },
    { deck });
}
