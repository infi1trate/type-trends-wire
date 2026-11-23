// W3d · POST /api/public/ingest-icons (crawler secret, checked before the body is read), the owner's removal, and the health line. The
// post only stores (D1): one read of the category's stored week, then at most an upsert, a delete of apps that left the chart and a
// prune past the kept weeks. Never logs payloads. Writes go through an injectable store, so tests use memory and nothing reaches the
// shared database.
import { boundedText } from "../thumbs-ingest.server";
import { plainIssue } from "../crops";
import { ICON_LIMITS, checkApp, dayProblem, iconApp, iconPayload, oldestKept, rowKey, weekOfDay, type IconApp, type IconHealth, type IconRefusal, type IconRemove } from "./contract";

export type StoredIcon = { app_id: string; rank: number; name: string; maker: string; link: string; palette: { hex: string; share: number }[]; day: string };
export type IconRow = IconApp & { week: string; day: string; store: "us"; chart: "top-free"; genre_id: number; genre_name: string; run_id: string };
export type IconStore = {
  /** D1 · a slow database or safe mode answers "try later" before anything else; null lets the post through. */
  guard(): Promise<Response | null>;
  authenticate(request: Request): Promise<boolean>;
  /** Of these app ids, the ones removed on request (in any week). */
  removed(ids: string[]): Promise<Set<string>>;
  /** The category's stored (not removed) rows for the week. */
  weekRows(week: string, genreId: number): Promise<StoredIcon[]>;
  upsert(rows: IconRow[]): Promise<void>;
  /** Deletes the category's not-removed rows for the week whose app is not in `keep`; returns how many. */
  dropOthers(week: string, genreId: number, keep: string[]): Promise<number>;
  /** Deletes not-removed rows of weeks before `oldest`. */
  prune(oldest: string): Promise<void>;
  /** Marks every row of the app removed (the rows stay, so the app is refused forever); the number of rows marked, 0 when none. */
  markRemoved(appId: string, reason: string, at: string): Promise<number>;
  isRemoved(appId: string): Promise<{ at: string } | null>;
};
export type IconRefused = { rank: number | null; app_id: string | null; reason: IconRefusal; detail?: string };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const pick = (raw: unknown, k: string) => (raw && typeof raw === "object" ? (raw as Record<string, unknown>)[k] : undefined);

export async function handleIconIngest(request: Request, store?: IconStore, now = () => Date.now()): Promise<Response> {
  try {
    const db = store ?? (await adminIconStore());
    const later = await db.guard();
    if (later) return later;
    if (!await db.authenticate(request)) return json({ error: "Missing or wrong x-crawl-secret" }, 401);
    const text = await boundedText(request, ICON_LIMITS.requestBytes);
    if (text === null) return json({ error: "Body exceeds 256 KB" }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Body is not valid JSON" }, 400); }
    const parsed = iconPayload.safeParse(raw);
    if (!parsed.success) return json({ error: plainIssue(parsed.error.issues as never) }, 400);
    const p = parsed.data, t = now(), bad = dayProblem(p.day, t);
    if (bad) return json({ error: bad }, 400);
    const week = weekOfDay(p.day), refused: IconRefused[] = [], ok: IconApp[] = [], ids = new Set<string>(), ranks = new Set<number>();
    for (const r of p.apps) {
      const a = iconApp.safeParse(r), rank = typeof pick(r, "rank") === "number" ? (pick(r, "rank") as number) : null, app_id = typeof pick(r, "app_id") === "string" ? (pick(r, "app_id") as string).slice(0, 20) : null;
      if (!a.success) { refused.push({ rank, app_id, reason: "invalid", detail: plainIssue(a.error.issues as never) }); continue; }
      const c = checkApp(a.data);
      if (!c.ok) { refused.push({ rank: a.data.rank, app_id: a.data.app_id, reason: c.reason }); continue; }
      if (ids.has(a.data.app_id)) { refused.push({ rank: a.data.rank, app_id: a.data.app_id, reason: "duplicate_app" }); continue; }
      if (ranks.has(a.data.rank)) { refused.push({ rank: a.data.rank, app_id: a.data.app_id, reason: "duplicate_rank" }); continue; }
      ids.add(a.data.app_id); ranks.add(a.data.rank); ok.push(a.data);
    }
    // An app removed on request is never stored again, whatever the crawler sends.
    const gone = await db.removed([...ids]);
    const keep = ok.filter(a => { if (!gone.has(a.app_id)) return true; refused.push({ rank: a.rank, app_id: a.app_id, reason: "removed" }); return false; });
    const answer = (stored: number, unchanged: number, dropped: number, extra: Record<string, unknown> = {}) => json({ week, genre: p.genre, stored, unchanged, dropped, refused, ...extra });
    if (!keep.length) return answer(0, 0, 0);
    const old = await db.weekRows(week, p.genre.id);
    const newestDay = old.reduce<string | null>((m, r) => (!m || r.day > m ? r.day : m), null);
    if (newestDay && p.day < newestDay) return json({ error: `This week already holds ${newestDay} for this category; an older day does not replace it.`, week }, 409);
    const stored = new Map(old.map(r => [r.app_id, rowKey(r)]));
    const changed = keep.filter(a => stored.get(a.app_id) !== rowKey(a)), leaving = old.filter(r => !ids.has(r.app_id) || gone.has(r.app_id));
    // Nothing changed: nothing is written (not even the day).
    if (!changed.length && !leaving.length) return answer(0, keep.length, 0);
    if (changed.length) await db.upsert(changed.map(a => ({ ...a, week, day: p.day, store: p.store, chart: p.chart, genre_id: p.genre.id, genre_name: p.genre.name, run_id: p.run_id })));
    const dropped = leaving.length ? await db.dropOthers(week, p.genre.id, keep.map(a => a.app_id)) : 0;
    await db.prune(oldestKept(week));
    return answer(changed.length, keep.length - changed.length, dropped);
  } catch (error) {
    console.error("Icon ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Internal error" }, 500);
  }
}

