// Watchlist handlers: capability checks, per-IP limits and edits over an injectable store (service role in production).
import { safeEqual, sha256Hex } from "../gate";
import { canonical } from "../labels";
import { createRateLimiter } from "../mcp/rate-limit";
import { WATCH_FEED_HEADERS, watchFeedXml, watchItems, sinceFor, watchView, FEED_MAX, type WatchRange, type WatchRows } from "./watch-feed";
import { EDIT_MESSAGES, TOKEN_RE, WATCH_LIMITS, WATCH_WINDOW_MS, applyOp, createSchema, editPath, feedPath, initialState, isTraitInput, newToken, normDomain, opSchema, promote, viewPath, type Classified, type RandomBytes, type WatchPublic, type WatchState } from "./watch";
import { SITE_URL } from "../site";

export type WatchRecord = WatchPublic & { edit_token_sha256: string; last_viewed_at: string | null };
export interface WatchStore {
  insert(r: WatchRecord): Promise<void>;
  get(id: string): Promise<WatchRecord | null>;
  byFeed(token: string): Promise<WatchRecord | null>;
  update(id: string, patch: Partial<WatchRecord>): Promise<WatchRecord | null>;
  remove(id: string): Promise<void>;
  touch(id: string, at: string): Promise<void>;
  /** Which of these domains are active library sites. */
  activeDomains(domains: string[]): Promise<Set<string>>;
  /** Which of these trait keys exist in the latest forecast. */
  traitKeys(keys: string[]): Promise<Set<string>>;
  queueRenders(domains: string[]): Promise<void>;
}
export type WatchDeps = { store: WatchStore; allow: (ip: string) => boolean; now: () => Date; rand?: RandomBytes; load: (w: WatchPublic, now: Date) => Promise<WatchRows> };
export type Fail = { ok: false; error: "not_found" | "rate_limited" | "invalid"; message: string };
const NOT_FOUND: Fail = { ok: false, error: "not_found", message: "Not found." };
const LIMITED: Fail = { ok: false, error: "rate_limited", message: `Too many changes from this connection. Try again within the hour (limit ${WATCH_LIMITS.editsPerHour} per hour).` };
const invalid = (message: string): Fail => ({ ok: false, error: "invalid", message });

export const toPublic = ({ edit_token_sha256: _h, last_viewed_at: _v, ...w }: WatchRecord): WatchPublic => w;
const state = (w: WatchPublic): WatchState => ({ name: w.name, sites: w.sites, pending_sites: w.pending_sites, traits: w.traits, sectors: w.sectors });
async function ctxFor(store: WatchStore, siteInputs: string[], traitInputs: string[], extra: string[] = []) {
  const domains = [...new Set([...siteInputs, ...extra].map(x => (isTraitInput(x) ? null : normDomain(x))).filter((d): d is string => !!d))];
  const traits = [...new Set([...siteInputs.filter(isTraitInput), ...traitInputs].map(x => canonical(x.trim())).filter(k => k.includes(":")))];
  const [active, known] = await Promise.all([domains.length ? store.activeDomains(domains) : Promise.resolve(new Set<string>()), traits.length ? store.traitKeys(traits) : Promise.resolve(new Set<string>())]);
  return { active, traits: known };
}
const links = (id: string, feed: string, edit?: string) => ({ view_url: `${SITE_URL}${viewPath(id)}`, feed_url: `${SITE_URL}${feedPath(feed)}`, ...(edit ? { edit_url: `${SITE_URL}${editPath(id, edit)}` } : {}) });

/** Constant-time edit check; unknown ids and wrong tokens look the same. */
export async function authorize(store: WatchStore, id: unknown, token: unknown): Promise<WatchRecord | null> {
  if (typeof id !== "string" || typeof token !== "string" || !TOKEN_RE.test(id) || !TOKEN_RE.test(token)) return null;
  const rec = await store.get(id);
  const hash = await sha256Hex(token);
  return rec && safeEqual(hash, rec.edit_token_sha256) ? rec : null;
}

