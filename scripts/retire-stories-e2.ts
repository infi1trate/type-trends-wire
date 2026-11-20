// Phase E2a pass of scripts/retire-stories.ts (run with --e2): the editor's call applied to the last 14 days of published stories.
// Append-only and idempotent: writes only `kill` and `correct` rows to story_edits, skips stories already killed, and corrects a story only
// while it still lacks a specific its brand story carries.
import { applyEdits, type EditRow, type StoredStory } from "../src/lib/stories/edits";
import { allCandidates, type BuildInput } from "../src/lib/stories/candidates";
import { E2_RETIRE, E2_WINDOW_DAYS, e2Plan, type E2Reason } from "../src/lib/stories/retire";
import { notApplicable, SHIFT_MIN_SHARE } from "../src/lib/stories/editor";
import { brandName } from "../src/lib/brand-names";

type Db = (typeof import("../src/integrations/supabase/client.server"))["supabaseAdmin"];
type Load = (o: { days: number; allRuns: boolean; realRunIds: number[] }) => Promise<BuildInput>;
export async function runE2(db: Db, loadInput: Load, o: { dry: boolean; list: boolean }) {
  const all = async <T,>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => { const out: T[] = []; for (let from = 0; ; from += 500) { const { data, error } = await f(from, from + 499); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 500) return out; } };
  const COLS = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
  const now = Date.now(), since = new Date(now - E2_WINDOW_DAYS * 864e5).toISOString();
  const [stories, edits, input] = await Promise.all([
    all<StoredStory>((f, t) => db.from("stories").select(COLS).gte("happened_at", since).order("id").range(f, t) as never),
    all<EditRow>((f, t) => db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never),
    loadInput({ days: E2_WINDOW_DAYS + 14, allRuns: false, realRunIds: [] }),
  ]);
  const by = new Map<string, EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  const shown = stories.map(s => applyEdits(s, by.get(s.id) ?? [], now)).filter(s => s.state === "published");
  const { candidates } = allCandidates(input);
  const latest = input.runs.at(-1)?.rows ?? [];
  const plan = e2Plan(shown, {
    candidates, shiftMinShare: SHIFT_MIN_SHARE, notApplicable,
    shareOf: key => { const r = latest.find(x => x.scope === "all" && `${x.dimension}:${x.value}` === key); return r?.current_share ?? null; },
  });
  const kills = plan.kills.map(k => ({ story_id: k.id, action: "kill" as const, payload: { reason: E2_RETIRE[k.reason] }, note: E2_RETIRE[k.reason] }));
  const corrects = plan.corrects.map(c => ({ story_id: c.id, action: "correct" as const, payload: c.payload, note: c.note }));
  if (!o.dry) {
    for (let i = 0; i < kills.length; i += 200) { const { error } = await db.from("story_edits").insert(kills.slice(i, i + 200) as never); if (error) throw new Error(`kill insert failed: ${error.message}`); }
    for (let i = 0; i < corrects.length; i += 200) { const { error } = await db.from("story_edits").insert(corrects.slice(i, i + 200) as never); if (error) throw new Error(`correct insert failed: ${error.message}`); }
  }
  const tally: Record<string, number> = {}; for (const k of plan.kills) tally[E2_RETIRE[k.reason as E2Reason]] = (tally[E2_RETIRE[k.reason as E2Reason]] ?? 0) + 1;
  const killed = new Set(plan.kills.map(k => k.id)), week = new Date(now - 7 * 864e5).toISOString();
  const remain = shown.filter(s => !killed.has(s.id) && s.happened_at >= week).sort((a, b) => a.happened_at.localeCompare(b.happened_at));
  console.log(JSON.stringify({ dry: o.dry, window_days: E2_WINDOW_DAYS, checked: shown.length, killed: kills.length, by_reason: tally, folded_corrections: corrects.length, remain_last_7_days: remain.length }, null, 1));
  if (o.list) {
    for (const k of plan.kills) { const s = shown.find(x => x.id === k.id)!; console.log("KILL", s.happened_at.slice(0, 10), s.type.padEnd(11), "|", s.headline.slice(0, 90), "|", E2_RETIRE[k.reason]); }
    for (const c of plan.corrects) console.log("FOLD", c.id, "|", c.note);
    for (const s of remain) console.log("KEEP", s.happened_at.slice(0, 10), s.type.padEnd(11), "|", s.headline.slice(0, 110), s.domains.length === 1 ? `(${brandName(s.domains[0]!)})` : "");
  }
}
