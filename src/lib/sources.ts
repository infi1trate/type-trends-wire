// Pure parsing for polled wire sources (Are.na, Product Hunt) and curated-index seed candidates. No I/O.
import { getDomain } from "tldts";
import { stripHtml, tagText, WIRE_WINDOW_DAYS, DAY } from "./ingest";
import type { WireRow } from "./wire-payload";

/**
 * HARD OFF. Are.na's acceptable-use policy (https://www.are.na/terms) prohibits automated crawling and
 * structured data harvesting, so this app does not poll Are.na. The adapter is kept for reference only;
 * do not flip this without written permission from Are.na.
 */
export const ARENA_ENABLED = false as boolean;
export const ARENA_DISABLED_REASON = "Are.na polling is disabled: its acceptable-use policy prohibits automated crawling and structured data harvesting";
export const SEED_SOURCES = ["producthunt"] as const;
export const ARENA_QUERIES = ["web design", "typography", "type specimen", "brand identity", "ui design", "graphic design", "websites"] as const;
export const ARENA_MAX_REQUESTS = 60, ARENA_CHANNELS_PER_QUERY = 2, ARENA_BLOCKS_PER_CHANNEL = 24;
export type ArenaChannel = { slug: string; title: string; followers: number; updated_at: string | null };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown) => (typeof v === "string" ? v : null);

