// Story page + queue loaders (anonymous SELECT-only). No AI per view.
import { storyById, storyIndex, deskIndex } from "./read.server";
import { memoBy } from "../memo";
import { queueModel, storiesAbout, storyPage, isKind, type StoryRecord } from "./view";

/** U2b · the numbers a story's text was written from: the story's own run when it has one, else the latest real forecast run at the
 *  text's time (the build's own rule); its rows'
 *  latest-quarter samples, for the story's first three signals in its sector and library-wide. Null when unknown (the stored list shows). */
const realRunsOnce = memoBy(10 * 60_000, async (_: string) => {
  const [{ supabaseAnon }, { fetchRealRuns }] = await Promise.all([import("../mcp/supabase"), import("../real-runs")]);
  return fetchRealRuns(supabaseAnon() as never, { limit: 12 });
}, { key: () => "runs", max: 1 });
/** The forecast run a story's numbers count from (its own, else the latest real run at its text's time), or null. */
async function storyRunOf(s: StoryRecord): Promise<number | null> {
  const { storyRunId } = await import("./sheet");
  const own = storyRunId(s.source_ids);
  if (own != null) return own;
  const at = s.written?.at ?? new Date().toISOString(), runs = await realRunsOnce("runs");
  return [...runs].sort((a, b) => a.id - b.id).filter(r => r.at <= at).at(-1)?.id ?? null;
}
/** L2 · when the story's numbers were true (its run's date, else its own capture date) and the one dated update line, if a later run
 *  changed a cited signal's stage within 14 days of the story (as-of.ts). Never throws. */
export async function storyDating(s: StoryRecord, now = Date.now()): Promise<{ asOf: string | null; update: string | null }> {
  try {
    if (s.id.startsWith("census:")) return { asOf: null, update: null };
    const runId = s.signal_keys.length ? await storyRunOf(s) : null;
    if (runId == null) return { asOf: s.happened_at ?? null, update: null };
    const runs = await realRunsOnce("runs"), run = runs.find(r => r.id === runId) ?? null, newest = [...runs].sort((a, b) => b.id - a.id)[0] ?? null;
    if (!run) return { asOf: s.happened_at ?? null, update: null };
    if (!newest || newest.id <= run.id) return { asOf: run.at, update: null };
    const [{ stageUpdate, UPDATE_DAYS }, { canonical }] = await Promise.all([import("./as-of"), import("../labels")]);
    if (now - Date.parse(s.happened_at) > UPDATE_DAYS * 864e5) return { asOf: run.at, update: null };
    // L2b · only the cited signals' rows in the two runs (one small read), not both runs whole: a newer run no longer costs this page
    // a full run's rows.
    const rows = await citedStages({ runs: [run.id, newest.id], keys: s.signal_keys.slice(0, 3).map(canonical), scopes: ["all", ...(s.sector ? [s.sector] : [])] });
    const map = (id: number) => { const m = new Map(rows.filter(r => r.run_id === id).map(r => [`${r.dimension}:${r.value}|${r.scope}`, r])); return (k: string, scope: string) => m.get(`${k}|${scope}`) as never; };
    return { asOf: run.at, update: stageUpdate({ publishedAt: s.happened_at, now, storyRun: run, newest, keys: s.signal_keys, sector: s.sector ?? null, then: map(run.id), latest: map(newest.id) }) };
  } catch { return { asOf: null, update: null }; }
}
type CitedStage = { run_id: number; dimension: string; value: string; scope: string; stage: string | null; current_share: number | null };
/** The stage and share of a few signals in a few runs (anonymous read; a stored run's rows do not change, so it is kept ten minutes). */
const citedStages = memoBy(10 * 60_000, async (q: { runs: number[]; keys: string[]; scopes: string[] }): Promise<CitedStage[]> => {
  const values = [...new Set(q.keys.map(k => k.slice(k.indexOf(":") + 1)))];
  if (!values.length) return [];
  const { supabaseAnon } = await import("../mcp/supabase");
  const { data, error } = await supabaseAnon().from("forecasts").select("run_id,dimension,value,scope,stage,current_share").in("run_id", q.runs).in("value", values).in("scope", q.scopes).limit(200);
  if (error) throw new Error("cited_stages_read_failed");
  const want = new Set(q.keys);
  return ((data ?? []) as CitedStage[]).filter(r => want.has(`${r.dimension}:${r.value}`));
}, { max: 200 });
export async function storyNumbers(s: StoryRecord): Promise<import("./sheet").SheetNumber[] | null> {
  if (!s.signal_keys.length || s.id.startsWith("census:")) return null;
  try {
    const [{ forecastRunRows }, { sheetNumbers }] = await Promise.all([import("../forecast-rows.server"), import("./sheet")]);
    const runId = await storyRunOf(s);
    if (runId == null) return null;
    const rows = await forecastRunRows(runId), by = new Map(rows.map(r => [`${r.dimension}:${r.value}|${r.scope}`, r]));
    return sheetNumbers((k, scope) => by.get(`${k}|${scope}`), s.signal_keys, s.sector);
  } catch { return null; }
}

