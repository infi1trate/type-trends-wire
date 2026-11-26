// M2a · POST /api/public/ingest-listings (crawler secret, checked before the body is read) and the listing half of icon_remove. The post
// only stores (D1): reads of the stored rows it may replace, then at most three upserts and a prune of weekly rows past the kept weeks.
// Text is stored once per app (listing) and once per version, never once a week. Never logs payloads. Writes go through an injectable
// store, so tests use memory and nothing reaches the shared database.
import { boundedText } from "../thumbs-ingest.server";
import { plainIssue } from "../crops";
import { LISTING_LIMITS, checkListing, dayProblem, listingApp, listingKey, listingPayload, oldestKept, rowsFor, versionKey, weekKey, weekOfDay, type ListingApp, type ListingRefusal, type ListingRow, type VersionRow, type WeekRow } from "./contract";

export type ListingStore = {
  guard(): Promise<Response | null>;
  authenticate(request: Request): Promise<boolean>;
  /** Of these app ids, the ones removed on request (in app_icons or app_listings). */
  removed(ids: string[]): Promise<Set<string>>;
  listings(ids: string[]): Promise<ListingRow[]>;
  versions(keys: { app_id: string; version: string }[]): Promise<VersionRow[]>;
  weekRows(week: string, genreId: number, ids: string[]): Promise<WeekRow[]>;
  /** `seen` is the post's time: first_seen on insert, last_seen always. */
  upsertListings(rows: ListingRow[], seen: string): Promise<void>;
  upsertVersions(rows: VersionRow[]): Promise<void>;
  upsertWeeks(rows: WeekRow[]): Promise<void>;
  /** Deletes weekly rows of weeks before `oldest` (listing and version rows stay). */
  prune(oldest: string): Promise<void>;
  /** Marks the app's listing removed and blanks its stored text (about, and notes on every version); rows touched. */
  markRemoved(appId: string, reason: string, at: string): Promise<number>;
};
export type ListingRefused = { app_id: string | null; reason: ListingRefusal; detail?: string };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const pick = (raw: unknown, k: string) => (raw && typeof raw === "object" ? (raw as Record<string, unknown>)[k] : undefined);

export async function handleListingIngest(request: Request, store?: ListingStore, now = () => Date.now()): Promise<Response> {
  try {
    const db = store ?? (await adminListingStore());
    const later = await db.guard();
    if (later) return later;
    if (!await db.authenticate(request)) return json({ error: "Missing or wrong x-crawl-secret" }, 401);
    const text = await boundedText(request, LISTING_LIMITS.requestBytes);
    if (text === null) return json({ error: "Body exceeds 256 KB" }, 413);
    let raw: unknown; try { raw = JSON.parse(text); } catch { return json({ error: "Body is not valid JSON" }, 400); }
    const parsed = listingPayload.safeParse(raw);
    if (!parsed.success) return json({ error: plainIssue(parsed.error.issues as never) }, 400);
    const p = parsed.data, t = now(), bad = dayProblem(p.day, t);
    if (bad) return json({ error: bad }, 400);
    const week = weekOfDay(p.day), refused: ListingRefused[] = [], ok: ListingApp[] = [], ids = new Set<string>(), ranks = new Set<number>();
    for (const r of p.apps) {
      const a = listingApp.safeParse(r), app_id = typeof pick(r, "app_id") === "string" ? (pick(r, "app_id") as string).slice(0, 20) : null;
      if (!a.success) { refused.push({ app_id, reason: "invalid", detail: plainIssue(a.error.issues as never) }); continue; }
      const c = checkListing(a.data);
      if (!c.ok) { refused.push({ app_id: a.data.app_id, reason: c.reason }); continue; }
      if (ids.has(a.data.app_id)) { refused.push({ app_id: a.data.app_id, reason: "duplicate_app" }); continue; }
      if (ranks.has(a.data.rank)) { refused.push({ app_id: a.data.app_id, reason: "duplicate_rank" }); continue; }
      ids.add(a.data.app_id); ranks.add(a.data.rank); ok.push(a.data);
    }
    const gone = await db.removed([...ids]);
    const keep = ok.filter(a => { if (!gone.has(a.app_id)) return true; refused.push({ app_id: a.app_id, reason: "removed" }); return false; });
    const answer = (stored: number, unchanged: number) => json({ week, genre: p.genre, part: p.part, parts: p.parts, stored, unchanged, refused });
    if (!keep.length) return answer(0, 0);
    const rows = keep.map(a => rowsFor(a, p)), seen = new Date(t).toISOString();
    const [oldL, oldV, oldW] = await Promise.all([db.listings(keep.map(a => a.app_id)), db.versions(rows.map(r => ({ app_id: r.ver.app_id, version: r.ver.version }))), db.weekRows(week, p.genre.id, keep.map(a => a.app_id))]);
    const L = new Map(oldL.map(r => [r.app_id, r])), V = new Map(oldV.map(r => [`${r.app_id}\u0000${r.version}`, r])), W = new Map(oldW.map(r => [r.app_id, r]));
    const newL: ListingRow[] = [], newV: VersionRow[] = [], newW: WeekRow[] = [], touched = new Set<string>();
    for (const { listing, ver, week: w } of rows) {
      const sw = W.get(w.app_id), sl = L.get(listing.app_id), sv = V.get(`${ver.app_id}\u0000${ver.version}`);
      const weekNew = !sw;
      if (!sw || weekKey(sw) !== weekKey(w)) { newW.push(w); touched.add(w.app_id); }
      // A new week for the app also refreshes last_seen; a same-week identical repost writes nothing.
      if (!sl || listingKey(sl) !== listingKey(listing) || weekNew) {
        const changedAt = !sl ? null : sl.about !== listing.about ? seen : sl.about_changed_at;
        newL.push({ ...listing, about_changed_at: changedAt }); touched.add(listing.app_id);
      }
      if (!sv || versionKey(sv) !== versionKey(ver)) { newV.push(ver); touched.add(ver.app_id); }
    }
    if (!touched.size) return answer(0, keep.length);
    if (newL.length) await db.upsertListings(newL, seen);
    if (newV.length) await db.upsertVersions(newV);
    if (newW.length) await db.upsertWeeks(newW);
    await db.prune(oldestKept(week));
    return answer(touched.size, keep.length - touched.size);
  } catch (error) {
    console.error("Listing ingestion failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Internal error" }, 500);
  }
}

