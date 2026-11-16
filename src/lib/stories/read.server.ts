// Anonymous SELECT-only reads of stored stories plus the editor's edits, overlaid at read time. Short per-instance TTL; no AI per view.
import { supabaseAnon } from "../mcp/supabase";
import { overlay, type EditRow, type StoredStory } from "./edits";
import type { StoryRecord } from "./view";

type LineRow = { story_id: string; why_line: string; why_model: string; why_at: string };
/** A line written after the story was stored (story_lines) fills an empty why_line; the stored row itself never changes. */
export const withLines = (stories: StoredStory[], lines: LineRow[]) => { const by = new Map(lines.map(l => [l.story_id, l])); return stories.map(s => { const l = s.why_line ? null : by.get(s.id); return l ? { ...s, why_line: l.why_line, why_model: l.why_model, why_at: l.why_at } : s; }); };

const COLS = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
async function pages<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += size) { const { data, error } = await f(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
/** How far back pages read stories (older ones stay in the table and on their own pages). */
export const STORY_WINDOW_DAYS = 120;
const TTL = 60_000;
let cache: { at: number; v: Promise<StoryRecord[]> } | null = null;

async function load(): Promise<StoryRecord[]> {
  const db = supabaseAnon(), since = new Date(Date.now() - STORY_WINDOW_DAYS * 864e5).toISOString();
  const [stories, edits, lines] = await Promise.all([
    pages<StoredStory>((f, t) => db.from("stories").select(COLS).gte("happened_at", since).order("happened_at", { ascending: false }).order("id").range(f, t) as never),
    pages<EditRow>((f, t) => db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never),
    pages<LineRow>((f, t) => db.from("story_lines").select("story_id,why_line,why_model,why_at").order("story_id").range(f, t) as never),
  ]);
  return overlay(withLines(stories, lines), edits, Date.now());
}
/** Every story in the window with edits applied (published, held and killed). */
export function storyIndex(): Promise<StoryRecord[]> {
  if (!cache || Date.now() - cache.at > TTL) { const v = load(); cache = { at: Date.now(), v }; v.catch(() => { cache = null; }); }
  return cache.v;
}
/** One story by id, fresh (outside the window too). */
export async function storyById(id: string): Promise<StoryRecord | null> {
  const db = supabaseAnon();
  const [s, e, l] = await Promise.all([db.from("stories").select(COLS).eq("id", id).maybeSingle(), db.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", id).order("id"), db.from("story_lines").select("story_id,why_line,why_model,why_at").eq("story_id", id)]);
  if (s.error) throw s.error; if (e.error) throw e.error; if (l.error) throw l.error;
  return s.data ? overlay(withLines([s.data as unknown as StoredStory], (l.data ?? []) as LineRow[]), (e.data ?? []) as unknown as EditRow[], Date.now())[0]! : null;
}
/** The desk reads fresh, not through the TTL cache. */
export async function deskIndex(): Promise<StoryRecord[]> { cache = null; return storyIndex(); }