/** The story's palette changes (type and stored hexes), for its list's colour words (U2b). One indexed read; [] when none or unreadable. */
export async function colourEventsOf(s: StoryRecord): Promise<import("./recolour").ColourEvent[]> {
  const ids = sourceEventIds(s.source_ids); if (!ids.length || s.domains.length !== 1) return [];
  const { supabaseAnon } = await import("../mcp/supabase");
  const { data, error } = await supabaseAnon().from("library_events").select("type,before,after").in("id", ids).eq("type", "palette_shift");
  return error ? [] : ((data ?? []) as import("./recolour").ColourEvent[]);
}
export async function loadStory(id: string) {
  const s = await storyById(id); if (!s) return null;
  const [{ latestSignals }, { isPatternSignal }, read] = await Promise.all([import("../signals.server"), import("../patterns"), import("../read.server")]);
  const [all, { signals }, thumbs, series] = await Promise.all([storyIndex().catch(() => []), latestSignals("all"), read.allThumbs().catch(() => []), s.signal_keys.length ? read.loadSignalSeries("all").catch(() => ({})) : Promise.resolve({} as Record<string, number[]>)]);
  const byKey = new Map(signals.map(x => [x.key, x])), key = s.signal_keys[0];
  const type = isKind(s.type) ? s.type : "news";
  const earlier = storiesAbout(all, { signals: s.signal_keys, domain: s.domains.length === 1 ? s.domains[0] : undefined, exclude: s.id, limit: 6 }).filter(x => x.at <= s.happened_at || s.type === "white_space");
  const page = storyPage(s, { earlier, patterns: s.signal_keys.filter(k => { const x = byKey.get(k); return x ? isPatternSignal(x) : false; }), numbers: await storyNumbers(s), colourEvents: await colourEventsOf(s).catch(() => []), dating: await storyDating(s) });
  const { pickThumb } = await import("../thumbs");
  const thumb = (type === "move" || type === "rebrand" || type === "counter_move") && s.domains[0] ? pickThumb(thumbs, s.domains[0], s.happened_at) : null;
  const crops = await evidenceOf(s, type);
  const lead = await leadOf(s, crops, { census: page.census?.lines ?? null, names: new Map(page.brands.map(b => [b.domain, b.name])) }).catch(() => null);
  return { ...page, lead, thumb, crops, frames: crops.compare ? null : await framesOf(s, type), series: key ? { key, name: page.signals[0]?.name ?? key, points: (series as Record<string, number[]>)[key] ?? [] } : null };
}

/** P1 · shell first, critical: the story with its cover evidence (crops, redrawn frames, the signal's trail and the latest capture),
 * from the story's own rows and indexed per-brand reads; the quarter trail comes from the precomputed series record. No story index. */
/** One story by id, shared by the head and the lead for half a minute so a page reads it once. */
const storyOnce = memoBy(30_000, (id: string) => storyById(id), { key: id => id, max: 200 });
/** E3b · the story page's head: headline, deck, kicker and whether it ran (title, description, noindex). The only read a story page
 *  waits for: the story's own row with its edits and checked text, each found by its id; the body streams after. */
