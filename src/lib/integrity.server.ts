// Measurement integrity I/O (integrity.ts is the rule). `computeChecks` reads live captures anonymously and judges every given change;
// `recordChecks` appends a verdict row only when it differs from the newest one (insert-only `change_checks`, service role); readers use
// `checkedEvents`, which fails closed: when verdicts can't be read, no live change reaches the latest changes.
import type { supabaseAnon } from "./mcp/supabase";
import { applyMarks, captureOf, checkEvent, splitChecked, type Capture, type Check, type StoredVerdict } from "./integrity";
import type { Mark } from "./reread";
import { stableJson } from "./stable-json";

type Db = ReturnType<typeof supabaseAnon>;
type Ev = { id: number; domain: string; type: string; before?: unknown; after?: unknown; detected_at: string; page_type?: string | null; viewport?: string | null; source?: string | null; snapshot_id?: number | null; prev_snapshot_id?: number | null };
// The checked fields come from `library_snapshot_fields.check_fields` (one detoast of `signals` per capture, built in the database),
// fetched by id without a sort: selecting eight JSON paths and ordering by id read each capture's signals eight times and sorted
// ~2 MB on disk (371 ms per call); ids are listed first (index only), fields fetched by id, and rows ordered by id here.
const SNAP = "id,domain,page_type,viewport,captured_at,check_fields";
type Fields = { rendered: unknown; color: unknown; layout: unknown; h1: unknown; nav: unknown; prices: unknown; tech: unknown; ai_pricing: unknown };
type SnapRow = { id: number; domain: string; page_type: string; viewport: string; captured_at: string; check_fields: Partial<Fields> | null };
const AI = new Set(["imagery_shift", "aesthetic_shift"]);
const key = (d: string, p: string | null | undefined, v: string | null | undefined) => `${d}|${p ?? "home"}|${v ?? "desktop"}`;

/** Live captures per domain|page|viewport for these domains (signals read by JSON path; AI tags merged where asked). */
export async function liveCaptures(db: Db, domains: string[], tagDomains: ReadonlySet<string>, sectorOf: ReadonlyMap<string, string>): Promise<Map<string, Capture[]>> {
  const ids: number[] = [];
  for (let i = 0; i < domains.length; i += 25) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("library_snapshots").select("id").eq("source", "live").in("domain", domains.slice(i, i + 25)).order("id").range(from, from + 999);
      if (error) throw error;
      ids.push(...((data ?? []) as { id: number }[]).map(r => r.id));
      if (!data || data.length < 1000) break;
    }
  }
  const rows: SnapRow[] = [], chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100));
  for (let i = 0; i < chunks.length; i += 6) // at most six requests at once
    for (const { data, error } of await Promise.all(chunks.slice(i, i + 6).map(c => db.from("library_snapshot_fields").select(SNAP).in("id", c)))) {
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as SnapRow[]));
    }
  rows.sort((a, b) => a.id - b.id);
  const wantTags = rows.filter(r => tagDomains.has(r.domain) && r.page_type === "home").map(r => r.id), tags = new Map<number, Record<string, unknown>>();
  for (let i = 0; i < wantTags.length; i += 200) {
    const { data, error } = await db.from("library_tags").select("snapshot_id,tags").in("snapshot_id", wantTags.slice(i, i + 200));
    if (error) throw error;
    for (const t of (data ?? []) as { snapshot_id: number; tags: unknown }[]) if (t.tags && typeof t.tags === "object") tags.set(t.snapshot_id, t.tags as Record<string, unknown>);
  }
  const out = new Map<string, Capture[]>();
  for (const r of rows) {
    const f = r.check_fields ?? {};
    const signals = { type: { rendered: f.rendered ?? null }, color: f.color ?? null, layout: f.layout ?? null, lexicon: { h1: f.h1 ?? null }, nav: f.nav ?? null, prices: f.prices ?? null, tech: f.tech ?? null, ai_pricing: f.ai_pricing ?? null } as Record<string, unknown>;
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
export type CheckRow = { event_id: number; verdict: StoredVerdict; pass_fields: string[]; fields: unknown };
type MarkRow = { event_id: number; field: string; kind: Mark["kind"]; reason: string };
/** I3 · stored marks per change (library_event_marks). */
export async function storedMarks(db: Db, ids: number[]): Promise<Map<number, Record<string, Mark>>> {
  const out = new Map<number, Record<string, Mark>>(), want = [...new Set(ids)];
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db.from("library_event_marks").select("event_id,field,kind,reason").in("event_id", want.slice(i, i + 200));
    if (error) throw error;
    for (const r of (data ?? []) as MarkRow[]) out.set(r.event_id, { ...(out.get(r.event_id) ?? {}), [r.field]: { kind: r.kind, reason: r.reason } });
  }
  return out;
}
async function latestBase(db: Db, ids: number[]): Promise<Map<number, Check>> {
  const out = new Map<number, Check>(), want = [...new Set(ids)];
  for (let i = 0; i < want.length; i += 200) {
    // D1b · one index probe per change (change_checks_latest_for): the DISTINCT ON view read every older copy of each check (77k rows
    // for 200 changes, 2–3.3 s), so the anonymous reader's three-second limit cut the rebrands list and it was never stored.
    const { data, error } = await db.rpc("change_checks_latest_for", { _ids: want.slice(i, i + 200) });
    if (error) throw error;
    for (const r of (data ?? []) as unknown as CheckRow[]) out.set(r.event_id, { verdict: r.verdict, pass: r.pass_fields ?? [], fields: (r.fields ?? {}) as Check["fields"] });
  }
  return out;
}
/** Newest verdict per change, with its I3 marks applied (a re-read or failed measurement is never a change). */
export async function latestChecks(db: Db, ids: number[]): Promise<Map<number, Check>> {
  const [base, marks] = await Promise.all([latestBase(db, ids), storedMarks(db, ids)]);
  return new Map([...base].map(([id, c]) => [id, applyMarks(c, marks.get(id) ?? {})]));
}
const baseOf = (c: Check): Check => c.base ?? c;
// D1 Part 3 · compared key-order-free: the stored fields come back from the database with their keys reordered, so the plain text
// compare read every verdict as changed and each story build appended ~479 identical rows (99% of change_checks by 23 Nov).
export const sameCheck = (a: Check, b: Check) => a.verdict === b.verdict && stableJson([...a.pass].sort()) === stableJson([...b.pass].sort()) && stableJson(a.fields) === stableJson(b.fields);
const same = sameCheck;
/** Append a row for each change whose unmarked verdict differs from its newest stored one, and each new mark (insert-only, never
 *  replaced); returns how many verdict rows were written. */
