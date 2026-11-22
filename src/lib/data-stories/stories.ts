// The studies themselves (data stories in code): one pure builder per registry entry, over `DataInput` plus the captures of the brands
// it puts on stage. Every caption is a template filled from numbers in the model; every number and name carries its receipt. E4: each
// builder also groups its steps into scenes, states what the data cannot show (limits) and supplies a template headline.
import type { Caption, Figure, Link, Seg, Step, StoryModel, View } from "./types";
import { cap, list, num, ref, pctText, qText, dayText, quarterOf, signalHref, brandHref, sectorHref, HISTORY_HREF, RULE_HREF } from "./text";
import { resolveScenes, oneScenePerStep, type SceneDef } from "./scenes";
import { activeSites, compositeSeries, nameOf, rowsIn, ruleText, sectorOfSite, shareSeries, usableQuarters, quarterCoverage, traitsOf, knows, byQuarter, type DataInput } from "./series";
import { multiplesFig, firstLast } from "./templates/multiples";
import { adoption, doubledAt } from "./templates/adoption";
import { brandField } from "./templates/field";
import { beforeAfter, strip, typeWord, type CaptureRaw } from "./templates/frames";
import { SOFTWARE, BIG_TYPE, softwareFigures } from "./checks";
import { COMPOSITES } from "../composites";
import { label, sectorName, basis as basisOf } from "../labels";
import { SECTORS } from "../library";
import { qIndex } from "../forecast";
import { multiplesChart } from "../chart/forms"; // L2 · the study builder reads the chart registry

export type Captures = Map<string, CaptureRaw[]>;
export type Meta = { slug: string; number: number; question: string; deck: string; template: string; collection: Link; related: Link[]; series?: string; seriesTitle?: string };
/** E4 · what a builder adds beside its steps: the scenes, the limits and the template headline. */
type Extras = { scenes?: SceneDef[]; limits?: string[]; fallback?: string; ranked?: { label: string; order: string[] }[] };

// Segments ------------------------------------------------------------------------------------------
const pct = (v: number, href: string) => num(pctText(v), v, href);
const cnt = (v: number, href: string) => num(String(v), v, href);
const qN = (q: string) => num(qText(q), qIndex(q), HISTORY_HREF);
const dayN = (at: string, href: string) => num(dayText(at), Date.parse(at), href);
const sig = (key: string) => ref(label(key).name, signalHref(key));
const sec = (s: string) => ref(sectorName(s), sectorHref(s));
const step = (id: string, caption: Caption, view: View): Step => ({ id, caption, view });
const brandRef = (i: DataInput) => { const n = nameOf(i); return (d: string) => ref(n(d), brandHref(d)); };
const lastDate = (i: DataInput) => i.captures.reduce<string | null>((m, c) => (!m || c.at > m ? c.at : m), null);
const capturesIn = (i: DataInput, sectors: readonly string[] | null) => { const u = new Set(usableQuarters(i, sectors)); return rowsIn(i, sectors).filter(r => u.has(r.quarter)).length; };

