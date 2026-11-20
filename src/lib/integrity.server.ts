// Measurement integrity I/O (integrity.ts is the rule). `computeChecks` reads live captures anonymously and judges every given change;
// `recordChecks` appends a verdict row only when it differs from the newest one (insert-only `change_checks`, service role); readers use
// `checkedEvents`, which fails closed: when verdicts can't be read, no live change reaches the tape.
import type { supabaseAnon } from "./mcp/supabase";
import { captureOf, checkEvent, splitChecked, type Capture, type Check, type Verdict } from "./integrity";

type Db = ReturnType<typeof supabaseAnon>;
type Ev = { id: number; domain: string; type: string; before?: unknown; after?: unknown; detected_at: string; page_type?: string | null; viewport?: string | null; source?: string | null; snapshot_id?: number | null; prev_snapshot_id?: number | null };
const SNAP = "id,domain,page_type,viewport,captured_at,rendered:signals->type->rendered,color:signals->color,layout:signals->layout,h1:signals->lexicon->h1,nav:signals->nav,prices:signals->prices,tech:signals->tech,ai_pricing:signals->ai_pricing";
type SnapRow = { id: number; domain: string; page_type: string; viewport: string; captured_at: string; rendered: unknown; color: unknown; layout: unknown; h1: unknown; nav: unknown; prices: unknown; tech: unknown; ai_pricing: unknown };
const AI = new Set(["imagery_shift", "aesthetic_shift"]);
const key = (d: string, p: string | null | undefined, v: string | null | undefined) => `${d}|${p ?? "home"}|${v ?? "desktop"}`;

/** Live captures per domain|page|viewport for these domains (signals read by JSON path; AI tags merged where asked). */
export async function liveCaptures(db: Db, domains: string[], tagDomains: ReadonlySet<string>, sectorOf: ReadonlyMap<string, string>): Promise<Map<string, Capture[]>> {
  const rows: SnapRow[] = [];
  for (let i = 0; i < domains.length; i += 25) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("library_snapshots").select(SNAP).eq("source", "live").in("domain", domains.slice(i, i + 25)).order("id").range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as SnapRow[]));
      if (!data || data.length < 1000) break;
    }
  }
  const wantTags = rows.filter(r => tagDomains.has(r.domain) && r.page_type === "home").map(r => r.id), tags = new Map<number, Record<string, unknown>>();
  for (let i = 0; i < wantTags.length; i += 200) {
    const { data, error } = await db.from("library_tags").select("snapshot_id,tags").in("snapshot_id", wantTags.slice(i, i + 200));
    if (error) throw error;
    for (const t of (data ?? []) as { snapshot_id: number; tags: unknown }[]) if (t.tags && typeof t.tags === "object") tags.set(t.snapshot_id, t.tags as Record<string, unknown>);
  }
  const out = new Map<string, Capture[]>();
  for (const r of rows) {
    const signals = { type: { rendered: r.rendered }, color: r.color, layout: r.layout, lexicon: { h1: r.h1 }, nav: r.nav, prices: r.prices, tech: r.tech, ai_pricing: r.ai_pricing } as Record<string, unknown>;
    const c = captureOf({ id: r.id, captured_at: r.captured_at, signals, tags: tags.get(r.id) ?? null }, { page_type: r.page_type, viewport: r.viewport, sector: sectorOf.get(r.domain) ?? "" });
    const k = key(r.domain, r.page_type, r.viewport); out.set(k, [...(out.get(k) ?? []), c]);
  }
  return out;
}
/** Verdicts for these live changes, judged against every stored live capture of their page and viewport. */
export async function computeChecks(db: Db, events: Ev[]): Promise<Map<number, Check>> {
  const live = events.filter(e => (e.source ?? "live") === "live");
  if (!live.length) return new Map();
  const { data: sites, error } = await db.from("library_sites").select("domain,sector").in("domain", [...new Set(live.map(e => e.domain))]);
  if (error) throw error;
  const sectorOf = new Map((sites ?? []).map(s => [s.domain, s.sector]));
  const caps = await liveCaptures(db, [...new Set(live.map(e => e.domain))], new Set(live.filter(e => AI.has(e.type)).map(e => e.domain)), sectorOf);
  return new Map(live.map(e => [e.id, checkEvent(e, caps.get(key(e.domain, e.page_type, e.viewport)) ?? [])]));
}
export type CheckRow = { event_id: number; verdict: Verdict; pass_fields: string[]; fields: unknown };
/** Newest verdict per change. */
export async function latestChecks(db: Db, ids: number[]): Promise<Map<number, Check>> {
  const out = new Map<number, Check>(), want = [...new Set(ids)];
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db.from("change_checks_latest").select("event_id,verdict,pass_fields,fields").in("event_id", want.slice(i, i + 200));
    if (error) throw error;
    for (const r of (data ?? []) as unknown as CheckRow[]) out.set(r.event_id, { verdict: r.verdict, pass: r.pass_fields ?? [], fields: (r.fields ?? {}) as Check["fields"] });
  }
  return out;
}
const same = (a: Check, b: Check) => a.verdict === b.verdict && JSON.stringify([...a.pass].sort()) === JSON.stringify([...b.pass].sort()) && JSON.stringify(a.fields) === JSON.stringify(b.fields);
/** Append a row for each change whose verdict differs from its newest stored one; returns how many were written. */
export async function recordChecks(admin: Db, checks: ReadonlyMap<number, Check>): Promise<number> {
  const have = await latestChecks(admin, [...checks.keys()]);
  const rows: CheckRow[] = [...checks].filter(([id, c]) => { const h = have.get(id); return !h || !same(h, c); }).map(([id, c]) => ({ event_id: id, verdict: c.verdict, pass_fields: c.pass, fields: c.fields }));
  for (let i = 0; i < rows.length; i += 200) { const { error } = await admin.from("change_checks").insert(rows.slice(i, i + 200) as never); if (error) throw new Error("change_checks_insert_failed"); }
  return rows.length;
}
/** The tape part and the Data view's unconfirmed list for changes read on a page. Fails closed (no live change) when verdicts can't be read. */
export async function checkedEvents<E extends { id: number; type: string; before?: unknown; after?: unknown; source?: string | null }>(db: Db, events: E[]) {
  try { return splitChecked(events, await latestChecks(db, events.map(e => e.id))); }
  catch { return { tape: events.filter(e => e.source && e.source !== "live"), unconfirmed: [] }; }
}
