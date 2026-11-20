// One-off maintenance (Phase 14b): retire stored stories the current rules would not produce, and reword stored stories whose wording the
// templates have since fixed. Append-only and idempotent: writes only `kill` and `correct` rows to story_edits, never touches a story row,
// skips stories that already have a kill, and only corrects when the shown text still differs from the current template.
// Phase E0 adds a pass over the last 30 days with the "stop the noise" rules (retire.ts e0Verdict): kills with a plain reason, and
// a correct that re-labels a rebrand that no longer qualifies as a move. That pass runs first; its stories skip the older pass.
// Phase E0b adds sale wording on either capture (promo.ts seasonalChange) and changes reversed within seven days (reversal.ts),
// read from every live event since seven days before the window.
// Usage: bun scripts/retire-stories.ts          (writes)
//        bun scripts/retire-stories.ts --dry    (prints what it would do)
import { applyEdits, type EditRow, type StoredStory } from "../src/lib/stories/edits";
import { archiveDepth, moveCandidate, rebrandDeck } from "../src/lib/stories/candidates";
import { E0_CORRECT_NOTE, E0_RETIRE, E0_WINDOW_DAYS, e0Verdict, retireReason, reword, type E0Reason } from "../src/lib/stories/retire";
import { newsMatcher, newsVerdict } from "../src/lib/stories/candidates";
import { seasonalChange } from "../src/lib/promo";
import type { EventRow } from "../src/lib/agency/changes";
import { fetchRealRuns } from "../src/lib/real-runs";
import { REVERSAL_DAYS, reversalIds, type ReversalEvent } from "../src/lib/reversal";

const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { loadInput } = await import("../src/lib/stories/build.server");
async function all<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 500) { const { data, error } = await f(from, from + 499); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 500) return out; }
}
const COLS = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const [stories, edits, real, input] = await Promise.all([
  all<StoredStory>((f, t) => db.from("stories").select(COLS).order("id").range(f, t) as never),
  all<EditRow>((f, t) => db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never),
  fetchRealRuns(db, { limit: 60 }),
  loadInput({ days: 120, allRuns: false, realRunIds: [] }),
]);
const runAt = new Map(real.map(r => [r.id, r.at])), depth = archiveDepth(input.archive);
const events = new Map(input.events.map(e => [e.id, e]));
const rebrands = new Map(input.rebrands.map(r => [`${r.domain}|${r.confirmed_at}`, r]));
const killedAlready = new Set(edits.filter(e => e.action === "kill").map(e => e.story_id));
const now = Date.now(), byStory = new Map<string, EditRow[]>();
for (const e of edits) byStory.set(e.story_id, [...(byStory.get(e.story_id) ?? []), e]);

const kills: { story_id: string; action: "kill"; payload: { reason: string }; note: string }[] = [];
const corrects: { story_id: string; action: "correct"; payload: Record<string, unknown>; note: string }[] = [];
const tally = new Map<string, number>(), retiredIds = new Set<string>();

