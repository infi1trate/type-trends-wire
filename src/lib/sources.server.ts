// Polled wire sources: Product Hunt (daily, dormant without a token). Are.na is hard-off (ARENA_ENABLED in sources.ts).
// Only titles, links and channel names are stored; images are never fetched or persisted.
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { insertWireRows, logRun } from "./ingest.server";
import { ARENA_DISABLED_REASON, ARENA_ENABLED, ARENA_BLOCKS_PER_CHANNEL, ARENA_MAX_REQUESTS, ARENA_QUERIES, PH_QUERY, PH_QUERY_NO_TOPICS, arenaRows, cleanWebsite, parsePhPosts, inPhDay, phDayWindow, phRefused, phRows, pickArenaChannels, type ArenaChannel, type PhWindow } from "./sources";
import type { WireRow } from "./wire-payload";
import type { Json } from "@/integrations/supabase/types";

const UA = "dsgn-terminal/0.1 (+https://brandon.wtf)";
type Cursor = { key: string; etag: string | null; last_modified: string | null; state: Json | null };

/** Conditional GET with a per-run request budget; 304 keeps the stored cursor (and any cached discovery state). */
class Poller {
  used = 0; private cursors = new Map<string, Cursor>(); private dirty = new Map<string, Cursor>();
  constructor(private max: number, private headers: Record<string, string>) {}
  async load(prefix: string) {
    const { data, error } = await db.from("source_cursors").select("key,etag,last_modified,state").like("key", `${prefix}%`).limit(500);
    if (error) throw new Error("Source cursor lookup failed");
    for (const c of data ?? []) this.cursors.set(c.key, c);
  }
  cursor(key: string) { return this.cursors.get(key); }
  async get(key: string, url: string): Promise<{ status: 304; cursor: Cursor } | { status: number; json: unknown }> {
    if (this.used >= this.max) throw new Error("request budget exhausted");
    this.used++;
    const prev = this.cursors.get(key), headers: Record<string, string> = { ...this.headers, accept: "application/json" };
    if (prev?.etag) headers["if-none-match"] = prev.etag;
    if (prev?.last_modified) headers["if-modified-since"] = prev.last_modified;
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (r.status === 304 && prev) return { status: 304, cursor: prev };
    if (!r.ok) return { status: r.status, json: null };
    const json = await r.json();
    this.remember({ key, etag: r.headers.get("etag"), last_modified: r.headers.get("last-modified"), state: prev?.state ?? null });
    return { status: r.status, json };
  }
  remember(c: Cursor) { this.cursors.set(c.key, c); this.dirty.set(c.key, c); }
  async save() {
    const rows = [...this.dirty.values()].map(c => ({ ...c, updated_at: new Date().toISOString() }));
    if (rows.length) { const { error } = await db.from("source_cursors").upsert(rows, { onConflict: "key" }); if (error) throw new Error("Source cursor write failed"); }
  }
}

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>) { for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run)); }

export async function ingestArena() {
  if (!ARENA_ENABLED) return Response.json({ ok: false, disabled: true, reason: ARENA_DISABLED_REASON }, { status: 403 });
  const started = new Date(), failures: string[] = [];
  let written = 0;
  try {
    const token = process.env["ARENA_TOKEN"];
    const poller = new Poller(ARENA_MAX_REQUESTS, { "user-agent": UA, ...(token ? { authorization: `Bearer ${token}` } : {}) });
    await poller.load("arena:");
    const channels = new Map<string, ArenaChannel>();
    // v3 search needs a token; without one, discovery uses the public v2 channel search. Block reads use v3.
    await pool([...ARENA_QUERIES], 3, async q => {
      const key = `arena:search:${q}`, url = token ? `https://api.are.na/v3/search?query=${encodeURIComponent(q)}&type=Channel&per=10` : `https://api.are.na/v2/search/channels?q=${encodeURIComponent(q)}&per=10`;
      try {
        const res = await poller.get(key, url);
        let picked: ArenaChannel[];
        if ("cursor" in res) picked = (res.cursor.state as { channels?: ArenaChannel[] } | null)?.channels ?? [];
        else {
          if (!res.json) throw new Error(`HTTP ${res.status}`);
          picked = pickArenaChannels(res.json);
          const c = poller.cursor(key); if (c) poller.remember({ ...c, state: { channels: picked } as unknown as Json });
        }
        for (const c of picked) if (!channels.has(c.slug)) channels.set(c.slug, c);
      } catch (e) { failures.push(`search "${q}": ${e instanceof Error ? e.message : String(e)}`); }
    });
    const rows = new Map<string, WireRow>();
    const now = Date.now();
    await pool([...channels.values()], 3, async ch => {
      try {
        const res = await poller.get(`arena:channel:${ch.slug}`, `https://api.are.na/v3/channels/${encodeURIComponent(ch.slug)}/contents?per=${ARENA_BLOCKS_PER_CHANNEL}&sort=position_desc`);
        if ("cursor" in res) return;
        if (!res.json) throw new Error(`HTTP ${res.status}`);
        for (const r of arenaRows(res.json, ch, now)) if (!rows.has(r.url)) rows.set(r.url, r);
      } catch (e) { failures.push(`channel ${ch.slug}: ${e instanceof Error ? e.message : String(e)}`); }
    });
    if (poller.used && failures.length >= poller.used) throw new Error("All Are.na requests failed");
    const result = await insertWireRows([...rows.values()], failures);
    written = result.written;
    await poller.save();
    const detail = { failures, requests: poller.used, channels: channels.size, seen: rows.size, discourse_rows: result.discourse_rows, discovery: token ? "v3" : "v2-public" };
    await logRun("ingest-arena", started, true, written, detail);
    return Response.json({ ok: true, rows_written: written, ...detail });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown ingestion error";
    await logRun("ingest-arena", started, false, written, { failures, error });
    return Response.json({ ok: false, error, failures }, { status: 500 });
  }
}

