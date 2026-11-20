// Story page + queue loaders (anonymous SELECT-only). No AI per view.
import { storyById, storyIndex, deskIndex } from "./read.server";
import { memoBy } from "../memo";
import { queueModel, storiesAbout, storyPage, isKind, type StoryRecord } from "./view";

export async function loadStory(id: string) {
  const s = await storyById(id); if (!s) return null;
  const [{ latestSignals }, { isPatternSignal }, read] = await Promise.all([import("../signals.server"), import("../patterns"), import("../read.server")]);
  const [all, { signals }, thumbs, series] = await Promise.all([storyIndex().catch(() => []), latestSignals("all"), read.allThumbs().catch(() => []), s.signal_keys.length ? read.loadSignalSeries("all").catch(() => ({})) : Promise.resolve({} as Record<string, number[]>)]);
  const byKey = new Map(signals.map(x => [x.key, x])), key = s.signal_keys[0];
  const type = isKind(s.type) ? s.type : "news";
  const earlier = storiesAbout(all, { signals: s.signal_keys, domain: s.domains.length === 1 ? s.domains[0] : undefined, exclude: s.id, limit: 6 }).filter(x => x.at <= s.happened_at || s.type === "white_space");
  const page = storyPage(s, { earlier, patterns: s.signal_keys.filter(k => { const x = byKey.get(k); return x ? isPatternSignal(x) : false; }) });
  const { pickThumb } = await import("../thumbs");
  const thumb = (type === "move" || type === "rebrand" || type === "counter_move") && s.domains[0] ? pickThumb(thumbs, s.domains[0], s.happened_at) : null;
  const crops = await evidenceOf(s, type);
  return { ...page, thumb, crops, frames: crops.compare ? null : await framesOf(s, type), series: key ? { key, name: page.signals[0]?.name ?? key, points: (series as Record<string, number[]>)[key] ?? [] } : null };
}

/** P1 · shell first, critical: the story with its cover evidence (crops, redrawn frames, the signal's trail and the latest capture),
 * from the story's own rows and indexed per-brand reads; the quarter trail comes from the precomputed series record. No story index. */
/** One story by id, shared by the head and the lead for half a minute so a page reads it once. */
const storyOnce = memoBy(30_000, (id: string) => storyById(id), { key: id => id, max: 200 });
/** E3b · the story page's head: headline, deck, kicker and whether it ran (title, description, noindex). The only read a story page
 *  waits for: the story's own row with its edits and checked text, each found by its id; the body streams after. */
export async function loadStoryHead(id: string): Promise<{ headline: string; deck: string | null; kicker: string; ran: boolean } | null> {
  const s = await storyOnce(id);
  return s ? { headline: s.headline, deck: s.deck, kicker: s.kicker, ran: s.state === "published" } : null;
}
export async function loadStoryLead(id: string) {
  const s = await storyOnce(id); if (!s) return null;
  if (s.state === "killed") return retiredLead(s);
  const type = isKind(s.type) ? s.type : "news", key = s.signal_keys[0], d = s.domains[0];
  const [{ quarterSeries }, { wellCovered }, { pickThumb }, { supabaseAnon }] = await Promise.all([import("../front/front.server"), import("../kit"), import("../thumbs"), import("../mcp/supabase")]);
  const wantThumb = (type === "move" || type === "rebrand" || type === "counter_move") && !!d;
  const [series, thumbs, crops, frames] = await Promise.all([
    key ? quarterSeries().then(all => all.find(x => x.key === key)?.quarters.filter(wellCovered).map(p => p.s as number) ?? []).catch(() => []) : Promise.resolve([] as number[]),
    wantThumb ? supabaseAnon().from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").eq("domain", d!).order("captured_at", { ascending: false }).limit(8).then(r => r.data ?? []) : Promise.resolve([]),
    evidenceOf(s, type),
    framesOf(s, type).catch(() => null),
  ]);
  const page = storyPage(s, { earlier: [], patterns: [] });
  // I1: a single-brand story carries the brand's icon on its subject line, and its drawn captures can reveal the real hero crop.
  const [{ picsFor }, { revealOf }] = await Promise.all([import("../pictures.server"), import("../pictures")]);
  const pics = d ? await picsFor(d) : null, reveal = d ? revealOf(d, pics?.hero) : null;
  const drawn = crops.compare || crops.after ? null : frames ? { before: { ...frames.before, reveal }, after: { ...frames.after, reveal } } : null;
  return { ...page, retired: null as Retired | null, icon: s.domains.length === 1 ? pics?.icon ?? null : null, thumb: wantThumb ? pickThumb(thumbs as never, d!, s.happened_at) : null, crops, frames: drawn, series: key ? { key, name: page.signals[0]?.name ?? key, points: series } : null };
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
  return { ...page, number, body: [], facts: [], beforeAfter: null, retired, icon: null, thumb: null, frames: null, series: null };
}
async function tapeOf(ids: number[]) {
  const [{ supabaseAnon }, { tapeLine }, { carouselIds }] = await Promise.all([import("../mcp/supabase"), import("../tape"), import("../carousel.server")]);
  const db = supabaseAnon();
  const { data, error } = await db.from("library_events").select("id,domain,type,before,after,detected_at,page_type,summary,snapshot_id,prev_snapshot_id").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []).flatMap(e => (e.detected_at ? [{ ...e, detected_at: e.detected_at }] : [])).sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id);
  const [carousel, checks] = await Promise.all([carouselIds(db, rows).then(x => new Set(x)), import("../integrity.server").then(m => m.latestChecks(db, rows.map(e => e.id))).catch(() => new Map())]);
  // E2e: a change that failed the integrity check is named as such (it is not on the tape).
  const { VERDICT_LABEL } = await import("../integrity");
  const mark = (id: number) => { const c = checks.get(id); if (!c) return "Not checked"; if (c.verdict === "pass") return null; return c.verdict === "headline_element" ? "Not compared: the headline was not read from the page's h1" : VERDICT_LABEL[c.verdict as "seen_once" | "alternating"]; };
  return rows.map(e => { const m = mark(e.id); return { id: e.id, text: `${tapeLine(e, { carousel: carousel.has(e.id) })}${m ? ` · ${m}` : ""}`, href: `/library/${encodeURIComponent(e.domain)}`, confirmed: !m }; });
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