/** The listing half of icon_remove: the app's listing is marked removed (so it is refused forever) and its stored text is blanked. */
export async function removeListingApp(appId: string, reason: string, store?: ListingStore, at = new Date().toISOString()): Promise<number> {
  const db = store ?? (await adminListingStore());
  return db.markRemoved(appId, reason, at);
}

async function adminListingStore(): Promise<ListingStore> {
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
      const [a, b] = await Promise.all([
        db.from("app_icons").select("app_id").in("app_id", ids).not("removed_at", "is", null),
        db.from("app_listings").select("app_id").in("app_id", ids).not("removed_at", "is", null),
      ]);
      if (a.error || b.error) fail("Listing lookup failed");
      return new Set([...(a.data ?? []), ...(b.data ?? [])].map(x => x.app_id));
    },
    async listings(ids) {
      const r = await db.from("app_listings").select("store,app_id,name,maker,link,genre,site,first_at,about,about_chars,about_words,about_changed_at").eq("store", "us").in("app_id", ids);
      if (r.error) fail("Listing lookup failed");
      return (r.data ?? []) as ListingRow[];
    },
    async versions(keys) {
      const r = await db.from("app_listing_versions").select("store,app_id,version,version_at,notes,notes_chars,price,currency,size_mb,min_os,languages,age,shots").eq("store", "us").in("app_id", [...new Set(keys.map(k => k.app_id))]).in("version", [...new Set(keys.map(k => k.version))]);
      if (r.error) fail("Listing lookup failed");
      return (r.data ?? []) as unknown as VersionRow[];
    },
    async weekRows(week, genreId, ids) {
      const r = await db.from("app_listing_weeks").select("week,store,chart,genre_id,app_id,genre_name,day,rank,rating,ratings,version").eq("week", week).eq("store", "us").eq("chart", "top-free").eq("genre_id", genreId).in("app_id", ids);
      if (r.error) fail("Listing lookup failed");
      return (r.data ?? []) as WeekRow[];
    },
    async upsertListings(rows, seen) {
      // first_seen keeps its stored value on update: insert new apps with it, update known ones without it.
      const known = new Set(((await db.from("app_listings").select("app_id").eq("store", "us").in("app_id", rows.map(x => x.app_id))).data ?? []).map(x => x.app_id));
      const fresh = rows.filter(x => !known.has(x.app_id)).map(x => ({ ...x, first_seen: seen, last_seen: seen }));
      const old = rows.filter(x => known.has(x.app_id)).map(x => ({ ...x, last_seen: seen }));
      for (const batch of [fresh, old]) if (batch.length) { const r = await db.from("app_listings").upsert(batch, { onConflict: "store,app_id" }); if (r.error) fail("Listing write failed"); }
    },
    async upsertVersions(rows) {
      const r = await db.from("app_listing_versions").upsert(rows.map(x => ({ ...x, shots: x.shots as never })), { onConflict: "store,app_id,version" });
      if (r.error) fail("Listing version write failed");
    },
    async upsertWeeks(rows) {
      const r = await db.from("app_listing_weeks").upsert(rows.map(x => ({ ...x, stored_at: new Date().toISOString() })), { onConflict: "week,store,chart,genre_id,app_id" });
      if (r.error) fail("Listing week write failed");
    },
    async prune(oldest) { const r = await db.from("app_listing_weeks").delete().lt("week", oldest); if (r.error) fail("Listing prune failed"); },
    async markRemoved(appId, reason, at) {
      const a = await db.from("app_listings").update({ removed_at: at, removed_reason: reason, about: null }).eq("app_id", appId).is("removed_at", null).select("id");
      const b = await db.from("app_listing_versions").update({ notes: null }).eq("app_id", appId).not("notes", "is", null).select("id");
      if (a.error || b.error) fail("Listing removal failed");
      return (a.data?.length ?? 0) + (b.data?.length ?? 0);
    },
  };
}
