// Story page + queue loaders (anonymous SELECT-only). No AI per view.
import { storyById, storyIndex, deskIndex } from "./read.server";
import { queueModel, storiesAbout, storyPage, isKind } from "./view";

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
export async function loadStoryLead(id: string) {
  const s = await storyById(id); if (!s) return null;
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
  return { ...page, icon: s.domains.length === 1 ? pics?.icon ?? null : null, thumb: wantThumb ? pickThumb(thumbs as never, d!, s.happened_at) : null, crops, frames: drawn, series: key ? { key, name: page.signals[0]?.name ?? key, points: series } : null };
}
/** P1, deferred: earlier stories on the same signal or brand, and the patterns among its signals. */
export async function loadStoryRelated(id: string) {
  const s = await storyById(id); if (!s) return { earlier: [], patterns: [] };
  const [{ latestSignals }, { isPatternSignal }] = await Promise.all([import("../signals.server"), import("../patterns")]);
  const [all, { signals }] = await Promise.all([storyIndex().catch(() => []), latestSignals("all")]);
  const byKey = new Map(signals.map(x => [x.key, x]));
  const earlier = storiesAbout(all, { signals: s.signal_keys, domain: s.domains.length === 1 ? s.domains[0] : undefined, exclude: s.id, limit: 6 }).filter(x => x.at <= s.happened_at || s.type === "white_space");
  const page = storyPage(s, { earlier, patterns: s.signal_keys.filter(k => { const x = byKey.get(k); return x ? isPatternSignal(x) : false; }) });
  return { earlier: page.earlier, patterns: page.patterns };
}

/** No crops either side of the change: the stored captures either side of it, redrawn from their skeletons (anonymous reads). */
export async function framesOf(s: { type: string; domains: string[]; happened_at: string }, type: string) {
  const d = s.domains[0];
  if (!d || (type !== "move" && type !== "counter_move" && type !== "rebrand")) return null;
  const [{ capturesOf }, { storyFrames }] = await Promise.all([import("../data-stories/data.server"), import("./frames")]);
  return storyFrames(d, await capturesOf(d).catch(() => []), s.happened_at);
}

/** Section crops for MOVE / COUNTER-MOVE / REBRAND (before/after) and ROUNDUP (member heroes); empty and honest with zero crops. */
export async function evidenceOf(s: { type: string; domains: string[]; source_ids: string[]; happened_at: string }, type: string) {
  const [{ storyEvidence, storyEventIds }, read, { supabaseAnon }] = await Promise.all([import("./evidence"), import("../read.server"), import("../mcp/supabase")]);
  if (type !== "move" && type !== "counter_move" && type !== "rebrand" && type !== "roundup") return storyEvidence({ type, domains: [] }, [], s.happened_at, []);
  const ids = storyEventIds(s.source_ids).slice(0, 40);
  const [crops, events] = await Promise.all([
    read.cropsFor(type === "roundup" ? s.domains : s.domains.slice(0, 1)).catch(() => []),
    ids.length && type !== "roundup" ? supabaseAnon().from("library_event_feed").select("id,type,before,after,detected_at,effective_at").in("id", ids).then(r => r.data ?? []) : Promise.resolve([]),
  ]);
  const keys = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v) : []);
  const changes = type === "rebrand" ? [{ kind: "rebrand" as const, reasons: [] }] : events.map(e => ({ kind: "event" as const, type: e.type, fields: [...new Set([...keys(e.before), ...keys(e.after)])] }));
  // Pivot: when the change first appeared (effective time of its earliest event), else when the story happened.
  const pivot = events.map(e => e.effective_at ?? e.detected_at).filter((x): x is string => !!x).sort()[0] ?? s.happened_at;
  return storyEvidence({ type, domains: s.domains }, changes, pivot, crops);
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
