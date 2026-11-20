// Anonymous SELECT-only reads of stored stories plus the editor's edits, overlaid at read time. Short per-instance TTL; no AI per view.
import { supabaseAnon } from "../mcp/supabase";
import { memo } from "../memo";
import { overlay, type EditRow, type StoredStory } from "./edits";
import type { StoryRecord } from "./view";
import { withNumbers, type NumberRow } from "./numbers";

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

async function loadRaw(): Promise<{ stories: StoredStory[]; edits: EditRow[]; lines: LineRow[]; numbers: NumberRow[] }> {
  const db = supabaseAnon(), since = new Date(Date.now() - STORY_WINDOW_DAYS * 864e5).toISOString();
  const [stories, edits, lines, numbers] = await Promise.all([
    pages<StoredStory>((f, t) => db.from("stories").select(COLS).gte("happened_at", since).order("happened_at", { ascending: false }).order("id").range(f, t) as never),
    pages<EditRow>((f, t) => db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never),
    pages<LineRow>((f, t) => db.from("story_lines").select("story_id,why_line,why_model,why_at").order("story_id").range(f, t) as never),
    pages<NumberRow>((f, t) => db.from("story_numbers").select("story_id,number").order("number").range(f, t) as never, 1000),
  ]);
  return { stories, edits, lines, numbers };
}
/** Stored stories, edits and late why-lines before any overlay (editions replay them as of a past moment). Same TTL as storyIndex. */
export const storyRaw = memo(TTL, loadRaw);
async function load(): Promise<StoryRecord[]> {
  const { stories, edits, lines, numbers } = await storyRaw();
  return withNumbers(overlay(withLines(stories, lines), edits, Date.now()), numbers);
}
/** Every story in the window with edits applied (published, held and killed). */
const index = memo(TTL, load);
export const storyIndex = (): Promise<StoryRecord[]> => index();
/** One story by id, fresh (outside the window too). */
export async function storyById(id: string): Promise<StoryRecord | null> {
  const db = supabaseAnon();
  const [s, e, l, n] = await Promise.all([db.from("stories").select(COLS).eq("id", id).maybeSingle(), db.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", id).order("id"), db.from("story_lines").select("story_id,why_line,why_model,why_at").eq("story_id", id), db.from("story_numbers").select("story_id,number").eq("story_id", id)]);
  if (s.error) throw s.error; if (e.error) throw e.error; if (l.error) throw l.error; if (n.error) throw n.error;
  return s.data ? withNumbers(overlay(withLines([s.data as unknown as StoredStory], (l.data ?? []) as LineRow[]), (e.data ?? []) as unknown as EditRow[], Date.now()), (n.data ?? []) as NumberRow[])[0]! : null;
}
/** /stories/no/<n>: the story id a number points at, only while that story is published. */
export async function storyIdByNumber(n: number): Promise<string | null> {
  const { data, error } = await supabaseAnon().from("story_numbers").select("story_id,number").eq("number", n).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const s = await storyById(data.story_id);
  return s && s.state === "published" ? s.id : null;
}
/** The desk reads fresh, not through the TTL cache. */
export async function deskIndex(): Promise<StoryRecord[]> { index.clear(); return storyIndex(); }
/** Stories that name one brand (indexed on `domains`), with edits, late lines and numbers overlaid: what a brand page needs, without
 * reading the whole story window. Roundups and rebrands holding the brand's moves name it too, so source links still resolve. */
export async function storiesForDomain(domain: string): Promise<StoryRecord[]> {
  const db = supabaseAnon(), since = new Date(Date.now() - STORY_WINDOW_DAYS * 864e5).toISOString();
  const s = await db.from("stories").select(COLS).contains("domains", [domain]).gte("happened_at", since).order("happened_at", { ascending: false }).limit(200);
  if (s.error) throw s.error;
  const rows = (s.data ?? []) as unknown as StoredStory[], ids = rows.map(r => r.id);
  if (!ids.length) return [];
  const [e, l, n] = await Promise.all([db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_lines").select("story_id,why_line,why_model,why_at").in("story_id", ids), db.from("story_numbers").select("story_id,number").in("story_id", ids)]);
  if (e.error) throw e.error; if (l.error) throw l.error; if (n.error) throw n.error;
  return withNumbers(overlay(withLines(rows, (l.data ?? []) as LineRow[]), (e.data ?? []) as unknown as EditRow[], Date.now()), (n.data ?? []) as NumberRow[]);
}