/** The owner's removal: every row of the app keeps its record (removed_at, reason) and leaves every reader page. */
export async function removeIconApp(r: IconRemove, store?: IconStore, at = new Date().toISOString()): Promise<{ removed: true; rows: number } | { refused: string } | null> {
  const db = store ?? (await adminIconStore());
  const was = await db.isRemoved(r.app_id);
  if (was) return { refused: `App ${r.app_id} was already removed on ${was.at.slice(0, 10)}.` };
  const n = await db.markRemoved(r.app_id, r.reason, at);
  return n ? { removed: true, rows: n } : null;
}

/** W3d · health: the newest stored week, its categories and apps (not removed), and when its rows were last written. W3d-c · the week's
 *  rows are read in pages (the data API stops at 1,000 rows a request: 18 categories and 1,797 apps read as 11 and 1,000). */
export type IconHealthReads = { newestWeek: () => Promise<string | null>; weekPage: (week: string, from: number, to: number) => PromiseLike<{ data: { genre_id: number; stored_at: string }[] | null; error: unknown }> };
export async function iconHealth(reads?: IconHealthReads): Promise<IconHealth> {
  const r = reads ?? await adminHealthReads();
  const week = await r.newestWeek();
  if (!week) return { week: null, categories: 0, apps: 0, last_stored_at: null };
  const { pagedRows } = await import("../paged");
  const got = await pagedRows((from, to) => r.weekPage(week, from, to));
  if (got.error) throw new Error("Icon health read failed");
  const rows = got.data;
  return { week, categories: new Set(rows.map(x => x.genre_id)).size, apps: rows.length, last_stored_at: rows.reduce<string | null>((m, x) => (!m || x.stored_at > m ? x.stored_at : m), null) };
}
async function adminHealthReads(): Promise<IconHealthReads> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  return {
    async newestWeek() {
      const top = await db.from("app_icons").select("week").is("removed_at", null).order("week", { ascending: false }).limit(1);
      if (top.error) throw new Error("Icon health read failed");
      return top.data?.[0]?.week ?? null;
    },
    weekPage: (week, from, to) => db.from("app_icons").select("genre_id,stored_at").eq("week", week).is("removed_at", null).order("id").range(from, to),
  };
}

async function adminIconStore(): Promise<IconStore> {
  const [{ supabaseAdmin: db }, { authenticateCrawler }] = await Promise.all([import("@/integrations/supabase/client.server"), import("../crawl-ingest.server")]);
  const fail = (what: string): never => { throw new Error(what); };
  return {
    async guard() {
      const { probeDb, probeHistory } = await import("../db-probe.server");
      const probe = await probeDb();
      if (!probe.ok) { const { retryAfterS, tryLater } = await import("../db-guard"); return tryLater(retryAfterS(probeHistory(), Date.now())); }
      const safe = await (await import("../safe-mode.server")).safeModeOn();
      if (safe.on) { const { tryLater } = await import("../db-guard"); return tryLater(120, `The site is in safe mode (${safe.why}); nothing was stored.`); }
      return null;
    },
    authenticate: authenticateCrawler,
    async removed(ids) {
      if (!ids.length) return new Set();
      const r = await db.from("app_icons").select("app_id").in("app_id", ids).not("removed_at", "is", null);
      if (r.error) fail("Icon lookup failed");
      return new Set((r.data ?? []).map(x => x.app_id));
    },
    async weekRows(week, genreId) {
      const r = await db.from("app_icons").select("app_id,rank,name,maker,link,palette,day").eq("week", week).eq("store", "us").eq("chart", "top-free").eq("genre_id", genreId).is("removed_at", null).limit(500);
      if (r.error) fail("Icon lookup failed");
      return (r.data ?? []) as unknown as StoredIcon[];
    },
    async upsert(rows) {
      const r = await db.from("app_icons").upsert(rows.map(x => ({ ...x, palette: x.palette as never, stored_at: new Date().toISOString() })), { onConflict: "week,store,chart,genre_id,app_id" });
      if (r.error) fail("Icon row write failed");
    },
    async dropOthers(week, genreId, keep) {
      let q = db.from("app_icons").delete({ count: "exact" }).eq("week", week).eq("store", "us").eq("chart", "top-free").eq("genre_id", genreId).is("removed_at", null);
      if (keep.length) q = q.not("app_id", "in", `(${keep.map(k => `"${k}"`).join(",")})`);
      const r = await q;
      if (r.error) fail("Icon row delete failed");
      return r.count ?? 0;
    },
    async prune(oldest) { const r = await db.from("app_icons").delete().lt("week", oldest).is("removed_at", null); if (r.error) fail("Icon prune failed"); },
    async markRemoved(appId, reason, at) {
      const r = await db.from("app_icons").update({ removed_at: at, removed_reason: reason }).eq("app_id", appId).is("removed_at", null).select("id");
      if (r.error) fail("Icon removal failed");
      return r.data?.length ?? 0;
    },
    async isRemoved(appId) {
      const r = await db.from("app_icons").select("removed_at").eq("app_id", appId).not("removed_at", "is", null).limit(1);
      if (r.error) fail("Icon lookup failed");
      const at = r.data?.[0]?.removed_at;
      return at ? { at } : null;
    },
  };
}