// A. WHAT HAPPENED TO THE SOFTWARE HOMEPAGE IN FIVE YEARS? -------------------------------------------------------
export function softwareStory(i: DataInput, caps: Captures, m: Meta): StoryModel {
  const scope = [...SOFTWARE.sectors], series = compositeSeries(i, scope), qs = usableQuarters(i, scope), b = brandRef(i);
  const panels = series.map(s => ({ id: s.key, label: s.name, href: `${signalHref(s.key)}?sector=${scope[0]}`, points: s.points.map(p => ({ x: p.q, y: p.share })) }));
  const multiples = multiplesFig({ title: "Twelve composite signals on software homepages", note: `Share of dev tools and enterprise SaaS homepages, per well-covered quarter. AI-estimated signals count AI-tagged captures only.`, unit: "share", chart: multiplesChart(qs.length, "line"), panels, xs: qs });
  const moves = panels.map(p => ({ p, fl: firstLast(p) })).filter((x): x is { p: typeof panels[number]; fl: NonNullable<ReturnType<typeof firstLast>> } => !!x.fl);
  const risers = [...moves].sort((a, c) => c.fl.change - a.fl.change || a.p.id.localeCompare(c.p.id));
  const fallers = [...moves].sort((a, c) => a.fl.change - c.fl.change || a.p.id.localeCompare(c.p.id));
  const sf = softwareFigures(i), figures: Record<string, Figure> = { multiples };
  const ai = (k: string) => (basisOf(k) === "ai" || COMPOSITES.find(c => c.key === k)?.basis === "ai" ? ", by AI estimate" : "");
  const steps: Step[] = [];
  const brands = activeSites(i, scope).length, first = qs[0], last = qs.at(-1);
  if (first && last) steps.push(step("intro", cap`${cnt(brands, sectorHref(scope[0]!))} ${sec(scope[0]!)} and ${sec(scope[1]!)} homepages, measured in ${cnt(qs.length, RULE_HREF)} well-covered quarters from ${qN(first)} to ${qN(last)}, on ${cnt(COMPOSITES.length, "/patterns")} composite signals.`, { figure: "multiples", highlight: [] }));
  risers.slice(0, 3).filter(r => r.fl.change > 0).forEach((r, k) => steps.push(step(`rise-${k + 1}`,
    cap`${k === 0 ? "The biggest move: " : k === 1 ? "Next: " : "Then "}${ref(r.p.label, r.p.href)} went from ${pct(r.fl.first.y, r.p.href)} in ${qN(r.fl.first.x)} to ${pct(r.fl.last.y, r.p.href)} in ${qN(r.fl.last.x)}${ai(r.p.id)}.`, { figure: "multiples", highlight: [r.p.id] })));
  const fall = fallers[0];
  if (fall && fall.fl.change <= -SOFTWARE.movePts) steps.push(step("fall", cap`The biggest fall: ${ref(fall.p.label, fall.p.href)} went from ${pct(fall.fl.first.y, fall.p.href)} to ${pct(fall.fl.last.y, fall.p.href)}${ai(fall.p.id)}.`, { figure: "multiples", highlight: [fall.p.id] }));
  else { const still = [...moves].sort((a, c) => Math.abs(a.fl.change) - Math.abs(c.fl.change))[0]; if (still) steps.push(step("still", cap`${ref(still.p.label, still.p.href)} barely moved: ${pct(still.fl.first.y, still.p.href)} then, ${pct(still.fl.last.y, still.p.href)} now.`, { figure: "multiples", highlight: [still.p.id] })); }
  steps.push(step("moved", cap`In all, ${cnt(sf.moved, RULE_HREF)} of the ${cnt(COMPOSITES.length, "/patterns")} composite signals moved ${num(`${SOFTWARE.movePts * 100} points`, SOFTWARE.movePts, RULE_HREF)} or more.`, { figure: "multiples", highlight: sf.movedKeys }));
  sf.topBrands.forEach((t, k) => {
    const cs = caps.get(t.domain) ?? [];
    if (!cs.length) return;
    const fig = strip({ title: `${nameOf(i)(t.domain)} through time`, note: "Every stored desktop homepage capture, redrawn from its stored layout boxes in its own colours.", domain: t.domain, name: nameOf(i)(t.domain), captures: cs, events: i.events.filter(e => e.domain === t.domain), crops: i.crops });
    const id = `strip-${k + 1}`; figures[id] = fig;
    const f0 = fig.frames[0]!, fN = fig.frames.at(-1)!;
    steps.push(step(`${id}-all`, cap`${k === 0 ? "The longest stored history: " : "Next longest: "}${b(t.domain)}, ${cnt(fig.frames.length, brandHref(t.domain))} captures from ${dayN(f0.at, HISTORY_HREF)} to ${dayN(fN.at, brandHref(t.domain))}, redrawn from their stored layouts.`, { figure: id, highlight: [], focus: f0.id }));
    const mk = fig.marks.find(x => x.after) ?? null;
    steps.push(mk
      ? step(`${id}-change`, [...cap`${cnt(fig.marks.length, brandHref(t.domain))} measured changes are marked; the first, a ${typeWord(mk.type).toLowerCase()}, `, ...whenSeen(i, Number(mk.id), mk.at, brandHref(t.domain)), "."], { figure: id, highlight: [mk.id], focus: mk.after })
      : step(`${id}-change`, cap`No measured change is marked between its captures.`, { figure: id, highlight: [], focus: fN.id }));
  });
  const top = [...moves].sort((a, c) => c.fl.last.y - a.fl.last.y)[0];
  if (top) steps.push(step("now", cap`Where it landed: ${ref(top.p.label, top.p.href)} is now on ${pct(top.fl.last.y, top.p.href)} of software homepages, the most common of the twelve.`, { figure: "multiples", highlight: [top.p.id] }));
  const r0 = risers[0], pts = r0 ? Math.abs(r0.fl.change * 100).toFixed(0) : "";
  return model(m, i, figures, steps, { brands, captures: capturesIn(i, scope), period: first && last ? `${qText(first)} to ${qText(last)}` : "—", rule: ruleText(scope),
    lines: ["AI-estimated composites count only AI-tagged captures in their denominators.", "Strips redraw stored layout boxes in each capture's own colours; no screenshots are stored."] },
    r0 ? { n: `${r0.fl.change >= 0 ? "+" : "−"}${pts} pts`, label: `${r0.p.label} on software homepages` } : { n: String(sf.moved), label: "composite signals moved" },
    {
      scenes: [
        { id: "field", lead: "Two sectors, twelve signals", steps: ["intro"] },
        { id: "rose", lead: "What rose", steps: ["rise-1", "rise-2", "rise-3"] },
        { id: "landed", lead: "What fell, and where it landed", steps: ["fall", "still", "moved", "now"] },
        { id: "first-brand", lead: "The longest stored history", steps: ["strip-1-all", "strip-1-change"] },
        { id: "second-brand", lead: "The next longest", steps: ["strip-2-all", "strip-2-change"] },
      ],
      limits: [ARCHIVE_LIMIT, "AI-estimated signals count only the captures our AI has read, so their shares rest on fewer homepages."],
      fallback: r0 ? `${r0.p.label} ${r0.fl.change >= 0 ? "gained" : "lost"} ${pts} points on software homepages` : `${sf.moved} composite signals moved on software homepages`,
    });
}