export async function createWatch(input: unknown, ip: string, d: WatchDeps) {
  if (!d.allow(ip)) return LIMITED;
  const p = createSchema.safeParse(input);
  if (!p.success) return invalid("Check the name, sites and signals.");
  const ctx = await ctxFor(d.store, p.data.sites, p.data.traits);
  const r = initialState(p.data, ctx);
  if (r.error) return invalid(EDIT_MESSAGES[r.error]);
  const id = newToken(d.rand), edit = newToken(d.rand);
  let feed = newToken(d.rand); while (feed === id) feed = newToken(d.rand);
  const at = d.now().toISOString();
  const rec: WatchRecord = { id, ...r.state, feed_token: feed, created_at: at, updated_at: at, edit_token_sha256: await sha256Hex(edit), last_viewed_at: null };
  await d.store.insert(rec);
  if (r.queued.length) await d.store.queueRenders(r.queued);
  return { ok: true as const, id, edit_token: edit, ...links(id, feed, edit), watch: toPublic(rec), classified: r.classified, queued: r.queued };
}

export async function editWatch(input: { id: unknown; token: unknown; op: unknown }, ip: string, d: WatchDeps) {
  if (!d.allow(ip)) return LIMITED;
  const rec = await authorize(d.store, input.id, input.token);
  if (!rec) return NOT_FOUND;
  const p = opSchema.safeParse(input.op);
  if (!p.success) return invalid("That change isn't valid.");
  const op = p.data, at = d.now().toISOString();
  if (op.op === "delete") { await d.store.remove(rec.id); return { ok: true as const, deleted: true as const }; }
  if (op.op === "rotate_feed") {
    let feed = newToken(d.rand); while (feed === rec.feed_token || feed === rec.id) feed = newToken(d.rand);
    const next = await d.store.update(rec.id, { feed_token: feed, updated_at: at });
    return next ? { ok: true as const, watch: toPublic(next), feed_url: `${SITE_URL}${feedPath(feed)}`, classified: null as Classified | null, queued: [] as string[] } : NOT_FOUND;
  }
  const add = op.op === "add" || op.op === "remove";
  const ctx = await ctxFor(d.store, add ? op.sites ?? [] : [], add ? op.traits ?? [] : [], rec.pending_sites);
  const r = applyOp(state(rec), op, ctx);
  if (r.error) return { ...invalid(EDIT_MESSAGES[r.error]), classified: r.classified };
  const next = await d.store.update(rec.id, { ...r.state, updated_at: at });
  if (!next) return NOT_FOUND;
  if (r.queued.length) await d.store.queueRenders(r.queued);
  return { ok: true as const, watch: toPublic(next), feed_url: `${SITE_URL}${feedPath(next.feed_token)}`, classified: r.classified, queued: r.queued };
}

export async function checkEdit(input: { id: unknown; token: unknown }, ip: string, d: WatchDeps) {
  if (!d.allow(ip)) return false;
  return !!(await authorize(d.store, input.id, input.token));
}

/** Read for the (password-gated) watch page; pending sites that became tracked are promoted. */
export async function viewWatch(id: unknown, range: WatchRange, d: Pick<WatchDeps, "store" | "now" | "load">) {
  if (typeof id !== "string" || !TOKEN_RE.test(id)) return null;
  let rec = await d.store.get(id);
  if (!rec) return null;
  const now = d.now();
  if (rec.pending_sites.length) {
    const active = await d.store.activeDomains(rec.pending_sites), next = promote(state(rec), active);
    if (next.pending_sites.length !== rec.pending_sites.length) rec = (await d.store.update(rec.id, { sites: next.sites, pending_sites: next.pending_sites })) ?? rec;
  }
  await d.store.touch(rec.id, now.toISOString());
  return watchView(await d.load(toPublic(rec), now), range);
}

