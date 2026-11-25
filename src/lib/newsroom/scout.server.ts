// N5 · the scout's I/O: the sources register with its terms readings, the week's candidates call (outlet wire items, stored Product
// Hunt launches and the names the news matcher could not tie to a tracked brand), the candidates kept by code and filed with `propose`,
// and their statuses. Rules are pure in scout.ts. Nothing here reads a new outside source or adds anything to the library.
import type { Admin } from "./review.server";
import * as s from "./scout";
import { OUTLET_NAMES } from "../wire-sources";

async function all<T>(f: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; a < 20000; a += 1000) { const { data, error } = await f(a, a + 999); if (error) throw new Error("scout_read_failed"); out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
  return out;
}
export async function scoutSheet(db: Admin, now = Date.now()): Promise<s.ScoutSheet> {
  const since = new Date(now - s.SCOUT_DAYS * 864e5).toISOString();
  const [{ data: wire, error }, { data: ph }, { matcherNow }, { brandTag, clean }, { isoWeek }] = await Promise.all([
    db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").eq("source_kind", "rss").in("source", [...OUTLET_NAMES]).gte("published_at", since).order("published_at", { ascending: false }).limit(200),
    db.from("wire_items").select("id,title,url,link,source,source_kind,published_at,excerpt").eq("source_kind", "producthunt").gte("published_at", since).order("published_at", { ascending: false }).limit(60),
    import("./news.server"), import("./news"), import("../digest/week"),
  ]);
  if (error) throw new Error("scout_wire_failed");
  const m = await matcherNow();
  const items: s.ScoutItem[] = [
    ...(wire ?? []).map(w => ({ ref: `wire:${w.id}`, kind: "outlet" as const, source: w.source, title: clean(w.title), excerpt: clean(w.excerpt) || null, date: w.published_at, url: w.url })),
    ...(ph ?? []).map(w => ({ ref: `wire:${w.id}`, kind: "launch" as const, source: w.source, title: clean(w.title), excerpt: clean(w.excerpt) || null, date: w.published_at, url: w.link ?? w.url })),
  ];
  const stop = new Set([...OUTLET_NAMES, ...s.SOURCES.map(x => x.name)].map(x => x.toLowerCase()));
  const names: { name: string; ref: string }[] = [];
  for (const w of wire ?? []) {
    const it = { title: clean(w.title), excerpt: clean(w.excerpt) || null, url: w.url, outlet: w.source };
    if (brandTag(m, it)) continue;
    for (const n of s.namesIn(it.title, { stop })) if (names.length < 80) names.push({ name: n, ref: `wire:${w.id}` });
  }
  return { now: new Date(now).toISOString(), week: isoWeek(new Date(now)), items, names };
}
export type ScoutRun = { ran: boolean; why: string; call_id: number | null; returned: number; kept: (s.KeptCandidate & { id: number; log: number | null })[]; dropped: s.DroppedCandidate[]; cost: number; items: number; names: number };
/** The week's candidates call. `fixture` records the call as a fixture, stores no candidate and files nothing. */
export async function runCandidates(db: Admin, o: { now?: number; fixture?: boolean; signal?: AbortSignal; /** PH1 · set just before the model call */ mark?: { called: boolean } } = {}): Promise<ScoutRun> {
  const now = o.now ?? Date.now(), out: ScoutRun = { ran: false, why: "", call_id: null, returned: 0, kept: [], dropped: [], cost: 0, items: 0, names: 0 };
  const sheet = await scoutSheet(db, now);
  out.items = sheet.items.length; out.names = sheet.names.length;
  if (!sheet.items.length) { out.why = "no items in the last seven days"; return out; }
  const [sites, opt, prior, { weeklyCall }] = await Promise.all([
    all<{ domain: string }>((a, b) => db.from("library_sites").select("domain").order("domain").range(a, b)),
    all<{ domain: string }>((a, b) => db.from("thumb_optouts").select("domain").order("domain").range(a, b)),
    db.from("brand_candidates").select("domain").eq("test", false).gte("at", new Date(now - s.REPROPOSE_DAYS * 864e5).toISOString()).limit(1000),
    import("./weekly-call.server"),
  ]);
  const outlets = new Set(sheet.items.flatMap(i => { try { return i.kind === "outlet" && i.url ? [new URL(i.url).hostname.replace(/^www\./, "")] : []; } catch { return []; } }));
  if (o.mark) o.mark.called = true;
  const c = await weeklyCall(db, "scout", o.fixture ? "fixture" : "candidates", sheet.week, { system: s.SCOUT_SYSTEM, user: s.scoutUser(sheet), schema: s.SCOUT_SCHEMA as unknown as Record<string, unknown>, schemaName: "brand_candidates", tool: s.SCOUT_TOOL, maxTokens: 2500 }, s.parseScout, o.signal ?? AbortSignal.timeout(45_000), "scout");
  if ("refused" in c) { out.why = c.refused; return out; }
  out.ran = true; out.call_id = c.call_id; out.cost = c.cost;
  if (!c.parsed) { out.why = "call failed: not the fixed structure"; return out; }
  const a = c.parsed as s.ScoutAnswer; out.returned = a.candidates.length;
  const e = s.enforceCandidates(a, sheet, { tracked: new Set(sites.map(x => x.domain.toLowerCase())), optedOut: new Set(opt.map(x => x.domain.toLowerCase())), proposed: new Set((prior.data ?? []).map(x => x.domain)), outlets });
  out.dropped = e.dropped;
  if (o.fixture) { out.kept = e.kept.map((k, i) => ({ ...k, id: -(i + 1), log: null })); out.why = `${e.kept.length} kept, ${e.dropped.length} dropped (fixture: nothing stored or filed)`; return out; }
  const { deskDoor } = await import("../stories/desk.server");
  for (const k of e.kept) {
    const r = await deskDoor("scout", { action: "propose", kind: "brand", subject: `brand:${k.domain}`, sector: k.sector, category: k.category, subcategory: k.subcategory, text: `Track ${k.name} (${k.domain}, ${k.sector} · ${k.category} · ${k.subcategory}): ${k.why} [${k.cites}]`.slice(0, 1000) });
    const log = ((r.body as { log?: number }).log) ?? null;
    const { data, error } = await db.from("brand_candidates").insert({ week: sheet.week, name: k.name, domain: k.domain, sector: k.sector, why: k.why, cites: k.cites, call_id: c.call_id, log_id: log }).select("id").single();
    if (!error && data) out.kept.push({ ...k, id: data.id, log });
  }
  out.why = `${out.kept.length} kept and filed, ${e.dropped.length} dropped`;
  return out;
}