export async function loadStoryHead(id: string): Promise<{ headline: string; deck: string | null; kicker: string; ran: boolean; number: number | null } | null> {
  const s = await storyOnce(id);
  return s ? { headline: s.headline, deck: s.deck, kicker: s.kicker, ran: s.state === "published", number: s.state === "published" ? s.number ?? null : null } : null;
}
export async function loadStoryLead(id: string, o: { asOf?: string } = {}) {
  const s = o.asOf ? await (await import("./read.server")).storyById(id, o.asOf) : await storyOnce(id); if (!s) return null;
  if (s.state === "killed") return retiredLead(s);
  const type = isKind(s.type) ? s.type : "news", key = s.signal_keys[0], d = s.domains[0];
  const [{ quarterSeries }, { wellCovered }, { pickThumb }, { supabaseAnon }] = await Promise.all([import("../front/front.server"), import("../kit"), import("../thumbs"), import("../mcp/supabase")]);
  const wantThumb = (type === "move" || type === "rebrand" || type === "counter_move") && !!d;
  const [series, thumbs, crops, frames, numbers, colourEvents, dating] = await Promise.all([
    key ? quarterSeries().then(all => all.find(x => x.key === key)?.quarters.filter(wellCovered).map(p => p.s as number) ?? []).catch(() => []) : Promise.resolve([] as number[]),
    wantThumb ? supabaseAnon().from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").eq("domain", d!).order("captured_at", { ascending: false }).limit(8).then(r => r.data ?? []) : Promise.resolve([]),
    evidenceOf(s, type),
    framesOf(s, type).catch(() => null),
    storyNumbers(s),
    colourEventsOf(s).catch(() => []),
    storyDating(s),
  ]);
  const page = storyPage(s, { earlier: [], patterns: [], numbers, colourEvents, dating });
  // I1: a single-brand story carries the brand's icon on its subject line, and its drawn captures can reveal the real hero crop.
  const [{ picsFor }, { revealOf }] = await Promise.all([import("../pictures.server"), import("../pictures")]);
  const pics = d ? await picsFor(d) : null, reveal = d ? revealOf(d, pics?.hero) : null;
  const drawn = crops.compare || crops.after ? null : frames ? { before: { ...frames.before, reveal }, after: { ...frames.after, reveal } } : null;
  const lead = await leadOf(s, crops, { colourEvents, census: page.census?.lines ?? null, chart: series.length >= 2, names: new Map(page.brands.map(b => [b.domain, b.name])) }).catch(() => null);
  return { ...page, lead, eventIds: sourceEventIds(s.source_ids), retired: null as Retired | null, icon: s.domains.length === 1 ? pics?.icon ?? null : null, thumb: wantThumb ? pickThumb(thumbs as never, d!, s.happened_at) : null, crops, frames: drawn, series: key ? { key, name: page.signals[0]?.name ?? key, points: series } : null };
}
/** I3 · the story's lead picture, by rule (lead-picture.ts), from what the page already loaded plus the one cached picture lookup. */
export async function leadOf(s: StoryRecord, crops: import("./evidence").StoryEvidence | null, o: { colourEvents?: import("./recolour").ColourEvent[]; census?: { name: string; line: string; href: string | null }[] | null; chart?: boolean; names?: ReadonlyMap<string, string | null>; /** N3 · the rule's own plan, before the graphics desk's choice. */ rule?: boolean } = {}) {
  const [{ leadPicture }, { leadPics }] = await Promise.all([import("../lead-picture"), import("../lead-picture.server")]);
  const ids = sourceEventIds(s.source_ids), colour = o.colourEvents ?? [];
  const hexes = (v: unknown) => { const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; return [...(Array.isArray(r["palette"]) ? (r["palette"] as unknown[]) : []), r["accent"]].filter((x): x is string => typeof x === "string" && /^#[0-9a-f]{3,8}$/i.test(x)); };
  const one = colour.length === 1 && colour[0]!.type === "palette_shift" ? colour[0]! : null;
  const paletteOnly = !!one && ids.length === 1;
  const dates = [...new Set(((Array.isArray(s.facts) ? s.facts : []) as { text: string }[]).flatMap(f => String(f.text ?? "").match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []))];
  const pics = await leadPics(d => o.names?.get(d) ?? d);
  const assetPair = s.id.startsWith("quiet:asset:") ? await quietPair(s.id, s.source_ids).catch(() => null) : s.id.startsWith("quiet:event:") ? await quietPagePair(s.source_ids).catch(() => null) : null;
  const rule = leadPicture({ kind: "story", story: { assetPair, id: s.id, type: s.type, domains: s.domains, happened_at: s.happened_at, sector: s.sector ?? null, evidence: crops, fields: paletteOnly ? ["palette"] : [], palette: one ? { before: hexes(one.before), after: hexes(one.after) } : null, census: o.census ?? null, dates: dates.length ? dates : [s.happened_at.slice(0, 10)], chart: !!o.chart } }, pics);
  if (o.rule) return rule;
  // N3 · the graphics desk's newest choice, applied by rule (only a stored crop that passes the quality gate; else the rule's plan).
  const choice = await pictureChoiceOf(s.id).catch(() => null);
  if (!choice || choice.kind === "rule") return rule;
  const [{ applyChoice }, { toCrop }, { cropsFor }] = await Promise.all([import("../lead-picture"), import("../crops"), import("../read.server")]);
  const pool = choice.kind === "crop" ? (await cropsFor(s.domains).catch(() => [])).map(toCrop) : [];
  return applyChoice(rule, choice, pool, pics, s.happened_at);
}
/** N3 · one story's newest picture choice through the public facade (short-lived per instance, so a page never waits long on it). */
const choiceCache = new Map<string, { at: number; v: import("../lead-picture").PictureChoice | null }>();
/** Drop one story's cached choice (the graphics desk just recorded a new one in this instance). */
export const forgetPictureChoice = (id: string) => { choiceCache.delete(id); };
export async function pictureChoiceOf(id: string): Promise<import("../lead-picture").PictureChoice | null> {
  const hit = choiceCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  const { supabaseAnon } = await import("../mcp/supabase");
  const { data, error } = await supabaseAnon().rpc("story_picture_choices", { p_ids: [id] });
  if (error) throw new Error("picture_choice_read_failed");
  const r = (data ?? [])[0];
  const v = r ? { kind: r.kind, assets: r.assets ?? [], actor: r.actor, reason: r.reason, at: r.at } : null;
  if (choiceCache.size > 500) choiceCache.clear();
  choiceCache.set(id, { at: Date.now(), v });
  return v;
}
/** W1b · a quiet icon or card story's old and new stored versions (`asset-from:` / `asset-to:` source ids; brand_assets hides opted-out brands). */
async function quietPair(id: string, sourceIds: string[]) {
  const from = sourceIds.find(x => x.startsWith("asset-from:"))?.slice(11), to = sourceIds.find(x => x.startsWith("asset-to:"))?.slice(9);
  if (!from || !to) return null;
  const [{ supabaseAnon }, { cropSrc }] = await Promise.all([import("../mcp/supabase"), import("../crops")]);
  const { data } = await supabaseAnon().from("brand_assets").select("path,width,height,first_seen_at,last_seen_at").in("path", [from, to]);
  const a = data?.find(r => r.path === from), b = data?.find(r => r.path === to);
  if (!a || !b) return null;
  return { kind: id.split(":")[3] ?? "icon", before: { path: a.path, src: cropSrc(a.path), width: a.width, height: a.height, at: a.last_seen_at }, after: { path: b.path, src: cropSrc(b.path), width: b.width, height: b.height, at: b.first_seen_at } };
}
/** W1d · a quiet page change's stored first screens before and after (`page-from:` / `page-to:` source ids; surface_crops hides opted-out
 *  brands). Stored section values map back to their `page-` names through SURFACE_COLUMN only. */
async function quietPagePair(sourceIds: string[]) {
  const from = sourceIds.find(x => x.startsWith("page-from:"))?.slice(10), to = sourceIds.find(x => x.startsWith("page-to:"))?.slice(8);
  if (!from || !to) return null;
  const [{ supabaseAnon }, { cropSrc, SURFACE_COLUMN }] = await Promise.all([import("../mcp/supabase"), import("../crops")]);
  const { data } = await supabaseAnon().from("surface_crops").select("section,path,width,height,first_seen_at,last_seen_at").in("path", [from, to]);
  const a = data?.find(r => r.path === from), b = data?.find(r => r.path === to);
  const kind = (Object.entries(SURFACE_COLUMN).find(([, v]) => v === a?.section)?.[0]) ?? null;
  if (!a || !b || !kind || a.section !== b.section) return null;
  return { kind, before: { path: a.path, src: cropSrc(a.path), width: a.width, height: a.height, at: a.last_seen_at }, after: { path: b.path, src: cropSrc(b.path), width: b.width, height: b.height, at: b.first_seen_at } };
}
/** E2d · what a retired story's page shows: the editor's note and the tape lines it was built from (each linking to the library record). */
export type Retired = { note: string | null; tape: { id: number; text: string; href: string; confirmed: boolean }[] };
/** Event ids a story was built from (`event:<id>`, and a folded move's `story:move:<id>`), at most 40. */
export const sourceEventIds = (sourceIds: string[]) => [...new Set(sourceIds.flatMap(x => { const m = /^(?:event|story:move):(\d+)$/.exec(x); return m ? [Number(m[1])] : []; }))].slice(0, 40);
/** A retired story keeps its page: its number, date, the headline it ran under, "Retired" with the note, the brand and its tape lines.
 *  No body, no picture, no way on (anonymous reads; a failed tape read shows the brand link alone). */
async function retiredLead(s: StoryRecord) {
  const page = storyPage(s, { earlier: [], patterns: [] }), ids = sourceEventIds(s.source_ids);
  // The number stays hidden everywhere else (withNumbers shows it only while published); its own page shows it, read directly.
  const { supabaseAnon } = await import("../mcp/supabase");
  const [tape, number] = await Promise.all([
    ids.length ? tapeOf(ids).catch(() => []) : Promise.resolve([]),
    supabaseAnon().from("story_numbers").select("number").eq("story_id", s.id).maybeSingle().then(r => (r.data?.number as number | undefined) ?? null, () => null),
  ]);
  const retired: Retired = { note: s.killReason, tape };
  return { ...page, eventIds: [] as number[], number, body: [], facts: [], beforeAfter: null, retired, icon: null, thumb: null, frames: null, series: null };
}
export async function tapeOf(ids: number[]) {
  const [{ supabaseAnon }, { tapeLine }, { carouselIds }] = await Promise.all([import("../mcp/supabase"), import("../tape"), import("../carousel.server")]);
  const db = supabaseAnon();
  const { data, error } = await db.from("library_events").select("id,domain,type,before,after,detected_at,page_type,summary,snapshot_id,prev_snapshot_id").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []).flatMap(e => (e.detected_at ? [{ ...e, detected_at: e.detected_at }] : [])).sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id);
  const [carousel, checks] = await Promise.all([carouselIds(db, rows).then(x => new Set(x)), import("../integrity.server").then(m => m.latestChecks(db, rows.map(e => e.id))).catch(() => new Map())]);
  // E2e: a change that failed the integrity check is named as such (it is not on the tape). U2b: each line is dated by its captures
  // (the check's last-old and first-new capture), as the story's own facts are, not by the day it was confirmed.
  const { VERDICT_LABEL, seenOf } = await import("../integrity");
  const mark = (id: number) => { const c = checks.get(id); if (!c) return "Not checked"; if (c.verdict === "pass") return null; return c.verdict === "headline_element" ? "Not compared: the headline was not read from the page's h1" : VERDICT_LABEL[c.verdict as "seen_once" | "alternating"]; };
  return rows.map(e => { const m = mark(e.id); return { id: e.id, text: `${tapeLine(((sn) => (sn ? { ...e, seen: sn } : e))(seenOf(checks.get(e.id))), { carousel: carousel.has(e.id) })}${m ? ` · ${m}` : ""}`, href: `/brands/${encodeURIComponent(e.domain)}?view=data`, confirmed: !m }; });
}
/** P1, deferred: earlier stories on the same signal or brand, the patterns among its signals, and the way on (Next, the study). */
export async function loadStoryRelated(id: string) {
  const s = await storyById(id); if (!s) return { earlier: [], patterns: [], next: null, study: null };
  const [{ latestSignals }, { isPatternSignal }, { nextStory }] = await Promise.all([import("../signals.server"), import("../patterns"), import("./view")]);
  const [all, { signals }] = await Promise.all([storyIndex().catch(() => []), latestSignals("all")]);
  const byKey = new Map(signals.map(x => [x.key, x]));
  const earlier = storiesAbout(all, { signals: s.signal_keys, domain: s.domains.length === 1 ? s.domains[0] : undefined, exclude: s.id, limit: 6 }).filter(x => x.at <= s.happened_at || s.type === "white_space");
  const page = storyPage(s, { earlier, patterns: s.signal_keys.filter(k => { const x = byKey.get(k); return x ? isPatternSignal(x) : false; }) });
  return { earlier: page.earlier, patterns: page.patterns, next: nextStory(all, s.id), study: await studyFor(s.signal_keys) };
}
/** "Part of the study": a live study covering one of the story's signals, with its written headline, only while studies are public. */
export async function studyFor(keys: string[]): Promise<{ href: string; title: string } | null> {
  const [{ DATA_STORIES_PUBLIC }, { liveEntries, studyLabel }] = await Promise.all([import("../site"), import("../data-stories/registry")]);
  if (!DATA_STORIES_PUBLIC) return null;
  const e = liveEntries().find(x => x.params.signal && keys.includes(x.params.signal));
  if (!e) return null;
  const p = await import("../data-stories/page.server").then(m => m.loadDataStory(e.slug)).catch(() => null);
  return { href: `/data/${e.slug}`, title: `${studyLabel(e.number)}: ${p?.kind === "live" ? p.story.text.headline : e.question}` };
}

