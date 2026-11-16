// The Digest: one issue assembled deterministically from stored rows for its week. Pure (no I/O, no AI);
// every trait name, dimension and stage word comes from labels.ts, and stored text is only unticked at render time.
import { deLegacy } from "../brand";
import { alertDisplayTitle, basis, briefDisplay, explainerPath, label, scopeText, stageName, untick, type Basis, type Dimension, type StageName } from "../labels";
import { colorTicker } from "../taste/color";
import { colorName } from "../labels";
import { stageChanges, type StageRow } from "../today";
import type { CardModel } from "../chart/card";
import { pickThumb, type Thumb, type ThumbRow } from "../thumbs";
import { DIGEST_NAME, CONTACT_EMAIL } from "../site";
import { issueNumber, weekRange, longDate } from "./week";
import { moverSentence, pct, soWhat, stageMove, whyItMatters } from "./copy";

export type StoredBrief = { headline: string; caveats?: string; refs?: Record<string, { label: string; domain?: string; url?: string }>; sections: { title: string; body: string; citations: { kind: string; id: string }[] }[]; watch?: { id: string; call: string } | null; standfirst?: string | null; why_it_matters?: string | null };
export type LeadSite = { domain: string; adopted?: string | null; lead?: number | null };
export type FRow = StageRow & { scope: string; status?: string; next_wave_score?: number | null; sites?: number | null; lead_sites?: LeadSite[] | null };
export type AlertRow = { title: string; ref: string | null; url: string; tags: string[] | null; published_at: string };
export type FontMove = { family: string; category: string; change: number; rank: number };
export type SiteEvent = { domain: string; sector: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; detected_at: string };
export type RebrandLite = { domain: string; sector: string; name: string | null; confirmed_at: string; read: string; reasons: string[]; before: { h1: string | null; accent: string | null }; after: { h1: string | null; accent: string | null } };
export type IssueRows = {
  week: string;
  brief: StoredBrief | null;
  run: { id: number; computed_at: string; data_through: string | null } | null;
  card: CardModel | null;
  forecasts: FRow[];
  previous: StageRow[];
  /** Headline signal keys for this issue's run (tiers.ts). When present, the cover lead and Movers use headline signals only. */
  headline?: string[] | null;
  alerts: AlertRow[];
  fonts: { date: string; since: string; rising: FontMove[]; fading: FontMove[] } | null;
  typeEvents: SiteEvent[];
  googleFamilies: string[];
  colorEvents: SiteEvent[];
  sites: { domain: string; sector: string; name: string | null }[];
  thumbs: ThumbRow[];
  rebrands: RebrandLite[];
  /** Live forecast record as of the issue's end; the hit rate shows only once `rate` is set (≥20 resolved calls). */
  numbers: { ledger?: { rate: number | null; hits: number; resolved: number } | null; library_sites: number | null; crawl: { finished_at: string; sites: number } | null; wire_stories: number };
  /** Published stories that happened in the issue week, as they stood at its end (digest.server.ts). Shown from STORIES_FIRST_WEEK on. */
  stories?: WeekStory[] | null;
};
export type WeekStory = { id: string; number?: number | null; type: string; kicker: string; headline: string; deck: string | null; happened_at: string; sector: string | null; score: number };
/** "The week in stories" runs from this issue on; earlier issues stay as they were. */
export const STORIES_FIRST_WEEK = "2026-W47";
export const WEEK_STORIES = 7;
/** The issue's top stories by score, only from STORIES_FIRST_WEEK on. */
export function weekInStories(week: string, stories: WeekStory[] | null | undefined): WeekStory[] | null {
  if (week < STORIES_FIRST_WEEK || !stories?.length) return null;
  return [...stories].sort((a, b) => b.score - a.score || b.happened_at.localeCompare(a.happened_at) || a.id.localeCompare(b.id)).slice(0, WEEK_STORIES);
}

