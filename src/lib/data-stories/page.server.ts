// Server side of studies: builds each model from cached stored data, lays the stored written text over it (E4) and caches the result.
// No writes, no AI per view: the written text is read from study_texts (checked versions only, anonymous).
import { dataInput, capturesFor, capturesOf } from "./data.server";
import { BUILDERS, buildStory, buildWhereYouSit, indexRows, isTracked, normDomain, liveNow, statusOf } from "./build";
import { DATA_STORIES, entryOf, seriesOf, studyLabel, templateName, withheld } from "./registry";
import { BIG_TYPE, adoptionEntries, waitOf } from "./checks";
import { museumFigures } from "./museum";
import { chooseText, factsHash, factsSheet, fallbackText, type StudyRow } from "./writer";
import { candidateRows, changedAt, draftRow, frontStudies, homeWithout, studiesHome, type HomeStudy, type StudiesHome } from "./shelf";
import { coverTrail } from "./cover";
import type { StoryModel, StudyPage } from "./types";
import { memoBy } from "../memo";
import { readRecord, readerRecord, storedBy } from "../records/store.server";
import { pageKey, usable } from "../records/records";
import { readerNow } from "../reader-context.server";
import { BUILD } from "../build-stamp";
import { supabaseAnon } from "../mcp/supabase";

const TTL = 10 * 60_000;
const built = memoBy(TTL, (job: { k: string; f: () => Promise<StoryModel | null> }) => job.f(), { key: j => j.k, max: 80 });
const memo = (k: string, f: () => Promise<StoryModel | null>) => built({ k, f });
const through = (i: Awaited<ReturnType<typeof dataInput>>) => i.captures.reduce<string | null>((m, c) => (!m || c.at > m ? c.at : m), null);

/** Checked written versions of these studies (public read; failures read as none, so the page shows its template text). */
async function studyRows(slugs: string[]): Promise<StudyRow[]> {
  if (!slugs.length) return [];
  const { data, error } = await supabaseAnon().from("study_texts").select("slug,facts_hash,headline,deck,opening,scenes,use_text,model,checked_at,created_at").or(slugs.filter(s => /^[a-z0-9-]+$/.test(s)).map(s => `slug.eq.${s}`).join(",")).not("checked_at", "is", null).order("created_at", { ascending: false }).limit(200);
  if (error) return [];
  return (data ?? []) as StudyRow[];
}
const modelOf = async (slug: string, i: Awaited<ReturnType<typeof dataInput>>) => memo(`s:${slug}`, async () => { const b = BUILDERS[slug]; if (!b) return null; return buildStory(slug, i, await capturesFor(b.domains(i))); });
/** A study page: the model, the text it shows and its sheet's fingerprint. */
export function studyPage(s: StoryModel, rows: readonly StudyRow[]): StudyPage {
  const hash = factsHash(factsSheet(s));
  return { ...s, text: chooseText(rows, hash, s), hash, v: 4 };
}

/** /data reads a precomputed Studies home (records.ts "data-index"); this computes it. `rows` is the plain numbered list (MCP). */
/** W3d-c · `build`: the build that wrote the copy; the sweep rebuilds a copy of another build on its first pass (a switch flipped in code
 *  lists or hides a study at once, not after the copy's half hour). */
