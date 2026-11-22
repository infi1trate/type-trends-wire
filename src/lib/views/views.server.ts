// U1 + U2 · server side of the Data views, the receipt drawer and the row → story lookup. Anonymous SELECT-only reads (RLS applies); pure
// models do the shaping (receipts.ts, story-rows.ts, figure-tables.ts). No writes, no AI per view.
import { supabaseAnon } from "../mcp/supabase";
import { memo } from "../memo";
import { storyById, storyIndex } from "../stories/read.server";
import { sourceEventIds, tapeOf } from "../stories/page.server";
import { streamOf, storyPage } from "../stories/view";
import { rankScores, COMPONENT_LABEL, type ComponentId } from "../stories/score";
import { basis as basisOf } from "../labels";
import { parseReceipt, shareReceipt, changeReceipt, storyReceipt, censusReceipt, forecastReceipt, figureReceipt, type ReceiptModel, type ShareQuarter, type ChangeRow, type CaptureRow, type ForecastRowIn } from "./receipts";
import type { StoryIndexRow } from "./story-rows";
import { figureTables } from "./figure-tables";
import { fetchReaderRuns } from "../real-runs";

const EVENT_COLS = "id,domain,type,before,after,detected_at,effective_at,page_type,viewport,snapshot_id,prev_snapshot_id,summary,source,severity";
const chunks = <T,>(xs: T[], n = 200) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
/** When each change happened, from its integrity verdict (the last capture with the old value and the first with the new one, E2g):
 *  the same capture dates a story's own facts state. Unreadable or undated verdicts leave the change undated. */
async function seenByEvent(ids: number[]): Promise<Map<number, { before: string; after: string }>> {
  if (!ids.length) return new Map();
  const [{ latestChecks }, { seenOf }] = await Promise.all([import("../integrity.server"), import("../integrity")]);
  const checks = await latestChecks(supabaseAnon(), ids), out = new Map<number, { before: string; after: string }>();
  for (const [id, c] of checks) { const s = seenOf(c); if (s) out.set(id, s); }
  return out;
}
async function eventsByIds(ids: number[]): Promise<ChangeRow[]> {
  if (!ids.length) return [];
  const db = supabaseAnon(), out: ChangeRow[] = [];
  for (const c of chunks(ids)) { const { data, error } = await db.from("library_events").select(EVENT_COLS).in("id", c); if (error) throw error; out.push(...((data ?? []) as unknown as ChangeRow[])); }
  return out;
}

// ROW → STORY (Part 3) --------------------------------------------------------------------------------------------------------------
/** Published stories with their number, brands, main signal, source changes and the captures either side: one batched read, cached. */
export const loadStoryRows = memo(5 * 60_000, async (): Promise<StoryIndexRow[]> => {
  const pub = streamOf(await storyIndex()).filter(s => s.state === "published" && s.number != null);
  const evs = await eventsByIds([...new Set(pub.flatMap(s => sourceEventIds(s.source_ids)))]).catch(() => [] as ChangeRow[]);
  const caps = new Map(evs.map(e => [e.id, [e.snapshot_id, e.prev_snapshot_id].filter((x): x is number => x != null)]));
  return pub.map(s => { const events = sourceEventIds(s.source_ids); return { id: s.id, number: s.number!, happenedAt: s.happened_at, domains: s.domains, mainSignal: s.signal_keys[0] ?? null, events, captures: [...new Set(events.flatMap(e => caps.get(e) ?? []))] }; });
});

