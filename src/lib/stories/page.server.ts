// Story page + queue loaders (anonymous SELECT-only). No AI per view.
import { storyById, storyIndex, deskIndex } from "./read.server";
import { queueModel, soWhatOf, storiesAbout, storyPage, isKind } from "./view";

export async function loadStory(id: string) {
  const s = await storyById(id); if (!s) return null;
  const [{ latestSignals }, { isPatternSignal }, read] = await Promise.all([import("../signals.server"), import("../patterns"), import("../read.server")]);
  const [all, { signals }, thumbs, series] = await Promise.all([storyIndex().catch(() => []), latestSignals("all"), read.allThumbs().catch(() => []), s.signal_keys.length ? read.loadSignalSeries("all").catch(() => ({})) : Promise.resolve({} as Record<string, number[]>)]);
  const byKey = new Map(signals.map(x => [x.key, x])), key = s.signal_keys[0];
  const type = isKind(s.type) ? s.type : "news";
  const earlier = storiesAbout(all, { signals: s.signal_keys, domain: s.domains.length === 1 ? s.domains[0] : undefined, exclude: s.id, limit: 6 }).filter(x => x.at <= s.happened_at || s.type === "white_space");
  const page = storyPage(s, { earlier, soWhat: soWhatOf({ type, signalKeys: s.signal_keys, stage: key ? byKey.get(key)?.stage ?? null : null }), patterns: s.signal_keys.filter(k => { const x = byKey.get(k); return x ? isPatternSignal(x) : false; }) });
  const { pickThumb } = await import("../thumbs");
  const thumb = (type === "move" || type === "rebrand" || type === "counter_move") && s.domains[0] ? pickThumb(thumbs, s.domains[0], s.happened_at) : null;
  const crops = await evidenceOf(s, type);
  return { ...page, thumb, crops, frames: crops.compare ? null : await framesOf(s, type), series: key ? { key, name: page.signals[0]?.name ?? key, points: (series as Record<string, number[]>)[key] ?? [] } : null };
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