export type DataIndex = { rows: ReturnType<typeof indexRows>; home: StudiesHome; v: 4; build?: string };
export async function computeDataIndex(): Promise<DataIndex> {
  const i = await dataInput().catch(() => null), now = Date.now();
  const rows = indexRows(i, i ? through(i) : null);
  const live = i ? liveNow(i) : [];
  const [models, texts] = await Promise.all([Promise.all(live.map(e => modelOf(e.slug, i!).catch(() => null))), studyRows(live.map(e => e.slug))]);
  const studies: HomeStudy[] = live.flatMap((e, k) => {
    const m = models[k]; if (!m) return [];
    const p = studyPage(m, texts);
    return [{ slug: e.slug, number: e.number, label: studyLabel(e.number), series: e.series, seriesTitle: seriesOf(e.series)?.title ?? "", headline: p.text.headline, deck: p.text.deck, question: e.question, dataThrough: m.dataThrough, href: `/data/${e.slug}`, key: m.key, cover: coverTrail(m), changedAt: changedAt(texts, e.slug, p.hash, now), written: p.text.source !== "fallback" }];
  });
  // W3b · a hidden study whose works clear the intake line, and that the editor shows, waits on In the works with its counts (W3c, W3d:
  // the one-colour museum study and the icon study wait there with their counts whenever their switch is on).
  const drafts = DATA_STORIES.filter(e => (!e.hidden || (i && !withheld(e) && ((e.check === "museum" && museumFigures(i).ready) || e.check === "museum-accent" || e.check === "app-icons"))) && !studies.some(x => x.slug === e.slug)).map(e => (i && e.check ? draftRow(e, waitOf(e.check, i), now) : { key: e.slug, question: e.question, series: seriesOf(e.series)?.title ?? "", wait: statusOf(e, i).reason ?? "", earliest: null, ready: false }));
  const cands = i ? i.headline.filter(h => h.key !== BIG_TYPE.key).map(h => ({ key: h.key, name: h.name, entries: adoptionEntries(i, h.key, h.name) })) : [];
  return { rows, home: studiesHome(studies, [...drafts, ...candidateRows(cands, BIG_TYPE.minEntries)]), v: 4, build: BUILD };
}
/** W3d-c · `missing` carries the build that decided it (a stored "no such study" is dropped when the build changes); `preparing` is a
 *  study in the registry whose stored copy is not written yet (readers are never made to wait for a fresh build). */
export type DataStoryPage = { kind: "live"; story: StudyPage } | { kind: "draft"; number: number; question: string; deck: string; template: string; reason: string | null; series?: string } | { kind: "missing"; build?: string } | { kind: "preparing"; number: number; question: string };
export async function computeDataStory(slug: string): Promise<DataStoryPage> {
  const e = entryOf(slug);
  if (!e || withheld(e)) return { kind: "missing", build: BUILD };
  const i = await dataInput();
  const story = await modelOf(slug, i);
  if (story) return { kind: "live", story: studyPage(story, await studyRows([slug])) };
  // W3a · a hidden study that is not live does not exist for readers.
  if (e.hidden) return { kind: "missing", build: BUILD };
  return { kind: "draft", number: e.number, question: e.question, deck: e.deck, template: templateName(e), reason: statusOf(e, i).reason, series: seriesOf(e.series)?.title ?? "" };
}
const dataIndexRecord = storedBy((_: null) => pageKey("data-index"), () => computeDataIndex());
const dataStoryRecord = storedBy((slug: string) => pageKey("data-story", slug), computeDataStory);
// A record written before E4 (no `v`) is a list without a home or a model without scenes: compute live instead (still correct).
const isIndex = (x: unknown): x is DataIndex => !!x && typeof x === "object" && (x as { v?: unknown }).v === 4 && "home" in (x as object);
const isPage = (x: DataStoryPage) => x.kind !== "live" || (x.story as Partial<StudyPage>).v === 4;
/** W3b · a study withheld after a record was written never reaches a reader from that record. */
const isWithheld = (slug: string) => { const e = entryOf(slug); return !!e && withheld(e); };
export const indexWithout = (x: DataIndex): DataIndex => ({ ...x, rows: x.rows.filter(r => !isWithheld(r.slug)), home: homeWithout(x.home, isWithheld) });
export const loadDataIndex = async (): Promise<DataIndex> => { const r = await dataIndexRecord(null); return indexWithout(isIndex(r) ? r : await computeDataIndex()); };
/** W3d-c · a stored "no such study" written by another build is not an answer (the switch or the registry may have changed since). */
export const oldMissing = (x: DataStoryPage, build = BUILD) => x.kind === "missing" && x.build !== build;
/** W3d-c · a reader is given the stored copy only: never a fresh build inside the reader's time limit. Until the sweep has written a
 *  copy from this build, a study in the registry answers "being prepared" (re-read every PREPARING_RECHECK_MS, so it turns into the
 *  study as soon as the copy lands). A copy past its age is still sent at once and rebuilt behind the reader, as for every page. */