// STORY DATA VIEW -----------------------------------------------------------------------------------------------------------------
export type StoryData = Awaited<ReturnType<typeof loadStoryData>>;
export async function loadStoryData(id: string) {
  const s = await storyById(id); if (!s) return null;
  const db = supabaseAnon(), ids = sourceEventIds(s.source_ids);
  const [all, raw, tape, texts] = await Promise.all([
    storyIndex().catch(() => []),
    eventsByIds(ids).catch(() => [] as ChangeRow[]),
    ids.length ? tapeOf(ids).catch(() => []) : Promise.resolve([]),
    db.from("story_texts").select("version,headline,deck,body,how_we_know,model,created_at").eq("story_id", id).order("version").then(r => r.data ?? [], () => []),
  ]);
  const seen = await seenByEvent(ids).catch(() => new Map<number, { before: string; after: string }>());
  const pictures = await storyPictures(s).catch(() => null);
  const stream = streamOf(all), rank = rankScores(stream), day = s.happened_at.slice(0, 10);
  const sameDay = stream.filter(x => x.happened_at.slice(0, 10) === day).sort((a, b) => (rank.get(b.id) ?? b.score) - (rank.get(a.id) ?? a.score) || b.happened_at.localeCompare(a.happened_at) || a.id.localeCompare(b.id));
  const pos = sameDay.findIndex(x => x.id === id);
  const comps = (s.components && typeof s.components === "object" ? s.components : {}) as Record<string, { value?: number; why?: string }>;
  const page = storyPage(s, { earlier: [], patterns: [] });
  const line = new Map(tape.map(t => [t.id, t]));
  return {
    id: s.id, number: page.number, headline: page.headline, kicker: page.kicker, deck: page.deck, type: s.type, basis: s.basis, state: s.state, status: s.status,
    score: s.score, rankScore: rank.get(s.id) ?? null, dayRank: pos >= 0 ? { pos: pos + 1, of: sameDay.length, day } : null,
    components: (Object.keys(COMPONENT_LABEL) as ComponentId[]).map(k => ({ id: k, label: COMPONENT_LABEL[k], value: typeof comps[k]?.value === "number" ? comps[k]!.value! : null, why: comps[k]?.why ?? "" })),
    reason: s.reason, whyRan: s.why_ran, heldReason: page.heldReason, killReason: s.killReason, correctedAt: s.correctedAt, pinnedUntil: s.pinnedUntil,
    happenedAt: s.happened_at, createdAt: s.created_at, sector: s.sector, domains: s.domains, signals: s.signal_keys, sourceIds: s.source_ids,
    facts: (Array.isArray(s.facts) ? s.facts : []) as { text: string; href?: string; basis?: string; kind?: string }[],
    evidence: (Array.isArray(s.evidence) ? s.evidence : []) as { label: string; href: string }[],
    changes: raw.sort((a, b) => String(a.detected_at).localeCompare(String(b.detected_at)) || a.id - b.id).map(e => ({ ...e, line: line.get(e.id)?.text ?? e.summary ?? "", confirmed: line.get(e.id)?.confirmed ?? false, seen: seen.get(e.id) ?? null })),
    texts: (texts as { version: number; headline: string; deck: string; body: string[]; how_we_know: string; model: string; created_at: string }[]).map(t => ({ ...t, shown: s.written?.version === t.version })),
    template: s.template ?? { headline: s.stored.headline, deck: s.stored.deck },
    edits: s.edits.map(e => ({ action: e.action, at: e.at, note: e.note })),
    pictures,
  };
}
/** I3 · the lead picture the Read view shows, as rows: which rule chose it and each picture's brand, section, capture and stored object. */
async function storyPictures(s: NonNullable<Awaited<ReturnType<typeof storyById>>>) {
  const [{ evidenceOf, colourEventsOf, leadOf }, { pictureRows, LEAD_RULES }, { isKind, storyPage: sp }] = await Promise.all([import("../stories/page.server"), import("../lead-picture"), import("../stories/view")]);
  const type = isKind(s.type) ? s.type : "news", page = sp(s, { earlier: [], patterns: [] });
  const [crops, colourEvents] = await Promise.all([evidenceOf(s, type), colourEventsOf(s).catch(() => [])]);
  const plan = await leadOf(s, crops, { colourEvents, census: page.census?.lines ?? null, names: new Map(page.brands.map(b => [b.domain, b.name])) });
  return { kind: plan.kind, rule: LEAD_RULES[plan.rule], caption: plan.caption, chosen: plan.chosen ?? null, rows: pictureRows(plan).map((r, i) => ({ ...r, src: plan.items[i]!.src })) };
}