// PHASE E0 -----------------------------------------------------------------------------------------
const since = new Date(now - E0_WINDOW_DAYS * 864e5).toISOString();
const shownNow = new Map(stories.map(s => [s.id, applyEdits(s, byStory.get(s.id) ?? [], now)]));
const recent = stories.filter(s => s.happened_at >= since && !killedAlready.has(s.id) && shownNow.get(s.id)!.state === "published");
const evIds = [...new Set(recent.flatMap(s => [s.id, ...s.source_ids]).map(x => /^(?:story:)?(?:move:|event:)(\d+)$/.exec(x)?.[1]).filter(Boolean).map(Number))];
const wireIds = [...new Set(recent.flatMap(s => s.source_ids).map(x => /^wire:(\d+)$/.exec(x)?.[1]).filter(Boolean).map(Number))];
const chunked = async <T,>(xs: number[], f: (c: number[]) => PromiseLike<{ data: T[] | null; error: unknown }>) => { const out: T[] = []; for (let i = 0; i < xs.length; i += 200) { const { data, error } = await f(xs.slice(i, i + 200)); if (error) throw error; out.push(...(data ?? [])); } return out; };
const [evRows, siteRows, wireRows, { latestSignals }, { snapshotTexts }, { decodeEntities }] = await Promise.all([
  chunked<Omit<EventRow, "sector">>(evIds, c => db.from("library_events").select("id,domain,type,before,after,detected_at,source,page_type,viewport,summary,snapshot_id,prev_snapshot_id").in("id", c) as never),
  all<{ domain: string; name: string | null; sector: string; active: boolean }>((f, t) => db.from("library_sites").select("domain,name,sector,active").order("domain").range(f, t) as never),
  chunked<{ id: number; title: string; url: string; source: string; source_kind: string; published_at: string; excerpt: string | null }>(wireIds, c => db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").in("id", c) as never),
  import("../src/lib/signals.server"), import("../src/lib/promo.server"), import("../src/lib/entities"),
]);
const timeline = await all<ReversalEvent>((f, t) => db.from("library_events").select("id,domain,page_type,viewport,detected_at,before,after").eq("source", "live").gte("detected_at", new Date(Date.parse(since) - REVERSAL_DAYS * 864e5).toISOString()).order("id").range(f, t) as never);
const reversed = reversalIds(timeline);
const sectorOf = new Map(siteRows.map(x => [x.domain, x.sector]));
const evById = new Map(evRows.map(e => [e.id, { ...e, sector: sectorOf.get(e.domain) ?? null } as EventRow]));
const texts = await snapshotTexts(db as never, evRows.flatMap(e => [(e as { snapshot_id?: number | null }).snapshot_id, (e as { prev_snapshot_id?: number | null }).prev_snapshot_id]));
const { signals } = await latestSignals("all");
const matcher = newsMatcher(siteRows.filter(x => x.active), signals.filter(x => x.tier === "headline").map(x => x.key));
const wireById = new Map(wireRows.map(w => [w.id, { ...w, title: decodeEntities(w.title), excerpt: w.excerpt ? decodeEntities(w.excerpt) : null }]));
const e0Tally: Record<E0Reason, number> = { rebrand: 0, seasonal: 0, news: 0, bluesky: 0, estimate: 0, counter: 0, reversed: 0 };
let e0Corrected = 0;
const e0Done = new Set<string>();
for (const s of recent) {
  const shown = shownNow.get(s.id)!;
  const v = e0Verdict({ ...s, kicker: shown.kicker, headline: shown.headline, deck: shown.deck, facts: shown.facts, type: shown.type }, {
    event: id => evById.get(id) ?? null,
    seasonal: id => { const e = evById.get(id) as (EventRow & { snapshot_id?: number | null; prev_snapshot_id?: number | null }) | undefined; return !!e && seasonalChange(texts.get(e.snapshot_id ?? -1), texts.get(e.prev_snapshot_id ?? -1)); },
    rebrand: (domain, at) => rebrands.get(`${domain}|${at}`) ?? null,
    news: id => { const w = wireById.get(id); return w ? newsVerdict(matcher, w).drop : "unknown"; },
    reversed: id => reversed.has(id),
  });
  if (!v) continue;
  e0Done.add(s.id);
  if ("kill" in v) { const why = E0_RETIRE[v.kill]; kills.push({ story_id: s.id, action: "kill", payload: { reason: why }, note: why }); retiredIds.add(s.id); e0Tally[v.kill]++; }
  else { corrects.push({ story_id: s.id, action: "correct", payload: { type: v.correct.type, kicker: v.correct.kicker, headline: v.correct.headline, ...(v.correct.deck != null ? { deck: v.correct.deck } : {}), facts: v.correct.facts }, note: E0_CORRECT_NOTE }); e0Corrected++; }
}
for (const s of stories) {
  if (killedAlready.has(s.id) || e0Done.has(s.id)) continue;
  const why = retireReason(s, { runAt: id => runAt.get(id) ?? null, depth });
  if (why) { kills.push({ story_id: s.id, action: "kill", payload: { reason: why }, note: why }); retiredIds.add(s.id); const k = `${s.type} · ${why.replace(/ \(.*\)\.?$/, "").replace(/ for [a-z &-]+ is/, " for <sector> is")}`; tally.set(k, (tally.get(k) ?? 0) + 1); }
}
const NOTE = "Reworded to the current template (wording only; the numbers and sources are unchanged).";
const correctedByType = new Map<string, number>();
for (const s of stories) {
  if (killedAlready.has(s.id) || retiredIds.has(s.id) || e0Done.has(s.id)) continue;
  const shown = applyEdits(s, byStory.get(s.id) ?? [], now);
  if (shown.state === "killed") continue;
  // A story an E0 correct re-labelled (a rebrand now told as a move) keeps that wording; the older template pass leaves it alone.
  if (shown.type !== s.type) continue;
  const w = reword({ ...s, headline: shown.headline, deck: shown.deck, facts: shown.facts }, {
    move: id => { const e = events.get(id); return e ? moveCandidate(e) : null; },
    rebrandDeck: (domain, at) => { const r = rebrands.get(`${domain}|${at}`); return r ? rebrandDeck(r) : null; },
  });
  if (!w) continue;
  const payload: Record<string, unknown> = { facts: w.facts };
  if (w.headline !== shown.headline) payload["headline"] = w.headline;
  if (w.deck !== shown.deck && w.deck != null) payload["deck"] = w.deck;
  corrects.push({ story_id: s.id, action: "correct", payload, note: NOTE });
  correctedByType.set(s.type, (correctedByType.get(s.type) ?? 0) + 1);
}
if (!dry) {
  for (let i = 0; i < kills.length; i += 200) { const { error } = await db.from("story_edits").insert(kills.slice(i, i + 200) as never); if (error) throw new Error(`kill insert failed: ${error.message}`); }
  for (let i = 0; i < corrects.length; i += 200) { const { error } = await db.from("story_edits").insert(corrects.slice(i, i + 200) as never); if (error) throw new Error(`correct insert failed: ${error.message}`); }
}
const byType = (rows: { story_id: string }[]) => { const m: Record<string, number> = {}; for (const r of rows) { const t = stories.find(s => s.id === r.story_id)!.type; m[t] = (m[t] ?? 0) + 1; } return m; };
console.log(JSON.stringify({ dry, e0: { window_days: E0_WINDOW_DAYS, checked: recent.length, timeline_events: timeline.length, reversed_events: reversed.size, killed: Object.fromEntries(Object.entries(e0Tally).map(([k, n]) => [E0_RETIRE[k as E0Reason], n])), corrected_as_move: e0Corrected }, stories: stories.length, already_killed: killedAlready.size, real_runs: real.map(r => `${r.id}@${r.at.slice(0, 16)}`), retired: kills.length, retired_by_type: byType(kills), retired_by_reason: [...tally].sort((a, b) => b[1] - a[1]), retired_published: kills.filter(k => stories.find(s => s.id === k.story_id)!.status === "published").length, corrected: corrects.length, corrected_by_type: Object.fromEntries(correctedByType) }, null, 1));
if (process.argv.includes("--list")) { for (const k of kills) console.log("KILL", k.story_id, "|", k.note); for (const c of corrects) console.log("CORRECT", c.story_id, "|", JSON.stringify(c.payload).slice(0, 300)); }