// B. WHO WENT BIG FIRST? ------------------------------------------------------------------------------------------
export function bigTypeStory(i: DataInput, _caps: Captures, m: Meta): StoryModel {
  const key = BIG_TYPE.key, href = signalHref(key), share = shareSeries(i, null, key), qs = usableQuarters(i, null), b = brandRef(i);
  const a = adoption({ signal: { key, name: label(key).name }, sites: activeSites(i, null), rows: rowsIn(i, null), usable: qs, share, title: `Who showed ${label(key).name} first`, note: "Each brand enters at the first well-covered capture that shows the signal; brands that already showed it in their first capture sit in the first column, start unknown." });
  const steps: Step[] = [], first = share[0], last = share.at(-1);
  if (first && last) steps.push(step("now", cap`${pct(last.share, href)} of tracked homepages set ${sig(key)} in ${qN(last.q)}, against ${pct(first.share, href)} in ${qN(first.q)}.`, { figure: "adoption", highlight: [], focus: last.q }));
  if (a.censored.length) steps.push(step("already", cap`${cnt(a.censored.length, href)} brands already showed it in their first well-covered capture, so when they started is unknown.`, { figure: "adoption", highlight: a.censored.map(x => x.domain), focus: a.censored[0]!.first }));
  const three = a.entries.slice(0, 3);
  if (three.length) { const qa = three[0]!.first, qz = three.at(-1)!.first;
    steps.push(step("first-three", [...cap`The first ${cnt(three.length, href)} we can date: `, ...list(three.map(x => b(x.domain))), ...(qa === qz ? cap`, all first seen in ${qN(qa)}.` : cap`, first seen between ${qN(qa)} and ${qN(qz)}.`)], { figure: "adoption", highlight: three.map(x => x.domain), focus: qz })); }
  const d = doubledAt(share);
  if (d && first) steps.push(step("doubled", cap`Its share first doubled in ${qN(d.q)}: ${pct(d.share, href)}, against ${pct(first.share, href)} at the start.`, { figure: "adoption", highlight: a.entries.filter(x => byQuarter(x.first, d.q) <= 0).map(x => x.domain), focus: d.q }));
  else if (first && last) steps.push(step("doubled", cap`It has not doubled: ${pct(first.share, href)} in ${qN(first.q)}, ${pct(last.share, href)} in ${qN(last.q)}, up ${num(`${(last.share / Math.max(first.share, 1e-9)).toFixed(1)} times`, last.share / Math.max(first.share, 1e-9), href)}.`, { figure: "adoption", highlight: [], focus: last.q }));
  // E4: the latest column mixes every change since the archive's last sample with the live crawl, so it is not compared with single
  // quarters: the step names the largest group among the comparable quarters, and says so without a superlative.
  const latest = qs.at(-1) ?? null, comparable = qs.length > 1 ? qs.slice(0, -1) : qs;
  const waves = comparable.map(q => ({ q, n: a.entries.filter(x => x.first === q) })).filter(w => w.n.length).sort((x, y) => y.n.length - x.n.length || byQuarter(x.q, y.q));
  const big = waves[0];
  if (big) steps.push(step("wave", [...cap`In ${qN(big.q)}, ${cnt(big.n.length, href)} brands showed it for the first time, among them `, ...list(big.n.slice(0, 2).map(x => b(x.domain))), "."], { figure: "adoption", highlight: big.n.map(x => x.domain), focus: big.q }));
  if (a.dropped.length) steps.push(step("dropped", [...cap`${cnt(a.dropped.length, href)} adopters have since dropped it, among them `, ...list(a.dropped.slice(0, 2).map(x => b(x.domain))), "."], { figure: "adoption", highlight: a.dropped.map(x => x.domain), focus: last?.q ?? null }));
  const bySector = SECTORS.map(s => ({ s: s as string, p: shareSeries(i, [s], key).at(-1) })).filter((x): x is { s: string; p: NonNullable<typeof x.p> } => !!x.p).sort((x, y) => x.p.share - y.p.share || x.s.localeCompare(y.s));
  const hold = bySector[0], lead = bySector.at(-1);
  if (hold && lead) steps.push(step("never", cap`${cnt(a.never.length, href)} brands have never shown it in a well-covered capture. ${sec(hold.s)} holds out most, at ${pct(hold.p.share, `${href}?sector=${hold.s}`)} now; ${sec(lead.s)} leads at ${pct(lead.p.share, `${href}?sector=${lead.s}`)}.`, { figure: "adoption", highlight: a.never, focus: last?.q ?? null }));
  const name = label(key).name, prev = qs.length > 1 ? qs.at(-2)! : null;
  return model(m, i, { adoption: a.fig }, steps, { brands: activeSites(i, null).length, captures: capturesIn(i, null), period: first && last ? `${qText(first.q)} to ${qText(last.q)}` : "—", rule: ruleText(null),
    lines: [`A first sighting is dated only when the brand has an earlier well-covered capture without it; ${a.censored.length} brands already had it and ${a.unknown} have no well-covered capture.`] },
    last ? { n: pctText(last.share), label: `of tracked homepages set ${name} in ${qText(last.q)}` } : { n: String(a.entries.length), label: `adopters of ${name} with a known first quarter` },
    {
      scenes: [
        { id: "share", lead: "The share line", steps: ["now"] },
        { id: "dated", lead: "Who the archive can date", steps: ["already", "first-three"] },
        { id: "spread", lead: "How it spread", steps: ["doubled", "wave"] },
        { id: "left", lead: "The ones who left", steps: ["dropped"] },
        { id: "never", lead: "Who never took it up", steps: ["never"] },
      ],
      limits: [
        `Archive captures are about a year apart, so a brand is dated to the first capture that shows ${name}, and brands already showing it in their first capture have no known start.`,
        ...(latest && prev ? [`The ${qText(latest)} column holds every first sighting since ${qText(prev)}, when the archive last sampled most brands, together with the live crawl, so it is not comparable with a single earlier quarter.`] : []),
      ],
      fallback: last ? `${name} is on ${pctText(last.share)} of tracked homepages` : `${a.entries.length} brands took up ${name}`,
    });
}