export type TraitRef = { key: string; name: string; dimension: Dimension; basis: Basis; stage: StageName | null; href: string };
export type Mover = TraitRef & { scope: string; scopeText: string; from: StageName | null; to: StageName | null; breakout: boolean; change: string; sentence: string; sites: number | null; soWhat: string | null };
export type Specimen = { family: string; google: boolean; role: string; line: string; note: string | null; href: string | null };
export type Swatch = { hex: string; name: string };
export type ColorMove = { domain: string; sector: string | null; kind: "accent" | "palette"; before: Swatch[]; after: Swatch[]; at: string; href: string };
export type WildSite = { domain: string; name: string | null; sector: string; traits: string[]; adopted: string | null; thumb: Thumb | null; terminal: string; live: string };
export type Issue = {
  name: string; week: string; number: number; dates: { start: string; end: string; label: string }; dataThrough: string | null; runId: number | null;
  cover: { kicker: string; headline: string; standfirst: string; why: string | null; body: { title: string; body: string; citations: { text: string; href: string | null }[] }[]; caveats: string | null; lead: (TraitRef & { share: number | null; momentum: number | null; scopeText: string }) | null; card: FigureData | null; call: string | null };
  /** The week in stories (top seven published stories of the week by score), above the other sections; null before STORIES_FIRST_WEEK. */
  stories: (WeekStory & { href: string })[] | null;
  movers: Mover[] | null;
  specimens: { rising: Specimen[]; fading: Specimen[]; seen: Specimen[]; since: string | null; date: string | null } | null;
  palette: ColorMove[] | null;
  wild: WildSite[] | null;
  rebrands: (RebrandLite & { href: string; read: string })[] | null;
  numbers: { label: string; value: string; note: string }[];
  footer: { methodology: string; glossary: string; rss: string; terminal: string; contact: string | null };
  /** Section ids in reading order, only those with real data. */
  sections: string[];
};

