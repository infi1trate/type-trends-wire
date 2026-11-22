// W3a Part E · what a forecast run "read" for an AI field, per homepage: the newest usable AI reading (not low confidence, not blocked)
// of a live desktop home capture taken and tagged at or before the run. Read-only (anonymous public reads), for the story build, the data
// desk's daily run and the proof.
import { AI_FIELDS, fieldValue, steadiness, type AiField, type FieldReading, type Readings, type Steadiness } from "./steady";

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const CHUNK = 150;
type Snap = { id: number; domain: string; captured_at: string };
type Tag = { snapshot_id: number; created_at: string; tags: Record<string, unknown> | null };

/** Readings for two run times at once (one read of the captures and their tags up to the later run). */
export async function runReadings(db: Db, domains: readonly string[], runs: readonly string[]): Promise<Map<string, Readings>> {
  const snaps: Snap[] = [], latest = [...runs].sort().at(-1)!;
  for (let i = 0; i < domains.length; i += CHUNK) {
    for (let f = 0; ; f += 1000) {
      const r = await db.from("library_snapshots").select("id,domain,captured_at").in("domain", domains.slice(i, i + CHUNK)).eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").lte("captured_at", latest).order("id").range(f, f + 999);
      if (r.error) throw r.error;
      snaps.push(...(r.data ?? []));
      if ((r.data ?? []).length < 1000) break;
    }
  }
  const tags = new Map<number, Tag>();
  const ids = snaps.map(s => s.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const r = await db.from("library_tags").select("snapshot_id,created_at,tags").in("snapshot_id", ids.slice(i, i + CHUNK));
    if (r.error) throw r.error;
    for (const t of (r.data ?? []) as Tag[]) tags.set(t.snapshot_id, t);
  }
  const out = new Map<string, Readings>();
  for (const at of runs) {
    const best = new Map<string, { s: Snap; t: Tag }>();
    for (const s of snaps) {
      const t = tags.get(s.id);
      if (!t || !t.tags || s.captured_at > at || t.created_at > at) continue;
      if (t.tags["low_confidence"] === true || (t.tags["blocked_reason"] != null && t.tags["blocked_reason"] !== "")) continue;
      const b = best.get(s.domain);
      if (!b || s.captured_at > b.s.captured_at) best.set(s.domain, { s, t });
    }
    const m = new Map<string, Partial<Record<AiField, FieldReading>>>();
    for (const [d, { s, t }] of best) { const x: Partial<Record<AiField, FieldReading>> = {}; for (const f of AI_FIELDS) { const v = fieldValue(t.tags!, f); if (v != null) x[f] = { value: v, at: s.captured_at }; } m.set(d, x); }
    out.set(at, m);
  }
  return out;
}
/** Steadiness of the given (field, scope) pairs between two runs. `sites` maps each active domain to its sector. */
export async function steadyFor(db: Db, pairs: readonly { field: AiField; scope: string }[], sites: ReadonlyMap<string, string>, early: string, late: string): Promise<Steadiness[]> {
  if (!pairs.length) return [];
  const scopes = new Set(pairs.map(p => p.scope)), inScope = (d: string) => scopes.has("all") || scopes.has(sites.get(d) ?? "");
  const domains = [...sites.keys()].filter(inScope);
  const rs = await runReadings(db, domains, [early, late]);
  return pairs.map(p => steadiness(p.field, p.scope, domains.filter(d => p.scope === "all" || sites.get(d) === p.scope), rs.get(early)!, rs.get(late)!));
}
