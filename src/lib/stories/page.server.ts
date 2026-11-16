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
  return { ...page, thumb, series: key ? { key, name: page.signals[0]?.name ?? key, points: (series as Record<string, number[]>)[key] ?? [] } : null };
}
export async function loadQueue(day: string | null, fresh: boolean) {
  return queueModel(await (fresh ? deskIndex() : storyIndex()), day, Date.now());
}