/** No crops either side of the change: the stored captures either side of it, redrawn from their skeletons (anonymous reads). */
export async function framesOf(s: { type: string; domains: string[]; happened_at: string }, type: string) {
  const d = s.domains[0];
  if (!d || (type !== "move" && type !== "counter_move" && type !== "rebrand")) return null;
  const [{ capturesOf }, { storyFrames }] = await Promise.all([import("../data-stories/data.server"), import("./frames")]);
  return storyFrames(d, await capturesOf(d).catch(() => []), s.happened_at);
}

/** Section crops for MOVE / COUNTER-MOVE / REBRAND (before/after) and ROUNDUP (member heroes); empty and honest with zero crops. */
export async function evidenceOf(s: { id?: string; type: string; domains: string[]; source_ids: string[]; happened_at: string }, type: string, o: { kept?: boolean } = {}) {
  const [{ storyEvidence, storyEventIds, withKept }, read, { supabaseAnon }] = await Promise.all([import("./evidence"), import("../read.server"), import("../mcp/supabase")]);
  if (type !== "move" && type !== "counter_move" && type !== "rebrand" && type !== "roundup") return storyEvidence({ type, domains: [] }, [], s.happened_at, []);
  const ids = storyEventIds(s.source_ids).slice(0, 40);
  const [crops, events, kept] = await Promise.all([
    read.cropsFor(type === "roundup" ? s.domains : s.domains.slice(0, 1)).catch(() => []),
    ids.length && type !== "roundup" ? supabaseAnon().from("library_event_feed").select("id,type,before,after,detected_at,effective_at").in("id", ids).then(r => r.data ?? []) : Promise.resolve([]),
    // E2c: the crops this story keeps (never replaced by newer ones); a failure reads as none.
    s.id && o.kept !== false ? supabaseAnon().from("story_kept_crops").select("path,domain,role").eq("story_id", s.id).then(r => (r.data ?? []) as import("./evidence").KeptCrop[], () => []) : Promise.resolve([] as import("./evidence").KeptCrop[]),
  ]);
  const keys = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v) : []);
  const changes = type === "rebrand" ? [{ kind: "rebrand" as const, reasons: [] }] : events.map(e => ({ kind: "event" as const, type: e.type, fields: [...new Set([...keys(e.before), ...keys(e.after)])] }));
  // Pivot: when the change first appeared (effective time of its earliest event), else when the story happened.
  const pivot = events.map(e => e.effective_at ?? e.detected_at).filter((x): x is string => !!x).sort()[0] ?? s.happened_at;
  return withKept(storyEvidence({ type, domains: s.domains, ...(s.id ? { id: s.id } : {}) }, changes, pivot, crops), kept, crops);
}
export async function loadQueue(day: string | null, fresh: boolean) {
  return queueModel(await (fresh ? deskIndex() : storyIndex()), day, Date.now());
}