export const PREPARING_RECHECK_MS = 10_000;
const preparingRows = memoBy(PREPARING_RECHECK_MS, (key: string) => readRecord<DataStoryPage>(key).catch(() => null), { key: k => k, max: 40 });
const servable = (row: { body: unknown } | null): row is { body: DataStoryPage; key: string; computed_at: string } => { const b = row?.body as DataStoryPage | undefined; return !!b && typeof b === "object" && isPage(b) && !oldMissing(b); };
async function readerStory(slug: string, e: { number: number; question: string }): Promise<DataStoryPage> {
  const key = pageKey("data-story", slug);
  let row = await readerRecord(key) as { key: string; body: unknown; computed_at: string } | null;
  if (!servable(row)) row = await preparingRows(key);
  if (!servable(row)) return { kind: "preparing", number: e.number, question: e.question };
  if (usable(row, Date.now())) return row.body;
  const r = await dataStoryRecord(slug).catch(() => row!.body as DataStoryPage);
  return isPage(r) && !oldMissing(r) ? r : row.body;
}
export const loadDataStory = async (slug: string): Promise<DataStoryPage> => {
  const e = entryOf(slug); if (!e || withheld(e)) return { kind: "missing" };
  if (readerNow()) return readerStory(slug, e);
  const r = await dataStoryRecord(slug); return isPage(r) && !oldMissing(r) ? r : computeDataStory(slug);
};
/** The front page's Studies rows (written headlines, lead first, at most three), from the stored home. */
export async function loadStudyShelf() { return frontStudies((await loadDataIndex()).home); }
/** The front page's Studies rows from the stored home only (never computes; null when no current record): the front page adds no slow read. */
export async function storedStudyShelf() {
  const { readRecord } = await import("../records/store.server");
  const r = await readRecord<unknown>(pageKey("data-index")).catch(() => null);
  return r && isIndex(r.body) ? frontStudies(homeWithout(r.body.home, isWithheld)) : null;
}
/** Every tracked brand for the picker (the only brands a reader can choose). */
export async function loadTrackedBrands() {
  const i = await dataInput();
  return i.sites.filter(s => s.active).map(s => ({ domain: s.domain, name: s.name ?? s.domain, sector: s.sector })).sort((a, b) => a.name.localeCompare(b.name));
}
export async function loadWhereYouSit(raw: string): Promise<{ kind: "story"; story: StoryModel } | { kind: "untracked"; domain: string } | { kind: "none" }> {
  const domain = normDomain(raw);
  if (!domain) return { kind: "none" };
  const i = await dataInput();
  if (!isTracked(i, domain)) return { kind: "untracked", domain };
  const story = await memo(`w:${domain}`, async () => buildWhereYouSit(i, domain, await capturesOf(domain)));
  return story ? { kind: "story", story } : { kind: "untracked", domain };
}

/** E4 · what the study writer is owed: each live study's sheet, fingerprint and template text, and the brand names the check knows. */
export async function studyJobs() {
  const [i, { seededNames }] = await Promise.all([dataInput(), import("../brand-names")]);
  const live = liveNow(i), models = await Promise.all(live.map(e => modelOf(e.slug, i)));
  const jobs = live.flatMap((e, k) => { const m = models[k]; if (!m) return []; const sheet = factsSheet(m), f = fallbackText(m);
    return [{ slug: e.slug, number: e.number, sheet, hash: factsHash(sheet), fallback: { headline: f.headline, deck: f.deck, opening: f.opening, scenes: f.scenes, use: "" } }]; });
  return { jobs, known: { names: [...new Set([...seededNames(), ...i.sites.map(s => s.name).filter((n): n is string => !!n)])] } };
}

/** E4 · a study's "02 Related": published stories of the last 60 days that share its signal (or its sectors), newest first; then the
 *  other live studies in its series. Streamed after the page (stories are never inside a record). */
export async function loadStudyRelated(slug: string) {
  const e = entryOf(slug);
  if (!e) return { stories: [], more: [], inWorks: false };
  const [{ storyIndex }, { studyStories }, idx] = await Promise.all([import("../stories/read.server"), import("./related"), loadDataIndex()]);
  const all = await storyIndex().catch(() => []);
  const more = idx.home.series.find(x => x.id === e.series)?.studies.filter(x => x.slug !== slug).map(x => ({ label: `${x.label}: ${x.headline}`, href: x.href })) ?? [];
  return { stories: studyStories(all, { signal: e.params.signal ?? null, sectors: e.params.sectors, now: Date.now() }), more, inWorks: !more.length };
}
