// Pure contracts for crawler-secret wire ingestion (Bluesky items + Jetstream mention windows). No I/O.
import { z } from "zod";
import { stripHtml, tagText, WIRE_WINDOW_DAYS, DAY } from "./ingest";
import { TOTAL_TERM, type CountRow } from "./discourse";

export const WIRE_INGEST_BODY_LIMIT = 256 * 1024;
export const MAX_ITEMS = 200, MAX_COUNT_KEYS = 600, MAX_WINDOW_MS = 7 * DAY;
const iso = z.iso.datetime({ offset: true });
const httpUrl = z.url({ protocol: /^https?$/ }).max(2048);
export const BSKY_POST = /^https:\/\/bsky\.app\/profile\/[A-Za-z0-9._:%-]{1,253}\/post\/[A-Za-z0-9]{1,64}$/;
const item = z.object({
  source_kind: z.literal("bluesky"),
  url: z.string().max(400).regex(BSKY_POST, "Expected https://bsky.app/profile/<did-or-handle>/post/<rkey>"),
  title: z.string().min(1).max(300),
  author: z.string().min(1).max(100),
  published_at: iso,
  link: httpUrl.optional(),
  terms: z.array(z.string().min(1).max(100)).max(20).optional(),
}).strict();
const count = z.object({ n: z.number().int().min(0).max(10_000_000), fatigue: z.number().int().min(0).max(10_000_000) }).strict()
  .refine(c => c.fatigue <= c.n, { message: "fatigue must be ≤ n" });
const mentions = z.object({
  kind: z.literal("mentions"), window_start: iso, window_end: iso,
  sampled_posts: z.number().int().min(0).max(100_000_000), design_posts: z.number().int().min(0).max(100_000_000),
  counts: z.record(z.string().min(1).max(100).refine(k => k.trim() !== TOTAL_TERM, { message: "'*' is reserved" }), count),
}).strict().superRefine((m, ctx) => {
  const start = Date.parse(m.window_start), end = Date.parse(m.window_end);
  if (!(end > start)) ctx.addIssue({ code: "custom", path: ["window_end"], message: "window_end must be after window_start" });
  else if (end - start > MAX_WINDOW_MS) ctx.addIssue({ code: "custom", path: ["window_end"], message: "window must be at most 7 days" });
  if (m.design_posts > m.sampled_posts) ctx.addIssue({ code: "custom", path: ["design_posts"], message: "design_posts must be ≤ sampled_posts" });
  const keys = Object.keys(m.counts);
  if (keys.length > MAX_COUNT_KEYS) ctx.addIssue({ code: "custom", path: ["counts"], message: `at most ${MAX_COUNT_KEYS} terms` });
  for (const k of keys) if (m.counts[k]!.n > m.sampled_posts) { ctx.addIssue({ code: "custom", path: ["counts", k, "n"], message: "n must be ≤ sampled_posts" }); break; }
});
export const wireIngestPayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("items"), items: z.array(item).min(1).max(MAX_ITEMS) }).strict(),
  mentions,
]);
export type WireIngestPayload = z.infer<typeof wireIngestPayload>;
type BskyItem = z.infer<typeof item>;

export type WireRow = { url: string; title: string; source: string; source_kind: string; published_at: string; excerpt: string | null; link: string | null; tags: string[] };
/** Public projection: headline + source + link only. Items older than the wire window or >1h in the future are skipped. */
export function blueskyRows(items: BskyItem[], now: number): { rows: WireRow[]; skipped: { url: string; reason: string }[] } {
  const rows = new Map<string, WireRow>(), skipped: { url: string; reason: string }[] = [];
  for (const i of items) {
    const t = Date.parse(i.published_at);
    if (t < now - WIRE_WINDOW_DAYS * DAY) { skipped.push({ url: i.url, reason: "stale" }); continue; }
    if (t > now + 3600_000) { skipped.push({ url: i.url, reason: "future" }); continue; }
    const title = stripHtml(i.title, 300);
    if (!title) { skipped.push({ url: i.url, reason: "empty_title" }); continue; }
    const handle = i.author.replace(/^@+/, "").trim().slice(0, 100);
    rows.set(i.url, { url: i.url, title, source: `Bluesky @${handle}`, source_kind: "bluesky", published_at: new Date(t).toISOString(), excerpt: null, link: i.link ?? null, tags: tagText(title) });
  }
  return { rows: [...rows.values()], skipped };
}
/** Replace-mode rows for one sampled window: a '*' total row plus one row per term. */
export function mentionRows(m: Extract<WireIngestPayload, { kind: "mentions" }>): CountRow[] {
  const base = { source: "bluesky", window_start: new Date(m.window_start).toISOString(), window_end: new Date(m.window_end).toISOString(), sampled_posts: m.sampled_posts, design_posts: m.design_posts };
  const merged = new Map<string, { n: number; fatigue: number }>();
  for (const [k, c] of Object.entries(m.counts)) { const term = k.trim(), p = merged.get(term) ?? { n: 0, fatigue: 0 }; merged.set(term, { n: Math.max(p.n, c.n), fatigue: Math.max(p.fatigue, c.fatigue) }); }
  return [{ ...base, term: TOTAL_TERM, n: m.design_posts, fatigue: 0 }, ...[...merged].map(([term, c]) => ({ ...base, term, ...c }))];
}