/** The desk's outside-news line: what the last seven days of rss, Hacker News and Bluesky items would do under the news rule
 *  (anonymous reads; the same pure `newsCandidates` the build uses). Fails soft: the desk shows the queue without it. */
export async function newsWindow(days = 7): Promise<{ kept: number; dropped: number; drops: import("./candidates").NewsDrops } | null> {
  try {
    const [{ supabaseAnon }, { newsMatcher, newsCandidates }, { latestSignals }, { decodeEntities }] = await Promise.all([import("../mcp/supabase"), import("./candidates"), import("../signals.server"), import("../entities")]);
    const db = supabaseAnon(), since = new Date(Date.now() - days * 864e5).toISOString();
    const [wire, sites, { signals }] = await Promise.all([
      db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").in("source_kind", ["rss", "hn", "bluesky"]).gte("published_at", since).order("id").range(0, 999),
      db.from("library_sites").select("domain,name,active").order("domain").range(0, 999),
      latestSignals("all"),
    ]);
    if (wire.error || sites.error) return null;
    const m = newsMatcher((sites.data ?? []).filter(x => x.active), signals.filter(x => x.tier === "headline").map(x => x.key));
    const r = newsCandidates(m, (wire.data ?? []).map(w => ({ ...w, title: decodeEntities(w.title), excerpt: w.excerpt ? decodeEntities(w.excerpt) : null })));
    return { kept: r.candidates.length, dropped: r.dropped, drops: r.drops };
  } catch { return null; }
}