// D. WHICH SECTOR CHANGES ITS MIND MOST? ------------------------------------------------------------------------------
export const MINDS = { early: ["2021", "2022"] as const, late: ["2023", "2024"] as const, minPairs: 10 } as const;
/** E4b · sectors shown in study D's panels but never ranked or compared: studios' homepages are showcases, and the studio rule leaves out
 *  their palette, accent, hero and imagery changes, so their count is low by construction. The one place this rule lives. */
export const UNRANKED_SECTORS: readonly string[] = ["studios"];
export const isRanked = (s: string) => !UNRANKED_SECTORS.includes(s);
export const UNRANKED_LIMIT = "Studios are shown but not ranked: their homepages are showcases, so palette, accent, hero and imagery changes there are not counted as a change of mind.";
export const UNRANKED_NOTE = "Not ranked";
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);
/** Ranked sectors with compared archive captures, busiest first (ties by id). */
export function rankedRates(i: DataInput): Rate[] {
  return sectorRates(i).filter(r => r.pairs && isRanked(r.s)).sort((x, y) => y.rate - x.rate || x.s.localeCompare(y.s));
}
/** The reversal pick: among ranked sectors with enough captures in both windows, one that moved against most, else the largest change of pace. */
export function mindsReversal(rates: readonly Rate[]) {
  const both = rates.filter(r => isRanked(r.s) && r.early.p >= MINDS.minPairs && r.late.p >= MINDS.minPairs).map(r => ({ r, d: per100(r.late.e, r.late.p) - per100(r.early.e, r.early.p) }));
  const down = both.filter(x => x.d < 0).length, all = down * 2 > both.length ? -1 : 1, opposite = both.filter(x => Math.sign(x.d) !== all && x.d !== 0);
  const rev = [...(opposite.length ? opposite : both)].sort((x, y) => Math.abs(y.d) - Math.abs(x.d) || x.r.s.localeCompare(y.r.s))[0];
  return rev ? { ...rev, reversed: opposite.length > 0, all } : null;
}
/** Rates read the archive only (Wayback captures and the changes measured between them), so a week of frequent live crawls cannot dilute them. */
type Rate = { s: string; events: number; pairs: number; rate: number; early: { e: number; p: number }; late: { e: number; p: number } };
export function sectorRates(i: DataInput): Rate[] {
  const secOf = sectorOfSite(i), yr = (at: string) => at.slice(0, 4), out = new Map<string, Rate>();
  const get = (s: string) => { let r = out.get(s); if (!r) { r = { s, events: 0, pairs: 0, rate: 0, early: { e: 0, p: 0 }, late: { e: 0, p: 0 } }; out.set(s, r); } return r; };
  const inW = (y: string, w: readonly string[]) => w.includes(y);
  const by = new Map<string, string[]>();
  for (const c of i.captures) if (c.source === "wayback") by.set(c.domain, [...(by.get(c.domain) ?? []), c.at]);
  for (const [d, ats] of by) { const s = secOf(d); if (!s) continue; const r = get(s); const sorted = [...ats].sort();
    sorted.slice(1).forEach(at => { r.pairs++; const y = yr(at); if (inW(y, MINDS.early)) r.early.p++; if (inW(y, MINDS.late)) r.late.p++; }); }
  for (const e of i.events) { if (e.source !== "wayback") continue; const s = secOf(e.domain); if (!s) continue; const r = get(s), y = yr(e.at); r.events++; if (inW(y, MINDS.early)) r.early.e++; if (inW(y, MINDS.late)) r.late.e++; }
  return SECTORS.map(s => get(s)).map(r => ({ ...r, rate: r.pairs ? r.events / r.pairs : 0 }));
}
const per100 = (e: number, p: number) => (p ? (100 * e) / p : 0);
/** The leading sector's brand with the most measured changes and at least two stored captures: the before / after of story D. */
export function mindsBrand(i: DataInput): string | null {
  const lead = rankedRates(i)[0];
  if (!lead) return null;
  const caps = new Map<string, number>(), ev = new Map<string, number>();
  for (const c of i.captures) caps.set(c.domain, (caps.get(c.domain) ?? 0) + 1);
  for (const e of i.events) ev.set(e.domain, (ev.get(e.domain) ?? 0) + 1);
  return i.sites.filter(s => s.active && s.sector === lead.s && (caps.get(s.domain) ?? 0) >= 2).map(s => s.domain).sort((x, y) => (ev.get(y) ?? 0) - (ev.get(x) ?? 0) || x.localeCompare(y))[0] ?? null;
}
export function sectorMindsStory(i: DataInput, caps: Captures, m: Meta): StoryModel {
  const rates = sectorRates(i), secOf = sectorOfSite(i), b = brandRef(i);
  const years = [...new Set(i.events.map(e => e.at.slice(0, 4)))].sort();
  const panels = rates.map(r => ({ id: r.s, label: sectorName(r.s), href: sectorHref(r.s), ...(isRanked(r.s) ? {} : { note: UNRANKED_NOTE }),
    points: years.map(y => ({ x: y, y: i.events.filter(e => secOf(e.domain) === r.s && e.at.startsWith(y)).length })),
    marks: years.map(y => ({ x: y, y: i.rebrands.filter(x => secOf(x.domain) === r.s && x.at.startsWith(y)).length })) }));
  const figures: Record<string, Figure> = { multiples: multiplesFig({ title: "Measured homepage changes by sector and year", note: "Bars: measured changes (type, palette, theme, layout, navigation, stack, redesign). Ticks: confirmed rebrands. Same axis in every panel.", unit: "count", chart: multiplesChart(years.length, "bars"), panels, xs: years }) };
  const steps: Step[] = [];
  const total = i.events.length, firstAt = [...i.events].sort((x, y) => x.at.localeCompare(y.at))[0]?.at;
  if (firstAt) steps.push(step("intro", cap`${cnt(total, "/terminal?panel=library")} measured changes on ${cnt(i.sites.filter(s => s.active).length, "/brands")} homepages, the earliest first seen in ${qN(quarterOf(firstAt))}, and ${cnt(i.rebrands.length, "/terminal?panel=rebrands")} confirmed rebrands.`, { figure: "multiples", highlight: [] }));
  // E4b · rankings and comparisons cover ranked sectors only (UNRANKED_SECTORS); studios keep their panel, marked Not ranked.
  const ranked = rankedRates(i), among = `Of the ${countWord(ranked.length)} ranked sectors, `;
  const lead = ranked[0], lag = ranked.at(-1);
  const rateN = (e: number, p: number, s: string) => num(per100(e, p).toFixed(1), per100(e, p), sectorHref(s));
  if (lead) steps.push(step("leader", [among, ...cap`${sec(lead.s)} changes its mind most: ${rateN(lead.events, lead.pairs, lead.s)} measured changes per hundred compared archive captures.`], { figure: "multiples", highlight: [lead.s] }));
  if (lag && lag !== lead) steps.push(step("lagger", [...cap`${sec(lag.s)} changes least: ${rateN(lag.events, lag.pairs, lag.s)} per hundred.`], { figure: "multiples", highlight: [lag.s] }));
  const rev = mindsReversal(rates);
  const w = (ys: readonly string[]) => num(`${ys[0]}–${ys.at(-1)}`, Number(ys[0]), HISTORY_HREF);
  if (rev) steps.push(step("reversed", [...cap`${sec(rev.r.s)} ${rev.reversed ? "reversed" : "changed pace most"}: ${rateN(rev.r.early.e, rev.r.early.p, rev.r.s)} changes per hundred captures in ${w(MINDS.early)}, ${rateN(rev.r.late.e, rev.r.late.p, rev.r.s)} in ${w(MINDS.late)}`, rev.reversed ? (rev.all < 0 ? ", while most ranked sectors slowed." : ", while most ranked sectors sped up.") : " among the ranked sectors."], { figure: "multiples", highlight: [rev.r.s] }));
  if (lead) {
    const count = (d: string) => i.events.filter(e => e.domain === d).length;
    const d = mindsBrand(i);
    if (d && (caps.get(d) ?? []).length >= 2) {
      const cs = [...caps.get(d)!].sort((x, y) => x.captured_at.localeCompare(y.captured_at)), a = cs[0]!, z = cs.filter(c => c.source === "live").at(-1) ?? cs.at(-1)!;
      const fig = beforeAfter({ title: `${nameOf(i)(d)}, then and now`, note: "Two stored captures redrawn from their layout boxes in their own colours; measured differences listed.", domain: d, name: nameOf(i)(d), a, b: z, crops: i.crops });
      figures["before-after"] = fig;
      steps.push(step("brand-before", cap`Its most changeable brand, ${b(d)}, logged ${cnt(count(d), brandHref(d))} measured changes. This is its homepage on ${dayN(a.captured_at, HISTORY_HREF)}.`, { figure: "before-after", highlight: [], side: "before" }));
      steps.push(step("brand-after", fig.diffs.length
        ? [...cap`And on ${dayN(z.captured_at, brandHref(d))}: ${cnt(fig.diffs.length, brandHref(d))} measured differences, including `, ...list(fig.diffs.slice(0, 2).map(x => x.field.toLowerCase())), "."]
        : cap`And on ${dayN(z.captured_at, brandHref(d))}: the compared fields measure the same.`, { figure: "before-after", highlight: fig.diffs.map(x => x.field), side: "after" }));
    }
  }
  steps.push(step("caveat", ["Archive changes are dated to the first Wayback capture that shows them, so a sector the archive visited more often looks busier; the rate per compared capture corrects for that."], { figure: "multiples", highlight: [] }));
  const lr = lead ? `${per100(lead.events, lead.pairs).toFixed(1)}` : "—";
  return model(m, i, figures, steps, { brands: i.sites.filter(s => s.active).length, captures: i.captures.length, period: firstAt ? `${dayText(firstAt)} to ${dayText(lastDate(i) ?? firstAt)}` : "—",
    rule: "Changes are measured events on desktop homepages, confirmed across two captures; rates divide archive changes by compared archive capture pairs in each sector.",
    lines: [`Reversal compares ${MINDS.early.join("–")} with ${MINDS.late.join("–")}, for ranked sectors with at least ${MINDS.minPairs} compared captures in each window.`] },
    { n: lr, label: lead ? `changes per hundred captures in ${sectorName(lead.s)}` : "changes per hundred captures" },
    {
      scenes: [
        { id: "all", lead: "Every change, sector by sector", steps: ["intro", "caveat"] },
        { id: "ends", lead: "The busiest and the steadiest", steps: ["leader", "lagger"] },
        { id: "pace", lead: "A change of pace", steps: ["reversed"] },
        { id: "brand", lead: "One brand, then and now", steps: ["brand-before", "brand-after"] },
      ],
      limits: [
        "Archive changes are dated to the first Wayback capture that shows them, so a sector the archive visited more often looks busier; the rate per compared capture corrects for that.",
        "A live-crawl change counts only once two captures on each side agree, and changes on rotating first screens and studios' featured work are left out.",
        UNRANKED_LIMIT,
      ],
      fallback: lead ? `${sectorName(lead.s)} logs ${lr} changes per hundred archive captures` : `${total} measured homepage changes, sector by sector`,
      // I3b · the ranking the facts state (busiest first), so the writer may call its ends highest and lowest.
      ...(ranked.length >= 2 ? { ranked: [{ label: "ranked sectors by measured changes per hundred compared archive captures", order: ranked.map(r => sectorName(r.s)) }] } : {}),
    });
}