// RECEIPTS (U2) -------------------------------------------------------------------------------------------------------------------
const FC_COLS = "stage,momentum,next_wave_score,current_share,status,model,computed_at,run_id,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi,backtest,evidence";
async function forecastRow(key: string) {
  const i = key.indexOf(":"); if (i < 1) return null;
  const db = supabaseAnon(), run = (await fetchReaderRuns(db as never)).latest?.id ?? -1;
  const { data, error } = await db.from("forecasts").select(FC_COLS).eq("run_id", run).eq("dimension", key.slice(0, i)).eq("value", key.slice(i + 1)).eq("scope", "all").maybeSingle();
  if (error) throw error;
  return data as (ForecastRowIn & { evidence: unknown }) | null;
}
export async function loadReceipt(raw: string): Promise<ReceiptModel | null> {
  const r = parseReceipt(raw); if (!r) return null;
  switch (r.type) {
    case "share": case "forecast": {
      const f = await forecastRow(r.id); if (!f) return null;
      if (r.type === "forecast") return forecastReceipt(r.id, f);
      const quarters = ((f.evidence as { quarters?: ShareQuarter[] } | null)?.quarters ?? []);
      return shareReceipt(r.id, basisOf(r.id), quarters);
    }
    case "change": {
      const [e] = await eventsByIds([Number(r.id)]); if (!e) return null;
      const snaps = [e.snapshot_id, e.prev_snapshot_id].filter((x): x is number => x != null);
      const { data } = snaps.length ? await supabaseAnon().from("library_snapshots").select("id,captured_at,source").in("id", snaps) : { data: [] };
      return changeReceipt(e, (data ?? []) as CaptureRow[]);
    }
    case "story": case "census": {
      const s = await storyById(r.id); if (!s || (s.state !== "published" && s.state !== "killed")) return null;
      const { storyNumbers, colourEventsOf } = await import("../stories/page.server");
      const [numbers, colourEvents] = await Promise.all([storyNumbers(s), colourEventsOf(s).catch(() => [])]);
      const page = storyPage(s, { earlier: [], patterns: [], numbers, colourEvents });
      if (page.census) return censusReceipt({ id: s.id, number: page.number, headline: page.headline }, page.census.lines.map(l => (l.line.includes(l.name) ? l.line : `${l.name}: ${l.line}`)), page.facts.map(f => f.text));
      const ids = sourceEventIds(s.source_ids), tape = ids.length ? await tapeOf(ids).catch(() => []) : [];
      const [evs, seen] = await Promise.all([eventsByIds(ids).catch(() => [] as ChangeRow[]), seenByEvent(ids).catch(() => new Map<number, { before: string; after: string }>())]);
      const at = new Map(evs.map(e => [e.id, e.detected_at]));
      return storyReceipt({ id: s.id, number: page.number, headline: page.headline, kicker: page.kicker }, tape.map(t => ({ id: t.id, text: t.text, at: at.get(t.id) ?? null, confirmed: t.confirmed, seen: seen.get(t.id) ?? null })), page.facts.map(f => ({ text: f.text, basis: f.basis ?? null })));
    }
    case "figure": {
      const [slug, fig] = r.id.split(":") as [string, string];
      const { loadDataStory } = await import("../data-stories/page.server");
      const d = await loadDataStory(slug), p = d.kind === "live" ? d.story : null, f = p?.figures[fig];
      if (!p || !f) return null;
      return figureReceipt({ slug, number: p.number, headline: p.text.headline }, fig, figureTables(f));
    }
  }
}

// STUDY DATA VIEW -----------------------------------------------------------------------------------------------------------------
export async function loadStudyData(slug: string) {
  const [{ entryOf }, { CHECKS, waitOf }, { dataInput }] = await Promise.all([import("../data-stories/registry"), import("../data-stories/checks"), import("../data-stories/data.server")]);
  const e = entryOf(slug); if (!e) return null;
  const i = await dataInput().catch(() => null);
  const check = e.check && i ? { id: e.check, ...CHECKS[e.check](i), wait: waitOf(e.check, i), recorded: e.recorded } : e.check ? { id: e.check, pass: null, figures: [], reason: "The check's data did not load.", wait: null, recorded: e.recorded } : null;
  const { data } = await supabaseAnon().from("study_texts").select("facts_hash,headline,deck,model,checked_at,created_at").match({ slug }).order("created_at", { ascending: false }).limit(20);
  return { slug, status: e.status, reason: e.reason, check, versions: (data ?? []) as { facts_hash: string; headline: string; deck: string; model: string; checked_at: string | null; created_at: string }[] };
}

// WEEK DATA VIEW ------------------------------------------------------------------------------------------------------------------
export async function loadWeekData(week: string) {
  const { data, error } = await supabaseAnon().from("weekly_briefs").select("week,brief,model,created_at").eq("week", week).maybeSingle();
  if (error) throw error;
  return data ? { week: data.week, brief: data.brief as unknown as import("../data").BriefDoc, model: data.model ?? null, at: data.created_at ?? null } : null;
}