export async function insertSourceNote(db: Admin, r: { source: string; status: string; read_on: string | null; link: string | null; note: string; actor: string }): Promise<{ id: number }> {
  const { data, error } = await db.from("source_notes").insert({ ...r, actor: r.actor === "owner" ? "owner" : "scout" }).select("id").single();
  if (error || !data) throw new Error("source_note_insert_failed");
  return { id: data.id };
}
export async function insertCandidateStatus(db: Admin, r: { candidate: number; status: string; actor: string; reason: string | null }): Promise<{ status: string } | { refused: string } | null> {
  const [{ data: c }, { data: st }] = await Promise.all([db.from("brand_candidates").select("id").eq("id", r.candidate).maybeSingle(), db.from("brand_candidate_statuses").select("status").eq("candidate_id", r.candidate).order("id")]);
  if (!c) return null;
  const why = s.candidateMoveProblem(s.candidateStatusOf(st ?? []), r.status as s.CandidateStatus, r.actor);
  if (why) return { refused: why };
  const { error } = await db.from("brand_candidate_statuses").insert({ candidate_id: r.candidate, status: r.status, actor: r.actor === "owner" ? "owner" : "engineering", reason: r.reason });
  if (error) throw new Error("candidate_status_insert_failed");
  return { status: r.status };
}
/** The /desk Scout panel and the memory: the register as shown, this week's candidates with status, the calls used. */
export async function scoutPanel(db: Admin, now = Date.now()) {
  const { isoWeek } = await import("../digest/week");
  const [{ data: notes }, { data: cands }, { data: calls }, museum] = await Promise.all([
    db.from("source_notes").select("id,at,source,status,read_on,link,note,actor").order("id", { ascending: false }).limit(200),
    db.from("brand_candidates").select("id,at,week,name,domain,sector,why,cites,test").order("id", { ascending: false }).limit(40),
    db.from("desk_calls_weekly").select("id,at,purpose,ok,cost").eq("desk", "scout").gte("at", new Date(now - 7 * 864e5).toISOString()),
    museumWorks(db).catch(() => null),
  ]);
  const ids = (cands ?? []).map(c => c.id);
  const { data: st } = ids.length ? await db.from("brand_candidate_statuses").select("candidate_id,status,at,actor").in("candidate_id", ids).order("id") : { data: [] };
  const week = isoWeek(new Date(now)), today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  const latestWeek = cands?.[0]?.week ?? week;
  return {
    register: s.registerWithNotes((notes ?? []) as s.SourceNote[]),
    candidates: (cands ?? []).filter(c => c.week === latestWeek).map(c => ({ ...c, status: s.candidateStatusOf((st ?? []).filter(x => x.candidate_id === c.id)) })),
    week: latestWeek,
    museum,
    calls: { today: (calls ?? []).filter(c => c.purpose === "candidates" && c.at >= today.toISOString()).length, week: (calls ?? []).filter(c => c.purpose === "candidates").length, fixtures_week: (calls ?? []).filter(c => c.purpose === "fixture").length, cap: 1, usd_week: Math.round((calls ?? []).reduce((a, c) => a + Number(c.cost ?? 0), 0) * 1e4) / 1e4 },
  };
}

/** W3a · museum works on the Scout panel: stored by source (not removed) and every removal with its date and reason. */
export async function museumWorks(db: Admin) {
  const count = (source: "met" | "aic") => db.from("art_works").select("id", { count: "exact", head: true }).eq("source", source).is("removed_at", null).then(r => r.count ?? 0);
  const [met, aic, removed] = await Promise.all([count("met"), count("aic"),
    db.from("art_works").select("source,source_id,title,removed_at,removed_reason").not("removed_at", "is", null).order("removed_at", { ascending: false }).limit(50).then(r => r.data ?? [])]);
  return { met, aic, removed: removed.map(r => ({ source: r.source, source_id: r.source_id, title: r.title, at: r.removed_at as string, reason: r.removed_reason ?? "" })) };
}