export async function recordChecks(admin: Db, checks: ReadonlyMap<number, Check>): Promise<number> {
  const [have, marked] = await Promise.all([latestBase(admin, [...checks.keys()]), storedMarks(admin, [...checks.keys()])]);
  const rows: CheckRow[] = [...checks].map(([id, c]) => [id, baseOf(c)] as const).filter(([id, c]) => { const h = have.get(id); return !h || !same(h, c); })
    .map(([id, c]) => ({ event_id: id, verdict: c.verdict as StoredVerdict, pass_fields: c.pass, fields: c.fields }));
  for (let i = 0; i < rows.length; i += 200) { const { error } = await admin.from("change_checks").insert(rows.slice(i, i + 200) as never); if (error) throw new Error("change_checks_insert_failed"); }
  const marks: MarkRow[] = [...checks].flatMap(([id, c]) => Object.entries(c.marks ?? {}).filter(([f]) => !marked.get(id)?.[f]).map(([field, m]) => ({ event_id: id, field, kind: m.kind, reason: m.reason })));
  for (let i = 0; i < marks.length; i += 200) { const { error } = await admin.from("library_event_marks").upsert(marks.slice(i, i + 200) as never, { onConflict: "event_id,field", ignoreDuplicates: true }); if (error) throw new Error("event_marks_insert_failed"); }
  return rows.length;
}
/** Latest changes part and the Data view's unconfirmed list for changes read on a page. Fails closed (no live change) when verdicts can't be read;
 *  P2c: `failed` then says so, so a caller that keeps or stores what it builds (a count, a record) can refuse a result missing them. */
export async function checkedEvents<E extends { id: number; type: string; before?: unknown; after?: unknown; source?: string | null }>(db: Db, events: E[]) {
  try { if (import.meta.env.DEV && await (await import("./dev-late.server")).devFail("checks")) throw new Error("dev_fail"); return { ...splitChecked(events, await latestChecks(db, events.map(e => e.id))), failed: false }; }
  catch { return { tape: events.filter(e => e.source && e.source !== "live"), unconfirmed: [], rereads: [], failed: true }; }
}