/** PH1 · one GraphQL call (a second only when the API refuses the topics part); the rate-limit headers are kept so the cost is visible. */
export async function fetchPhDay(token: string, w: PhWindow, withTopics = true) {
  const call = async (query: string) => {
    const r = await fetch("https://api.producthunt.com/v2/api/graphql", { method: "POST", signal: AbortSignal.timeout(15000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json", "user-agent": UA },
      body: JSON.stringify({ query, variables: { after: w.after, before: w.before } }) });
    // Provider error bodies may echo request details; keep only the status.
    if (!r.ok) throw new Error(`Product Hunt: HTTP ${r.status}`);
    const n = (h: string) => { const v = r.headers.get(h); return v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v); };
    return { json: await r.json() as unknown, rate: { limit: n("x-rate-limit-limit"), remaining: n("x-rate-limit-remaining"), reset_s: n("x-rate-limit-reset") } };
  };
  let res = withTopics ? await call(PH_QUERY) : await call(PH_QUERY_NO_TOPICS), topics = withTopics;
  if (withTopics && phRefused(res.json)) { res = await call(PH_QUERY_NO_TOPICS); topics = false; }
  if (phRefused(res.json)) throw new Error("Product Hunt: query refused");
  return { posts: parsePhPosts(res.json), topics_read: topics, rate: res.rate };
}

export async function ingestProductHunt() {
  const started = new Date(), failures: string[] = [];
  const token = process.env["PRODUCT_HUNT_TOKEN"];
  if (!token) return Response.json({ ok: true, dormant: true, reason: "PRODUCT_HUNT_TOKEN not set" });
  let written = 0;
  try {
    const w = phDayWindow(started.getTime());
    const day = await fetchPhDay(token, w), { topics_read, rate } = day, posts = day.posts.filter(p => inPhDay(p, w));
    const resolved = new Map<string, string | null>();
    // Website fields are producthunt.com redirects; read one Location hop from Product Hunt only (no request to the target site).
    await pool(posts, 6, async p => {
      if (!p.website) { resolved.set(p.url, null); return; }
      try {
        const host = new URL(p.website).hostname;
        if (!/(^|\.)producthunt\.com$/i.test(host)) { resolved.set(p.url, cleanWebsite(p.website)); return; }
        const hop = await fetch(p.website, { redirect: "manual", headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
        await hop.body?.cancel();
        const loc = hop.headers.get("location");
        resolved.set(p.url, loc ? cleanWebsite(new URL(loc, p.website).href) : null);
      } catch { resolved.set(p.url, null); failures.push(`website ${p.name}`); }
    });
    const rows = phRows(posts, resolved, w);
    // A launch read earlier (before its day finished) is already stored: its votes, topics, date and excerpt are brought up to the finished day.
    const { data: had, error: hadErr } = rows.length ? await db.from("wire_items").select("url").in("url", rows.map(r => r.url)) : { data: [], error: null };
    if (hadErr) throw new Error("Product Hunt: stored launch lookup failed");
    const known = new Set((had ?? []).map(r => r.url));
    const result = await insertWireRows(rows.filter(r => !known.has(r.url)), failures);
    let updated = 0;
    for (const r of rows.filter(x => known.has(x.url))) {
      const { error } = await db.from("wire_items").update({ votes: r.votes ?? null, topics: r.topics ?? null, excerpt: r.excerpt, published_at: r.published_at, link: r.link }).eq("url", r.url).eq("source_kind", "producthunt");
      if (error) failures.push(`update ${r.title.slice(0, 40)}`); else updated++;
    }
    written = result.written;
    const detail = { failures, seen: posts.length, next_day: day.posts.length - posts.length, day: w.day, window: { after: w.after, before: w.before }, topics_read, rate, updated, discourse_rows: result.discourse_rows };
    await logRun("ingest-producthunt", started, true, written, detail);
    return Response.json({ ok: true, seen: posts.length, rows_written: written, updated, day: w.day, topics_read, posts: posts.map(p => ({ votes: p.votes, topics: p.topics })), failures });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown ingestion error";
    await logRun("ingest-producthunt", started, false, written, { failures, error });
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