// WHERE YOU SIT (the reader as input) -----------------------------------------------------------------------------------
export const FIELD_AXES = {
  x: { key: "h1_size_px", label: "Headline size", measure: "Declared size of the main headline (H1) on the desktop first screen, in CSS pixels.", unit: "px" as const },
  y: { key: "whitespace_ratio", label: "White space", measure: "Share of first-screen pixels that match the page background.", unit: "share" as const },
};
export const SIT = { majority: 0.5, minority: 0.5, picks: 2 } as const;
export function sectorField(i: DataInput, sector: string) {
  const n = nameOf(i), act = new Set(activeSites(i, [sector]).map(s => s.domain));
  const now = i.history.filter(r => r.now && act.has(r.domain));
  return brandField({ title: `${sectorName(sector)}: where each brand sits now`, note: `Across: ${FIELD_AXES.x.measure} Up: ${FIELD_AXES.y.measure}`, sector, sectorName: sectorName(sector), axes: FIELD_AXES,
    brands: now.map(r => ({ domain: r.domain, name: n(r.domain), x: r.h1_size_px ?? null, y: r.whitespace_ratio ?? null })), words: { x: ["Bigger headlines", "Smaller headlines"], y: ["more white space", "denser first screens"] } });
}
/** Headline signals a brand shows that most of its sector does not, and the reverse; shares over the sector's current captures that can answer. */
export function signalContrast(i: DataInput, domain: string) {
  const s = i.sites.find(x => x.domain === domain), now = s ? i.history.filter(r => r.now && r.domain !== domain && activeSites(i, [s.sector]).some(a => a.domain === r.domain)) : [];
  const me = i.history.find(r => r.now && r.domain === domain);
  if (!s || !me) return { has: [], lacks: [] };
  const share = (k: string) => { const rs = now.filter(r => knows(k, r)); return rs.length ? { v: rs.filter(r => traitsOf(r).has(k)).length / rs.length, n: rs.length } : null; };
  const rows = i.headline.filter(h => knows(h.key, me)).map(h => ({ ...h, mine: traitsOf(me).has(h.key), sector: share(h.key) })).filter((x): x is typeof x & { sector: { v: number; n: number } } => !!x.sector);
  return {
    has: rows.filter(x => x.mine && x.sector.v < SIT.minority).sort((a, b) => a.sector.v - b.sector.v || a.key.localeCompare(b.key)).slice(0, SIT.picks),
    lacks: rows.filter(x => !x.mine && x.sector.v > SIT.majority).sort((a, b) => b.sector.v - a.sector.v || a.key.localeCompare(b.key)).slice(0, SIT.picks),
  };
}
export function whereYouSit(i: DataInput, domain: string, cs: CaptureRaw[], m: Meta): StoryModel | null {
  const site = i.sites.find(s => s.domain === domain && s.active);
  if (!site) return null;
  const n = nameOf(i)(domain), b = brandRef(i), field = sectorField(i, site.sector), me = field.points.find(p => p.domain === domain);
  const figures: Record<string, Figure> = { field }, steps: Step[] = [], sh = sectorHref(site.sector);
  const px = (v: number, h: string) => num(`${Math.round(v)}px`, v, h), sp = (v: number, h: string) => num(`${Math.round(v * 100)}%`, v, h);
  if (me) {
    steps.push(step("field", cap`${b(domain)} sits among ${cnt(field.points.length, sh)} ${sec(site.sector)} brands: a ${px(me.x, brandHref(domain))} headline against a sector median of ${px(field.centre.x, sh)}, and ${sp(me.y, brandHref(domain))} white space against ${sp(field.centre.y, sh)}.`, { figure: "field", highlight: [domain], focus: "centre" }));
    const big = me.x >= field.centre.x, airy = me.y >= field.centre.y;
    const corner = field.points.filter(p => (p.x >= field.centre.x) === big && (p.y >= field.centre.y) === airy);
    steps.push(step("corner", cap`${cnt(corner.length, sh)} of the ${cnt(field.points.length, sh)} share its corner: ${big ? "bigger" : "smaller"} headlines and ${airy ? "more" : "less"} white space than the sector centre.`, { figure: "field", highlight: corner.map(p => p.domain), focus: "centre" }));
  } else steps.push(step("field", cap`${b(domain)} has no measured headline size or white space yet, so it is not placed among the ${cnt(field.points.length, sh)} ${sec(site.sector)} brands.`, { figure: "field", highlight: [], focus: "centre" }));
  if (cs.length) {
    const fig = strip({ title: `${n} through time`, note: "Every stored desktop homepage capture, redrawn from its stored layout boxes in its own colours.", domain, name: n, captures: cs, events: i.events.filter(e => e.domain === domain), crops: i.crops });
    figures["strip"] = fig;
    const f0 = fig.frames[0]!, fN = fig.frames.at(-1)!;
    steps.push(step("strip", fig.frames.length > 1
      ? [...cap`Its homepage through time: ${cnt(fig.frames.length, brandHref(domain))} stored captures from ${dayN(f0.at, HISTORY_HREF)} to ${dayN(fN.at, brandHref(domain))}`, ...(fig.marks.length ? cap`, with ${cnt(fig.marks.length, brandHref(domain))} measured changes marked.` : [", and no measured change between them."])]
      : cap`Only ${cnt(1, brandHref(domain))} capture is stored so far, from ${dayN(f0.at, brandHref(domain))}.`, { figure: "strip", highlight: fig.marks.map(x => x.id), focus: fN.id }));
  }
  const sc = signalContrast(i, domain), sref = (k: string) => `${signalHref(k)}?sector=${site.sector}`;
  steps.push(step("has", sc.has.length
    ? [...cap`It shows `, ...joinPairs(sc.has.map(x => [ref(x.name, sref(x.key)), " (", pct(x.sector.v, sref(x.key)), " of its sector)"])), ", which most of its sector does not."]
    : cap`Every headline signal it shows is shared by at least half of its sector.`, { figure: "field", highlight: [domain], focus: "centre" }));
  steps.push(step("lacks", sc.lacks.length
    ? [...cap`Most of its sector shows `, ...joinPairs(sc.lacks.map(x => [ref(x.name, sref(x.key)), " (", pct(x.sector.v, sref(x.key)), ")"])), "; it does not."]
    : cap`It is not missing any headline signal that most of its sector shows.`, { figure: "field", highlight: field.points.filter(p => p.domain !== domain).map(p => p.domain), focus: "centre" }));
  const qs = quarterCoverage(i, [site.sector]);
  return model(m, i, figures, steps, { brands: activeSites(i, [site.sector]).length, captures: cs.length, period: qs.length ? `${qText(qs[0]!.q)} to ${qText(qs.at(-1)!.q)}` : "—", rule: "The field uses each brand's current live capture; sector shares count the other tracked brands in the sector whose capture can answer (AI signals: AI-tagged captures only).",
    lines: [`Axes: ${FIELD_AXES.x.label} (${FIELD_AXES.x.measure}) and ${FIELD_AXES.y.label} (${FIELD_AXES.y.measure})`] },
    me ? { n: `${Math.round(me.x)}px`, label: `${n} headline size` } : { n: "—", label: n }, { fallback: `Where does ${n} sit?` }, { ...m, question: `Where does ${n} sit?` });
}
/** "a (x%) and b (y%)" over grouped segments. */
function joinPairs(groups: Seg[][]): Seg[] {
  return groups.flatMap((g, k) => (k === 0 ? g : k === groups.length - 1 ? [" and ", ...g] : [", ", ...g]));
}