/** Feed items by capability token (MCP + RSS); null for unknown or rotated tokens. */
export async function feedRows(token: unknown, d: Pick<WatchDeps, "store" | "now" | "load">) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const rec = await d.store.byFeed(token);
  if (!rec || !safeEqual(rec.feed_token, token)) return null;
  return d.load(toPublic(rec), d.now());
}
export async function feedItems(token: unknown, d: Pick<WatchDeps, "store" | "now" | "load">) {
  const rows = await feedRows(token, d);
  return rows ? { name: rows.watch.name, page_url: `${SITE_URL}${viewPath(rows.watch.id)}`, items: watchItems(rows, sinceFor(rows.now, "30d")).slice(0, FEED_MAX) } : null;
}
const feedNotFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
export async function handleWatchFeed(param: string, d: Pick<WatchDeps, "store" | "now" | "load">): Promise<Response> {
  try {
    const m = /^([A-Za-z0-9_-]{22})(?:\.xml)?$/.exec(param);
    const rows = m ? await feedRows(m[1], d) : null;
    if (!rows) return feedNotFound();
    return new Response(watchFeedXml(rows), { headers: WATCH_FEED_HEADERS });
  } catch (e) {
    console.error("watch feed failed", e instanceof Error ? e.message : "unknown");
    return new Response("Feed unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}

// ---- production wiring (service role for the private watchlists table; public reads stay anonymous) ----
type Row = { id: string; name: string; sites: string[]; pending_sites: string[]; traits: string[]; sectors: string[]; created_at: string; updated_at: string; edit_token_sha256: string; feed_token: string; last_viewed_at: string | null };
const COLS = "id,name,sites,pending_sites,traits,sectors,created_at,updated_at,edit_token_sha256,feed_token,last_viewed_at";
export function adminWatchStore(): WatchStore {
  const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const one = (r: { data: unknown; error: unknown }) => { if (r.error) throw r.error; return (r.data as Row | null) ?? null; };
  return {
    insert: async rec => { const r = await (await admin()).from("watchlists").insert(rec); if (r.error) throw r.error; },
    get: async id => one(await (await admin()).from("watchlists").select(COLS).eq("id", id).maybeSingle()),
    byFeed: async t => one(await (await admin()).from("watchlists").select(COLS).eq("feed_token", t).maybeSingle()),
    update: async (id, patch) => one(await (await admin()).from("watchlists").update(patch).eq("id", id).select(COLS).maybeSingle()),
    remove: async id => { const r = await (await admin()).from("watchlists").delete().eq("id", id); if (r.error) throw r.error; },
    touch: async (id, at) => { await (await admin()).from("watchlists").update({ last_viewed_at: at }).eq("id", id); },
    activeDomains: async domains => {
      const { supabaseAnon } = await import("../mcp/supabase");
      const r = await supabaseAnon().from("library_sites").select("domain").eq("active", true).in("domain", domains.slice(0, 100));
      if (r.error) throw r.error; return new Set((r.data ?? []).map(x => x.domain));
    },
    traitKeys: async keys => {
      const { supabaseAnon } = await import("../mcp/supabase");
      const byDim = new Map<string, string[]>();
      for (const k of keys) { const i = k.indexOf(":"); byDim.set(k.slice(0, i), [...(byDim.get(k.slice(0, i)) ?? []), k.slice(i + 1)]); }
      const out = new Set<string>();
      for (const [dim, values] of byDim) {
        const r = await supabaseAnon().from("forecast_latest").select("dimension,value").eq("scope", "all").eq("dimension", dim).in("value", values.slice(0, 50));
        if (r.error) throw r.error; for (const x of r.data ?? []) out.add(`${x.dimension}:${x.value}`);
      }
      return out;
    },
    queueRenders: domains => queueRenders(domains),
  };
}
/** Existing LITE render queue: one pending row per homepage URL (duplicates ignored). */
export async function queueRenders(domains: string[]) {
  if (!domains.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const r = await supabaseAdmin.from("crawl_requests").upsert(domains.slice(0, 25).map(d => ({ url: `https://${d}/`, domain: d, status: "pending" })), { onConflict: "url", ignoreDuplicates: true });
  if (r.error) throw r.error;
}

const editLimiter = createRateLimiter(WATCH_LIMITS.editsPerHour, WATCH_WINDOW_MS);
const checkLimiter = createRateLimiter(240, WATCH_WINDOW_MS);
export async function prodDeps(kind: "edit" | "check" = "edit"): Promise<WatchDeps> {
  const { loadWatchRows } = await import("./watch-data.server");
  return { store: adminWatchStore(), allow: kind === "edit" ? editLimiter : checkLimiter, now: () => new Date(), load: loadWatchRows };
}