/** Public channel search results → top channels by followers then recency. Accepts v2 (`channels`) and v3 (`data`) shapes. */
export function pickArenaChannels(json: unknown, per = ARENA_CHANNELS_PER_QUERY): ArenaChannel[] {
  const list = Array.isArray(o(json)["channels"]) ? (o(json)["channels"] as unknown[]) : Array.isArray(o(json)["data"]) ? (o(json)["data"] as unknown[]) : [];
  return list.map(o).filter(c => s(c["slug"]) && (c["status"] ?? c["visibility"]) !== "private")
    .map(c => ({ slug: s(c["slug"])!, title: stripHtml(s(c["title"]) ?? s(c["slug"]), 120) ?? s(c["slug"])!, followers: Number(c["follower_count"] ?? o(c["counts"])["followers"] ?? 0) || 0, updated_at: s(c["updated_at"]) }))
    .sort((a, b) => b.followers - a.followers || (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, per);
}

const FILE_NAME = /\.(jpe?g|png|gif|webp|avif|svg|heic|tiff?)(\?.*)?$/i;
const JUNK_SOURCE = /^(?:[a-z0-9-]+\.)*(google\.[a-z.]+|pinterest\.[a-z.]+|pinimg\.com|are\.na|cloudfront\.net)$/i;
/** Link/Image blocks with a public original source → wire rows (no image URLs stored). Only blocks connected within the wire window. */
export function arenaRows(json: unknown, channel: ArenaChannel, now: number): WireRow[] {
  const out: WireRow[] = [];
  for (const raw of Array.isArray(o(json)["data"]) ? (o(json)["data"] as unknown[]) : []) {
    const b = o(raw), src = o(b["source"]), url = s(src["url"]);
    if (!["Link", "Image"].includes(String(b["type"])) || (b["visibility"] && b["visibility"] !== "public") || !url || !/^https?:\/\//.test(url) || url.length > 2048) continue;
    let host: string; try { host = new URL(url).hostname; } catch { continue; }
    if (JUNK_SOURCE.test(host)) continue;
    const when = s(o(b["connection"])["connected_at"]) ?? s(b["created_at"]); const t = when ? Date.parse(when) : NaN;
    if (Number.isNaN(t) || t < now - WIRE_WINDOW_DAYS * DAY || t > now + 3600_000) continue;
    const blockTitle = s(b["title"]), title = stripHtml(blockTitle && !FILE_NAME.test(blockTitle) ? blockTitle : s(src["title"]), 300);
    if (!title) continue;
    const excerpt = stripHtml(s(b["description"]));
    out.push({ url, title, source: `Are.na · ${channel.title}`.slice(0, 100), source_kind: "arena", published_at: new Date(t).toISOString(), excerpt, link: url, tags: tagText(`${title} ${excerpt ?? ""}`) });
  }
  return out;
}

// PH1 · Product Hunt is read once a day for the Pacific day that has just ended (its launch day runs midnight to midnight in
// Los Angeles), ordered by votes, so every count is a finished day's count and never the first minutes of a new day.
export { PH_TZ, pacificMidnight, pacificDay, phDayWindow, type PhWindow } from "./launches";
import type { PhWindow } from "./launches";
export const PH_FIRST = 20, PH_TOPICS_FIRST = 10;
const POST_FIELDS = "id name tagline url website votesCount createdAt";
export const PH_QUERY = `query FinishedDay($after: DateTime!, $before: DateTime!) { posts(order: VOTES, first: ${PH_FIRST}, postedAfter: $after, postedBefore: $before) { edges { node { ${POST_FIELDS} topics(first: ${PH_TOPICS_FIRST}) { edges { node { name slug } } } } } } }`;
/** The same day without topics, asked only when the API refuses the topics query (its posts then carry topics: null). */
export const PH_QUERY_NO_TOPICS = `query FinishedDay($after: DateTime!, $before: DateTime!) { posts(order: VOTES, first: ${PH_FIRST}, postedAfter: $after, postedBefore: $before) { edges { node { ${POST_FIELDS} } } } }`;
export type PhTopic = { name: string; slug: string };
export type PhPost = { name: string; tagline: string; url: string; website: string | null; votes: number; created_at: string;
  /** Topic slugs; null when the answer carried no topics field (topics were not read), [] when the post has none. */ topics: string[] | null; topic_names: string[] };
/** Posts with a name, link and time, most votes first (ties by name), topics parsed when the field was asked for. */
export function parsePhPosts(json: unknown): PhPost[] {
  const edges = o(o(o(json)["data"])["posts"])["edges"];
  return (Array.isArray(edges) ? edges : []).map(e => o(o(e)["node"])).filter(n => s(n["name"]) && s(n["url"]) && s(n["createdAt"]))
    .map(n => {
      const te = n["topics"] == null ? null : o(n["topics"])["edges"];
      const topics: PhTopic[] | null = te == null ? null : (Array.isArray(te) ? te : []).map(e => o(o(e)["node"])).filter(t => s(t["slug"])).map(t => ({ name: s(t["name"]) ?? s(t["slug"])!, slug: s(t["slug"])!.toLowerCase() }));
      return { name: s(n["name"])!, tagline: s(n["tagline"]) ?? "", url: s(n["url"])!, website: s(n["website"]), votes: Number(n["votesCount"] ?? 0) || 0, created_at: s(n["createdAt"])!,
        topics: topics ? topics.map(t => t.slug) : null, topic_names: topics ? topics.map(t => t.name) : [] };
    })
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
}
/** True when the API answered with errors and no posts (the topics query refused): ask again without topics. */
export const phRefused = (json: unknown) => Array.isArray(o(json)["errors"]) && !Array.isArray(o(o(o(json)["data"])["posts"])["edges"]);
/** Product Hunt redirect targets carry tracking params; keep origin + path only. */
export function cleanWebsite(url: string | null): string | null {
  if (!url) return null;
  try { const u = new URL(url); if (!/^https?:$/.test(u.protocol) || /(^|\.)producthunt\.com$/i.test(u.hostname)) return null; return `${u.origin}${u.pathname}`.slice(0, 2048); } catch { return null; }
}
/** The API's postedBefore takes posts made at the very instant the next day starts; those belong to the next day's read. */
export const inPhDay = (p: Pick<PhPost, "created_at">, w: PhWindow) => { const t = Date.parse(p.created_at); return t >= Date.parse(w.after) && t < Date.parse(w.before); };
/** Wire rows for one finished day: the launch's date is its launch time inside that day, with its votes and topics. */
export function phRows(posts: PhPost[], resolved: Map<string, string | null>, w?: PhWindow): WireRow[] {
  return posts.filter(p => !w || inPhDay(p, w)).map(p => {
    const site = resolved.get(p.url) ?? null, title = stripHtml(`${p.name}${p.tagline ? ` — ${p.tagline}` : ""}`, 300) ?? p.name;
    const t = Date.parse(p.created_at);
    return { url: p.url, title, source: "Product Hunt", source_kind: "producthunt", published_at: new Date(t).toISOString(),
      excerpt: `${p.votes} upvotes${site ? ` · ${new URL(site).hostname}` : ""}`, link: site, tags: tagText(`${p.name} ${p.tagline}`), votes: p.votes, topics: p.topics };
  });
}

// Seed candidates for the curated crawl index.
export const SEED_WINDOW_DAYS = 30, SEED_MAX = 300;
const EXCLUDED_DOMAINS = new Set([
  "twitter.com", "x.com", "instagram.com", "facebook.com", "fb.com", "threads.net", "tiktok.com", "linkedin.com", "youtube.com", "youtu.be", "vimeo.com", "reddit.com", "pinterest.com", "tumblr.com", "bsky.app", "mastodon.social", "behance.net", "dribbble.com", "medium.com", "substack.com", "discord.com", "discord.gg", "t.me", "telegram.org", "whatsapp.com", "snapchat.com", "twitch.tv",
  "github.com", "github.io", "gitlab.com", "bitbucket.org", "vercel.app", "netlify.app", "netlify.com", "herokuapp.com", "pages.dev", "workers.dev", "web.app", "firebaseapp.com", "glitch.me", "replit.app", "repl.co", "lovable.app", "framer.website", "framer.app", "webflow.io", "wixsite.com", "squarespace.com", "carrd.co", "notion.site", "notion.so", "super.site", "wordpress.com", "blogspot.com", "gumroad.com", "linktr.ee", "bit.ly", "typedream.app", "read.cv", "cargo.site", "myportfolio.com", "readymag.website",
  "apple.com", "apps.apple.com", "play.google.com", "chrome.google.com", "chromewebstore.google.com", "microsoft.com", "amazon.com", "google.com", "goo.gl", "producthunt.com", "are.na", "figma.com", "wikipedia.org", "archive.org", "cloudfront.net", "amazonaws.com", "googleusercontent.com",
]);
/** Registrable (eTLD+1) domain, or null for IPs, hosting/social/app-store hosts and unparsable URLs. */
export function seedDomain(url: string): string | null {
  let host: string; try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (/^[\d.]+$/.test(host) || host.includes(":")) return null;
  const domain = getDomain(host, { allowPrivateDomains: true });
  if (!domain) return null;
  if (EXCLUDED_DOMAINS.has(domain) || EXCLUDED_DOMAINS.has(host) || [...EXCLUDED_DOMAINS].some(d => host.endsWith(`.${d}`))) return null;
  return domain;
}
export type SeedCandidate = { domain: string; sources: (typeof SEED_SOURCES[number])[]; first_seen: string };
export function seedCandidates(rows: { link: string | null; source_kind: string; fetched_at: string }[], max = SEED_MAX): SeedCandidate[] {
  const by = new Map<string, { sources: Set<typeof SEED_SOURCES[number]>; first: string }>();
  for (const r of rows) {
    if (!r.link || r.source_kind !== "producthunt") continue; // Are.na is not used (see ARENA_ENABLED)
    const d = seedDomain(r.link); if (!d) continue;
    const e = by.get(d) ?? { sources: new Set(), first: r.fetched_at }; e.sources.add(r.source_kind as typeof SEED_SOURCES[number]); if (r.fetched_at < e.first) e.first = r.fetched_at; by.set(d, e);
  }
  return [...by].map(([domain, e]) => ({ domain, sources: [...e.sources].sort(), first_seen: new Date(e.first).toISOString() }))
    .sort((a, b) => b.first_seen.localeCompare(a.first_seen) || a.domain.localeCompare(b.domain)).slice(0, max);
}
