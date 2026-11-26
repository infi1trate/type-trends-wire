// Y1 · the evidence desk's weekly pass (service role; in the weekly forecast's page-structure follow-up, never a request or the wire
// job): for each signal that really moved, load stored rows (signal quarters from the reader run, outlet wire items, brands showing
// the trait, indicator weeks for its topic), build the dossier by rule, store it and file the desk's one-line note through the door.
import { pagedRows } from "../paged";
import { buildDossier, DRAWERS, type BrandIn, type IndicatorIn, type WireIn } from "./dossier";
import type { Quarter } from "./timing";

export const MOVED_STAGES = ["Rising", "Fading", "Emerging"];
export async function buildDossiers(o: { budgetMs?: number; only?: string[]; fileNote?: boolean } = {}) {
  const start = Date.now(), budget = o.budgetMs ?? 25_000;
  const [{ supabaseAdmin: db }, { latestSignals }, { readerRunId }, { SIGNAL_TOPIC }] = await Promise.all([
    import("@/integrations/supabase/client.server"), import("../signals.server"), import("../real-runs"), import("../indicators/topics")]);
  const [{ snap, signals }, run] = await Promise.all([latestSignals("all"), readerRunId(db)]);
  const recent = await db.from("stories").select("signal_keys").eq("status", "published").gte("happened_at", new Date(start - 30 * 864e5).toISOString()).limit(500);
  const storyKeys = new Set((recent.data ?? []).flatMap(r => r.signal_keys ?? []));
  const wanted: { key: string; name: string }[] = signals.filter(s => o.only ? o.only.includes(s.key) : (s.tier === "headline" && s.stage != null && MOVED_STAGES.includes(s.stage)) || storyKeys.has(s.key));
  // Maintenance must also rebuild dossiers whose signals are no longer in the current headline set.
  if (o.only) {
    const stored = await pagedRows((f, t) => db.from("evidence_dossiers").select("signal,name").order("signal").range(f, t));
    if (stored.error) throw new Error("Cannot read stored dossiers");
    for (const d of stored.data) if (o.only.includes(d.signal) && !wanted.some(s => s.key === d.signal)) wanted.push({ key: d.signal, name: d.name });
  }
  const wireQ = await db.from("wire_items").select("id,title,excerpt,url,source,source_kind,published_at").in("source_kind", ["rss", "hn", "producthunt"]).order("published_at", { ascending: false }).limit(5000);
  const sites = await pagedRows((f, t) => db.from("library_sites").select("domain,name,active").order("domain").range(f, t));
  const wire = (wireQ.data ?? []) as WireIn[], names = new Map((sites.data ?? []).map(s => [s.domain, s.name ?? s.domain]));
  const out = { built: 0, entries: Object.fromEntries(DRAWERS.map(d => [d, 0])) as Record<string, number>, model: 0, errors: [] as string[], signals: [] as string[] };
  for (const s of wanted) {
    if (Date.now() - start > budget) break;
    const [dimension, ...rest] = s.key.split(":"), value = rest.join(":");
    if (!dimension) { out.errors.push(`${s.key}: missing dimension`); continue; }
    const f = await db.from("forecasts").select("quarters:evidence->quarters").eq("run_id", run).eq("scope", "all").eq("dimension", dimension).eq("value", value).maybeSingle();
    if (f.error) { out.errors.push(`${s.key}: forecast read failed`); continue; }
    // Stored forecast evidence carries n and c from the very run the reader charts use.
    const quarters = (Array.isArray(f.data?.quarters) ? f.data.quarters : []) as Quarter[];
    const row = snap.rows.find(r => `${r.dimension}:${r.value}` === s.key && r.scope === "all");
    const brands: BrandIn[] = (row?.present ?? []).map(d => ({ domain: d, name: names.get(d) ?? d }));
    const topic = SIGNAL_TOPIC[s.key];
    const ind = topic ? await db.from("outside_series").select("key,label,period_end,value,source").eq("topic", topic).eq("metric", "downloads_week").order("period_end").limit(2000) : { data: [] };
    const d = buildDossier({ signal: s.key, name: s.name, quarters, wire, brands, indicators: (ind.data ?? []) as IndicatorIn[] });
    const counts = Object.fromEntries(DRAWERS.map(x => [x, d.entries.filter(e => e.drawer === x).length]));
    const w = await db.from("evidence_dossiers").upsert({ signal: s.key, name: s.name, rise_start: d.riseStart, rise_end: d.riseEnd, entries: d.entries as never, counts: counts as never, built_at: new Date().toISOString() });
    if (w.error) { out.errors.push(`${s.key}: ${w.error.message.slice(0, 60)}`); continue; }
    out.built++; out.signals.push(s.key); for (const x of DRAWERS) out.entries[x]! += counts[x]!; out.model += d.entries.filter(e => e.match === "model").length;
  }
  if (o.fileNote !== false && out.built) {
    const { deskDoor } = await import("../stories/desk.server");
    await deskDoor("evidence", { action: "dossier", signal: "all", entries: Object.values(out.entries).reduce((a, b) => a + b, 0), note: `${out.built} dossiers rebuilt: ${DRAWERS.map(x => `${out.entries[x]} ${x}`).join(", ")}; ${out.model} proposed by a model.` }).catch(() => null);
  }
  return out;
}
