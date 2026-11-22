// N3 · the news desk's I/O: the wire's outlet items, the picks so far, the one model call (the story writer's gateway path, recorded in
// desk_calls), the picks and drops through the door, the pitches to the board, and the picks readers see (anonymous public facade).
import type { Admin } from "./review.server";
import { NEWS_PICKS_PER_DAY, NEWS_WINDOW_HOURS, brandTag, clean, enforcePicks, lineFailures, newsCandidates, newsUser, pitchFor, shouldCall, wireBlock, NEWS_SYSTEM, NEWS_SCHEMA, NEWS_TOOL, parseNews, type NewsAnswer, type PublicPick, type WireRow, type Candidate } from "./news";
import { isOutletItem } from "../wire-sources";
import { NEWS_LIMIT_MS, NEWS_WHY_EVERY_MS } from "./news";

const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

/** A pick through the door's store: outlet items only, never picked twice, at most five a day (UTC), a line that passes the line check
 *  against the item, and the brand tag the code's whole-name matcher gives (whatever the caller sent). */
export async function insertPick(db: Admin, r: { item_id: number; subject: string; line: string; domain: string | null; call_id: number | null; actor: string }, now: number): Promise<{ id: number } | { refused: string }> {
  const [item, today, had] = await Promise.all([
    db.from("wire_items").select("id,source,source_kind,title,excerpt,url").eq("id", r.item_id).maybeSingle(),
    db.from("wire_picks").select("id", { count: "exact", head: true }).gte("at", dayStart(now)),
    db.from("wire_picks").select("id").eq("item_id", r.item_id).maybeSingle(),
  ]);
  if (item.error || today.error || had.error) throw new Error("pick_read_failed");
  if (!item.data) return { refused: "No such wire item." };
  if (!isOutletItem(item.data)) return { refused: "Only items from the wire's publications can be picked." };
  if (had.data) return { refused: "This item was picked before." };
  if ((today.count ?? 0) >= NEWS_PICKS_PER_DAY) return { refused: `Five picks a day: today's ${NEWS_PICKS_PER_DAY} are made.` };
  const it = { title: clean(item.data.title), excerpt: clean(item.data.excerpt) || null };
  const why = lineFailures(r.line, it);
  if (why.length) return { refused: `The line fails the check: ${why.join("; ")}.`.slice(0, 300) };
  const domain = brandTag(await matcherNow(), { ...it, url: item.data.url, outlet: item.data.source });
  const { data, error } = await db.from("wire_picks").insert({ item_id: r.item_id, subject: r.subject, line: r.line, domain, actor: r.actor === "owner" ? "owner" : "news", call_id: r.call_id }).select("id").single();
  if (error || !data) throw new Error("pick_insert_failed");
  return { id: data.id };
}
export async function insertDrop(db: Admin, r: { pick_id: number; actor: string; reason: string }): Promise<{ id: number } | null> {
  const [p, d] = await Promise.all([db.from("wire_picks").select("id").eq("id", r.pick_id).maybeSingle(), db.from("wire_pick_drops").select("id").eq("pick_id", r.pick_id).limit(1)]);
  if (p.error || d.error) throw new Error("drop_read_failed");
  if (!p.data || (d.data ?? []).length) return null;
  const { data, error } = await db.from("wire_pick_drops").insert(r).select("id").single();
  if (error || !data) throw new Error("drop_insert_failed");
  return { id: data.id };
}

