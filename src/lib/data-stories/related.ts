// E4 · "Stories that fed this study": up to five published stories from the last 60 days that share the study's signal (its members too,
// for a composite), or its sectors for a sector study; a study across every sector takes the change stories. Newest first. Pure.
import { compositeOf } from "../composites";
import { storiesAbout, streamOf, toStory, type StoryRecord } from "../stories/view";
import type { Story } from "../stories";

export const RELATED_DAYS = 60, RELATED_MAX = 5;
const CHANGE_TYPES = new Set(["move", "rebrand", "counter_move", "roundup"]);
export function studyStories(all: StoryRecord[], o: { signal: string | null; sectors: readonly string[] | null; now: number }): Story[] {
  const since = new Date(o.now - RELATED_DAYS * 864e5).toISOString();
  if (o.signal) {
    const keys = [o.signal, ...(compositeOf(o.signal)?.memberKeys ?? [])];
    return storiesAbout(all, { signals: keys, limit: 200 }).filter(s => s.at >= since).slice(0, RELATED_MAX);
  }
  const fits = (s: StoryRecord) => (o.sectors ? !!s.sector && o.sectors.includes(s.sector) : CHANGE_TYPES.has(s.type));
  return streamOf(all).filter(s => s.type !== "launch" && s.happened_at >= since && fits(s)).slice(0, RELATED_MAX).map(toStory);
}