export function model(m: Meta, i: DataInput, figures: Record<string, Figure>, steps: Step[], basis: StoryModel["basis"], key: StoryModel["key"], x: Extras = {}, over?: Partial<Meta>): StoryModel {
  const mm = { ...m, ...over };
  return { slug: mm.slug, number: mm.number, question: mm.question, deck: mm.deck, template: mm.template, dataThrough: lastDate(i), figures, steps, basis, collection: mm.collection, related: mm.related, key,
    series: mm.series ?? "", seriesTitle: mm.seriesTitle ?? "", scenes: x.scenes ? resolveScenes(x.scenes, steps) : oneScenePerStep(steps), limits: (x.limits ?? []).slice(0, 3), fallbackHeadline: x.fallback ?? mm.question, ...(x.ranked?.length ? { ranked: x.ranked } : {}) };
}
/** E4 · the limit every archive-dated study carries. */
export const ARCHIVE_LIMIT = "Archive captures are about a year apart, so a change is dated to the first capture that shows it.";
/** E4 · when a change happened, in the archive's words: a live change confirmed by its captures reads "between <last old> and <first new>";
 *  any other (an archive change) reads "first seen in <quarter>", never a day the archive happened to visit. */
function whenSeen(i: DataInput, id: number, at: string, href: string): Seg[] {
  const e = i.events.find(x => x.id === id);
  if (e?.source === "live" && e.seen) return cap`happened between ${dayN(e.seen.before, HISTORY_HREF)} and ${dayN(e.seen.after, href)}`;
  return cap`was first seen in ${qN(quarterOf(at))}`;
}