/** The wire's outlet items in the window, with the ids picked before. */
export async function newsInputs(db: Admin, now: number) {
  const since = new Date(now - (NEWS_WINDOW_HOURS + 12) * 36e5).toISOString();
  const { OUTLET_NAMES } = await import("../wire-sources");
  const { data, error } = await db.from("wire_items").select("id,title,url,source,source_kind,published_at,fetched_at,excerpt").eq("source_kind", "rss").in("source", [...OUTLET_NAMES]).gte("published_at", since).order("published_at", { ascending: false }).limit(400);
  if (error) throw new Error("wire_read_failed");
  const items = (data ?? []) as WireRow[];
  const ids = items.map(x => x.id);
  const { data: p } = ids.length ? await db.from("wire_picks").select("item_id").in("item_id", ids) : { data: [] };
  return { items, picked: new Set((p ?? []).map(x => x.item_id)) };
}
export async function matcherNow() {
  const [{ supabaseAnon }, { newsMatcher }] = await Promise.all([import("../mcp/supabase"), import("../stories/candidates")]);
  const out: { domain: string; name: string | null }[] = [];
  for (let f = 0; ; f += 1000) { const { data } = await supabaseAnon().from("library_sites").select("domain,name").eq("active", true).order("domain").range(f, f + 999); out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
  return newsMatcher(out, []);
}
/** Confirmed live changes on a brand's tape near a date (the integrity rule's tape). */
export async function tapeChanges(domains: string[], around: number) {
  if (!domains.length) return [];
  const [{ supabaseAnon }, { latestChecks }, { splitChecked }] = await Promise.all([import("../mcp/supabase"), import("../integrity.server"), import("../integrity")]);
  const db = supabaseAnon(), lo = new Date(around - 15 * 864e5).toISOString(), hi = new Date(around + 15 * 864e5).toISOString();
  const { data } = await db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source").eq("source", "live").in("domain", domains).gte("detected_at", lo).lte("detected_at", hi).limit(200);
  const evs = (data ?? []).filter((e): e is typeof e & { id: number; domain: string; type: string; detected_at: string } => e.id != null && !!e.domain && !!e.type && !!e.detected_at);
  const checks = await latestChecks(db, evs.map(e => e.id)).catch(() => new Map());
  return splitChecked(evs, checks).tape.map(e => ({ id: e.id, domain: e.domain, type: e.type, detected_at: e.detected_at }));
}

export type NewsRun = { ran: boolean; why: string; candidates: number; call_id: number | null; picked: { id: number; item: number; line: string; domain: string | null; subject: string }[]; dropped: { id: number; line: string; reasons: string[] }[]; pitches: number; errors: string[] };
/**
 * One news-desk pass (with the hourly story build). Code decides whether to call; the call proposes; the line check, the five-a-day
 * limit and the brand tag are applied here; each pick goes through the door as `news`. `fixture` makes a call that does not count
 * against the daily limit and writes nothing but the call record (the proof replays). Never throws.
 */
export async function runNewsDesk(db: Admin, o: { now?: number; fixture?: boolean; deadline?: number; signal?: AbortSignal } = {}): Promise<NewsRun> {
  const now = o.now ?? Date.now(), out: NewsRun = { ran: false, why: "", candidates: 0, call_id: null, picked: [], dropped: [], pitches: 0, errors: [] };
  try {
    const [{ items, picked }, todayQ, lastQ] = await Promise.all([newsInputs(db, now), db.from("wire_picks").select("id", { count: "exact", head: true }).gte("at", dayStart(now)), db.from("desk_calls").select("at").eq("desk", "news").eq("purpose", "picks").order("id", { ascending: false }).limit(1)]);
    const picksToday = o.fixture ? 0 : todayQ.count ?? 0;
    const cands = newsCandidates(items, picked, now);
    out.candidates = cands.length;
    const gate = shouldCall(cands, { lastCallAt: o.fixture ? null : lastQ.data?.[0]?.at ?? null, picksToday });
    if (!gate.call) {
      out.why = gate.why;
      // N4b · the reason it did not call, recorded at most once an hour, so the desk page shows why instead of nothing.
      if (!o.fixture) {
        const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).eq("actor", "news").eq("action", "data_run").eq("subject_id", "picks").gte("at", new Date(now - NEWS_WHY_EVERY_MS).toISOString());
        if (!count) await (await import("../stories/desk.server")).deskDoor("news", { action: "data_run", run: "picks", summary: `No call: ${gate.why}.`.slice(0, 600), counts: { candidates: cands.length, picks_today: picksToday } }).catch(() => null);
      }
      return out;
    }
    if (!o.fixture) {
      const { count } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "news").eq("purpose", "picks").gte("at", dayStart(now));
      const { DESK_CAPS } = await import("./caps");
      if ((count ?? 0) >= DESK_CAPS.news) {
        out.why = "cap used: no picks by the news desk until tomorrow (UTC)";
        // The history says so, once a day.
        const { count: said } = await db.from("desk_log").select("id", { count: "exact", head: true }).eq("actor", "news").eq("action", "data_run").eq("subject_id", "picks").ilike("reason", "cap used%").gte("at", dayStart(now));
        if (!said) await (await import("../stories/desk.server")).deskDoor("news", { action: "data_run", run: "picks", summary: `cap used: the news desk's ${DESK_CAPS.news} calls today are made; no more picks until tomorrow (UTC).` });
        return out;
      }
    }
    const { deskCall } = await import("./review.server");
    const signal = o.signal ?? AbortSignal.timeout(Math.max(5000, (o.deadline ?? now + 40_000) - Date.now() - 2000));
    const c = await deskCall(db, "news", o.fixture ? "fixture" : "picks", { system: NEWS_SYSTEM, user: newsUser(cands, { now: new Date(now).toISOString(), left: NEWS_PICKS_PER_DAY - picksToday }), schema: NEWS_SCHEMA as unknown as Record<string, unknown>, schemaName: "news_picks", tool: NEWS_TOOL, maxTokens: 1500 }, parseNews, cands.map(x => `wire:${x.id}`), signal);
    out.ran = true; out.call_id = c?.call_id ?? null;
    if (!c || !c.parsed) {
      out.why = "call failed: no picks this pass";
      if (!o.fixture) await (await import("../stories/desk.server")).deskDoor("news", { action: "data_run", run: "picks", summary: "call failed: no picks this pass; the wire carries on without them.", counts: { candidates: cands.length } }).catch(() => null);
      return out;
    }
    const enforced = enforcePicks(c.parsed as NewsAnswer, cands, { picksToday, matcher: await matcherNow() });
    out.dropped = enforced.dropped;
    out.why = `${enforced.picks.length} picked, ${enforced.dropped.length} dropped by the line check`;
    if (o.fixture) { out.picked = enforced.picks.map((p, i) => ({ id: -(i + 1), item: p.item.id, line: p.line, domain: p.domain, subject: p.subject })); return out; }
    const { deskDoor } = await import("../stories/desk.server");
    const changes = await tapeChanges([...new Set(enforced.picks.flatMap(p => (p.domain ? [p.domain] : [])))], now).catch(() => []);
    const { brandName } = await import("../brand-names");
    for (const p of enforced.picks) {
      const r = await deskDoor("news", { action: "wire_pick", item: p.item.id, subject: p.subject, line: p.line, ...(p.domain ? { domain: p.domain } : {}), ...(out.call_id ? { call: out.call_id } : {}) });
      const b = r.body as { pick?: number; reason?: string };
      if (r.status >= 300 || !b.pick) { out.errors.push(`pick ${p.item.id}: ${b.reason ?? r.status}`); continue; }
      out.picked.push({ id: b.pick, item: p.item.id, line: p.line, domain: p.domain, subject: p.subject });
      const pitch = pitchFor(p, changes, d => brandName(d, null));
      if (pitch && out.pitches < 2) { const pr = await deskDoor("news", { action: "pitch", ...pitch }); if (pr.status < 300) out.pitches++; }
    }
    // One history row per call: picked, dropped by the line check (with the reasons), pitches filed.
    const dropLine = enforced.dropped.slice(0, 5).map(d => `wire:${d.id} (${d.reasons[0] ?? "dropped"})`).join("; ");
    await deskDoor("news", { action: "data_run", run: "picks", summary: `${out.picked.length} picked, ${enforced.dropped.length} dropped by the line check${dropLine ? `: ${dropLine}` : ""}; ${out.pitches} pitches.`.slice(0, 600), counts: { candidates: cands.length, picked: out.picked.length, dropped: enforced.dropped.length, pitches: out.pitches } }).catch(() => null);
  } catch (e) { out.errors.push(e instanceof Error ? e.message.slice(0, 120) : "error"); }
  return out;
}