const MAX_MOVERS = 6, MAX_WILD = 8, MAX_PALETTE = 6, HEX = /^#[\da-f]{6}$/i;
const ICON_FONT = /material|icons?\b|symbols|barcode|emoji/i;
/** Popularity climbs only count for faces now in the top 500, so obscure families jumping from the tail do not lead the story. */
export const SPECIMEN_TOP = 500;
const quarter = (q: string | null) => (q && /^\d{4}Q[1-4]$/.test(q) ? `Q${q.slice(5)} ${q.slice(0, 4)}` : q);
/** Sentence split that keeps decimals ("4.84") and abbreviations inside a sentence: a break needs end punctuation, space, then a capital or quote. */
export const splitSentences = (s: string) => s.trim().split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z])/).filter(Boolean);
const sentences = (s: string, n: number) => splitSentences(s).slice(0, n).join(" ").trim();
/** Stored standfirst from the brief step, else the brief's own first two sentences. Shared with the RSS feed. */
export const standfirstOf = (b: Pick<StoredBrief, "standfirst" | "sections">) => untick(b.standfirst?.trim() || (b.sections[0] ? sentences(untick(b.sections[0].body), 2) : ""));
/** Only the plotted numbers of a stored card travel to pages: stored legacy text (ticker, call) stays in the row. */
export type FigureData = Pick<CardModel, "series" | "forecast" | "run_id" | "forecast_run" | "data_through">;
export const figureOf = (c: CardModel | null): FigureData | null => (c ? { series: c.series, forecast: c.forecast, run_id: c.run_id, forecast_run: c.forecast_run ?? null, data_through: c.data_through } : null);
/** Where a brief citation's receipt lives. */
export function citationHref(c: { kind: string; id: string }, refs: StoredBrief["refs"]): string | null {
  const r = refs?.[`${c.kind}:${c.id}`];
  if (c.kind === "forecast") return explainerPath(c.id.split(":").slice(0, 2).join(":"));
  if (c.kind === "event" && r?.domain) return `/library/${r.domain}`;
  if (c.kind === "wire" && r?.url) return r.url;
  if (c.kind === "spread") return "/terminal?panel=spread";
  return null;
}
const ref = (key: string, stage: string | null): TraitRef => { const l = label(key); return { key, name: l.name, dimension: l.dimension, basis: basis(key), stage: stageName(stage), href: explainerPath(key) }; };
const sectorOf = (url: string) => { const m = /[?&]sector=([^&#]+)/.exec(url); return m ? decodeURIComponent(m[1]!) : "all"; };
const swatch = (hex: string): Swatch => ({ hex: hex.toUpperCase(), name: colorName(colorTicker(hex)) ?? hex.toUpperCase() });

export function issueModel(r: IssueRows): Issue | null {
  const number = issueNumber(r.week), range = weekRange(r.week);
  if (!r.brief || number === null || !range) return null;
  const all = r.forecasts.filter(f => f.scope === "all"), row = (key: string, scope = "all") => r.forecasts.find(f => `${f.dimension}:${f.value}` === key && f.scope === scope);

  // Cover: brief headline, stored standfirst or the brief's own opening sentences, lead signal from the stored chart card.
  const standfirst = standfirstOf(r.brief), shown = briefDisplay({ headline: r.brief.headline, caveats: r.brief.caveats ?? "", refs: r.brief.refs, sections: r.brief.sections });
  // A derived standfirst is the first section's opening, so the body continues after it instead of repeating it.
  const body = shown.sections.map((s, i) => ({ title: deLegacy(s.title), body: deLegacy(i === 0 && !r.brief!.standfirst?.trim() && s.body.startsWith(standfirst) ? s.body.slice(standfirst.length).trim() : s.body), citations: s.citations.map(c => ({ text: deLegacy(c.text), href: citationHref(c, r.brief!.refs) })) }));
  // Tiers: with a headline set, the cover lead and Movers must be headline signals (the stored brief text is shown as written).
  const head = r.headline ? new Set(r.headline) : null, isHead = (k: string) => !head || head.has(k);
  const storedLead = r.card?.trait ?? (r.brief.watch?.id ? r.brief.watch.id.split(":").slice(0, 2).join(":") : null);
  const fallbackLead = head ? all.filter(f => head.has(`${f.dimension}:${f.value}`) && f.next_wave_score != null).sort((a, b) => (b.next_wave_score ?? 0) - (a.next_wave_score ?? 0))[0] : undefined;
  const keepStored = !!storedLead && isHead(storedLead);
  const leadKey = keepStored ? storedLead : fallbackLead ? `${fallbackLead.dimension}:${fallbackLead.value}` : null;
  const card = keepStored ? r.card : null;
  const leadScope = card?.scope ?? "all", leadRow = leadKey ? row(leadKey, leadScope) ?? row(leadKey) : undefined;
  const leadStage = card?.stage ?? leadRow?.stage ?? null, leadShare = card?.share ?? leadRow?.current_share ?? null, leadMom = card?.momentum_pts_q ?? leadRow?.momentum ?? null;
  const lead = leadKey ? { ...ref(leadKey, leadStage), share: leadShare, momentum: leadMom, scopeText: scopeText(leadScope) } : null;
  const call = card ? (card.origin === "alert" ? alertDisplayTitle(card.call, card.trait) : untick(card.call)) : keepStored && r.brief.watch?.call ? untick(r.brief.watch.call) : null;
  const why = keepStored && r.brief.why_it_matters?.trim() ? untick(r.brief.why_it_matters) : lead ? whyItMatters(lead.key, leadStage, leadShare, leadMom) : null;
  const cover = { kicker: lead ? `Cover story · ${lead.dimension}` : "Cover story", headline: deLegacy(shown.headline), standfirst: deLegacy(standfirst), why: deLegacy(why), body, caveats: deLegacy(shown.caveats) || null, lead, card: figureOf(card), call };

  // Movers: breakout alerts first, then stage changes between this run and the previous one.
  const movers = new Map<string, Mover>();
  const add = (key: string, scope: string, breakout: boolean) => {
    if (!isHead(key)) return;
    const id = `${key}|${scope}`, f = row(key, scope) ?? row(key), prev = r.previous.find(p => `${p.dimension}:${p.value}` === key);
    const from = scope === "all" && prev ? stageName(prev.stage) : null, to = stageName(f?.stage ?? null);
    const existing = movers.get(id);
    if (existing) { if (breakout) existing.breakout = true; return; }
    const where = scope === "all" ? "" : ` in ${scopeText(scope)}`;
    const change = breakout ? `broke out${where}${from && to && from !== to ? ` and ${stageMove(from, to)}` : to ? `; its stage there is ${to}` : ""}` : `${stageMove(from, to)}${where}`;
    movers.set(id, { ...ref(key, f?.stage ?? null), scope, scopeText: scopeText(scope), from, to, breakout, change, sentence: moverSentence(f?.current_share ?? null, f?.momentum ?? null, f?.sites ?? null, scope === "all" ? null : scope), sites: f?.sites ?? null, soWhat: head ? soWhat(key, f?.stage ?? null) : null });
  };
  for (const a of [...r.alerts].filter(a => a.ref && a.tags?.includes("breakout")).sort((x, y) => y.published_at.localeCompare(x.published_at) || x.title.localeCompare(y.title))) add(a.ref!, sectorOf(a.url), true);
  for (const s of stageChanges(all, r.previous)) add(s.trait, "all", false);
  const moverList = [...movers.values()].slice(0, MAX_MOVERS);

  // Specimens: Google Fonts popularity movers (licensable, set in their own face) and faces sites switched to this week.
  const google = new Set(r.googleFamilies.map(f => f.toLowerCase()));
  const gf = (f: FontMove, dir: "up" | "down"): Specimen => ({ family: f.family, google: true, role: f.category.replace(/_/g, " "), line: `${dir === "up" ? "Up" : "Down"} ${Math.abs(f.change)} places in Google Fonts popularity, now No. ${f.rank}.`, note: null, href: `https://fonts.google.com/specimen/${f.family.replace(/ /g, "+")}` });
  const rising = (r.fonts?.rising ?? []).filter(f => f.change > 0 && f.rank <= SPECIMEN_TOP && !ICON_FONT.test(f.family)).slice(0, 3).map(f => gf(f, "up"));
  const fading = (r.fonts?.fading ?? []).filter(f => f.change < 0 && f.rank - f.change <= SPECIMEN_TOP && !ICON_FONT.test(f.family)).slice(0, 2).map(f => gf(f, "down"));
  const seenMap = new Map<string, Specimen>();
  for (const e of [...r.typeEvents].sort((a, b) => b.detected_at.localeCompare(a.detected_at))) for (const role of ["h1", "body"] as const) {
    const fam = e.after?.[role], was = e.before?.[role];
    if (typeof fam !== "string" || !fam.trim() || seenMap.has(fam.toLowerCase()) || seenMap.size >= 4) continue;
    const isG = google.has(fam.toLowerCase());
    seenMap.set(fam.toLowerCase(), { family: fam, google: isG, role: role === "h1" ? "Headline face" : "Body face", line: `${e.domain} switched its ${role === "h1" ? "headlines" : "body text"}${typeof was === "string" && was ? ` from ${was}` : ""} to ${fam}.`, note: isG ? null : "Proprietary face, shown by name.", href: `/library/${e.domain}` });
  }
  const seen = [...seenMap.values()];
  const specimens = rising.length + fading.length + seen.length ? { rising, fading, seen, since: r.fonts?.since ?? null, date: r.fonts?.date ?? null } : null;

  // Palette: accent and palette changes confirmed this week, as named swatches with hexes.
  const palette: ColorMove[] = [];
  for (const e of [...r.colorEvents].sort((a, b) => (Number("accent" in (b.after ?? {})) - Number("accent" in (a.after ?? {}))) || b.detected_at.localeCompare(a.detected_at))) {
    if (palette.length >= MAX_PALETTE) break;
    const bA = e.before?.["accent"], aA = e.after?.["accent"], bP = e.before?.["palette"], aP = e.after?.["palette"];
    if (typeof bA === "string" && typeof aA === "string" && HEX.test(bA) && HEX.test(aA)) palette.push({ domain: e.domain, sector: e.sector, kind: "accent", before: [swatch(bA)], after: [swatch(aA)], at: e.detected_at, href: `/library/${e.domain}` });
    else if (Array.isArray(bP) && Array.isArray(aP)) {
      const b = bP.filter((x): x is string => typeof x === "string" && HEX.test(x)).slice(0, 5), a = aP.filter((x): x is string => typeof x === "string" && HEX.test(x)).slice(0, 5);
      if (b.length && a.length && palette.filter(p => p.kind === "palette").length < 2) palette.push({ domain: e.domain, sector: e.sector, kind: "palette", before: b.map(swatch), after: a.map(swatch), at: e.detected_at, href: `/library/${e.domain}` });
    }
  }

  // Seen in the wild: library sites that lead this week's signals (cover first, then movers).
  const lib = new Map(r.sites.map(s => [s.domain, s]));
  const wild = new Map<string, WildSite>();
  for (const t of [...(lead ? [lead.key] : []), ...moverList.map(m => m.key)]) {
    const f = row(t); if (!f?.lead_sites) continue;
    for (const s of [...f.lead_sites].sort((a, b) => (b.lead ?? 0) - (a.lead ?? 0) || a.domain.localeCompare(b.domain))) {
      const site = lib.get(s.domain); if (!site) continue;
      const w = wild.get(s.domain), name = label(t).name;
      if (w) { if (!w.traits.includes(name)) w.traits.push(name); continue; }
      if (wild.size >= MAX_WILD) continue;
      wild.set(s.domain, { domain: s.domain, name: site.name, sector: site.sector, traits: [name], adopted: quarter(s.adopted ?? null), thumb: pickThumb(r.thumbs, s.domain, range.endIso), terminal: `/library/${s.domain}`, live: `https://${s.domain}` });
    }
  }

  const rebrands = r.rebrands.slice(0, 4).map(x => ({ ...x, read: untick(x.read), href: `/library/${x.domain}` }));
  const numbers = [
    r.numbers.library_sites != null ? { label: "Library sites", value: String(r.numbers.library_sites), note: "tracked page by page, twice before a change counts" } : null,
    r.numbers.crawl ? { label: "Sites crawled", value: String(r.numbers.crawl.sites), note: `latest crawl finished ${longDate(r.numbers.crawl.finished_at)}` } : null,
    { label: "Stories on the wire", value: String(r.numbers.wire_stories), note: `design news items published ${range.label}` },
    all.length ? { label: "Signals forecast", value: String(all.length), note: `staged in forecast run ${r.run?.id ?? "—"}` } : null,
    { label: "Breakout alerts", value: String(r.alerts.filter(a => a.tags?.includes("breakout")).length), note: "at most ten a week, by rule" },
    r.numbers.ledger?.rate != null ? { label: "Forecast hit rate", value: `${Math.round(r.numbers.ledger.rate * 100)}%`, note: `${r.numbers.ledger.hits} of ${r.numbers.ledger.resolved} resolved calls landed in their band; see the ledger` } : null,
  ].filter((x): x is { label: string; value: string; note: string } => !!x);

  const issue: Issue = {
    name: DIGEST_NAME, week: r.week, number, dates: { start: range.start, end: range.end, label: range.label }, dataThrough: quarter(r.run?.data_through ?? r.card?.data_through ?? null), runId: r.run?.id ?? r.card?.run_id ?? null,
    cover, stories: weekInStories(r.week, r.stories)?.map(x => ({ ...x, href: `/stories/${encodeURIComponent(x.id)}` })) ?? null, movers: moverList.length ? moverList : null, specimens, palette: palette.length ? palette : null, wild: wild.size ? [...wild.values()] : null, rebrands: rebrands.length ? rebrands : null, numbers,
    footer: { methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: "/", contact: CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Correction: ${DIGEST_NAME} No. ${number}`)}` : null },
    sections: [],
  };
  issue.sections = ["cover", ...(["stories", "movers", "specimens", "palette", "wild", "rebrands"] as const).filter(k => issue[k]), "numbers"];
  return issue;
}

/** Archive entry from a brief + stored card (lead chart) without assembling the full issue. */
export type ArchiveEntry = { week: string; number: number; headline: string; dates: string; lead: { name: string; dimension: Dimension } | null; card: FigureData | null };
export function archiveEntries(rows: { week: string; headline: string; card: CardModel | null }[]): ArchiveEntry[] {
  return rows.flatMap(r => { const n = issueNumber(r.week), range = weekRange(r.week); if (n === null || !range) return [];
    const l = r.card ? label(r.card.trait) : null;
    return [{ week: r.week, number: n, headline: untick(r.headline), dates: range.label, lead: l ? { name: l.name, dimension: l.dimension } : null, card: figureOf(r.card) }]; })
    .sort((a, b) => b.week.localeCompare(a.week));
}
export { pct };