/** Readers' picks (anonymous facade): the front page's THE WIRE block and the terminal's picked marks. */
export async function publicPicks(sinceHours: number): Promise<PublicPick[]> {
  const { supabaseAnon } = await import("../mcp/supabase");
  const { data, error } = await supabaseAnon().rpc("wire_picks_public", { p_since: new Date(Date.now() - sinceHours * 36e5).toISOString() });
  if (error) throw new Error("picks_read_failed");
  return (data ?? []).map(p => ({ pick_id: p.pick_id, item_id: p.item_id, at: p.at, subject: p.subject, line: p.line, domain: p.domain, title: p.title, url: p.url, source: p.source, published_at: p.published_at }));
}
export async function loadFrontWire() {
  const [picks, { activeDomains }, { brandName }] = await Promise.all([publicPicks(26).catch(() => [] as PublicPick[]), import("../active-sites.server"), import("../brand-names")]);
  const active = await activeDomains().catch(() => new Set<string>());
  const { supabaseAnon } = await import("../mcp/supabase");
  const ds = [...new Set(picks.flatMap(p => (p.domain ? [p.domain] : [])))];
  const { data: names } = ds.length ? await supabaseAnon().from("library_sites").select("domain,name").in("domain", ds) : { data: [] };
  const byName = new Map((names ?? []).map(n => [n.domain, n.name]));
  return { rows: wireBlock(picks, Date.now(), { active, name: d => brandName(d, byName.get(d) ?? null) }) };
}
/** The terminal wire view's marks: each picked item's line (eight days). */
export async function wirePickMarks(): Promise<{ marks: Record<string, string> }> {
  const picks = await publicPicks(8 * 24).catch(() => [] as PublicPick[]);
  return { marks: Object.fromEntries(picks.map(p => [String(p.item_id), p.line])) };
}
export type { Candidate };

/**
 * N4b · the news desk's turn in the wire ingest's own job: straight after the ingest stores its items and before the story build, with
 * its own 25-second limit (never past the job's own limit, and skipped when a call could not fit). Held (`picks`) means no turn. Never throws.
 */
export async function newsTurn(jobStartedAt: number, jobLimitMs: number): Promise<string> {
  try {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { isHeld } = await import("./passes.server");
    if (await isHeld(db, "picks")) return "held";
    const deadline = Math.min(Date.now() + NEWS_LIMIT_MS, jobStartedAt + jobLimitMs - 10_000);
    if (deadline - Date.now() < 8000) return "no time left in this job";
    const r = await Promise.race([runNewsDesk(db, { deadline }), new Promise<null>(res => setTimeout(() => res(null), deadline - Date.now() + 500))]);
    if (!r) { console.warn("news desk timed out"); return "timed out"; }
    if (r.ran) console.info("news desk", { candidates: r.candidates, picked: r.picked.length, dropped: r.dropped.length });
    return r.why || (r.errors[0] ?? "ok");
  } catch (e) { return e instanceof Error ? e.message.slice(0, 80) : "error"; }
}
