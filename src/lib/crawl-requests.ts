// Pure contract for the crawler's LITE render queue (/api/public/crawl-requests).
import { z } from "zod";

export const CRAWL_REQUESTS_BODY_LIMIT = 64 * 1024;
export const CRAWL_REQUESTS_MAX_BATCH = 25;
export const CRAWL_REQUESTS_DEFAULT_LIMIT = 10;
/** An errored request is retried until it has been attempted this many times. */
export const CRAWL_REQUEST_MAX_ATTEMPTS = 3;

/** `?limit=` → 1..25 (default 10); anything else is rejected (null). */
export function parseRequestLimit(raw: string | null): number | null {
  if (raw === null || raw === "") return CRAWL_REQUESTS_DEFAULT_LIMIT;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= CRAWL_REQUESTS_MAX_BATCH ? n : null;
}

export const crawlResultsSchema = z.object({
  results: z.array(z.object({
    url: z.string().url().max(2048),
    status: z.enum(["done", "error"]),
    error: z.string().max(300).optional(),
    // Rendered analyzePage output; the 64 KB body cap bounds its size.
    signals: z.record(z.string(), z.unknown()).optional(),
  }).strict().superRefine((r, ctx) => {
    if (r.status === "error" && r.signals !== undefined) ctx.addIssue({ code: "custom", path: ["signals"], message: "signals are only accepted with status 'done'" });
  })).min(1).max(CRAWL_REQUESTS_MAX_BATCH),
}).strict().refine(v => new Set(v.results.map(r => r.url)).size === v.results.length, "Duplicate url in results");
export type CrawlResult = z.infer<typeof crawlResultsSchema>["results"][number];

export type CrawlRequestUpdate = { status: "pending" | "done" | "error"; attempts: number; done_at: string | null; last_error: string | null; signals?: Record<string, unknown>; rendered_at?: string };
/** done → done (storing signals + rendered_at when sent); error → back to pending while attempts (after this one) < 3, otherwise error. */
export function nextCrawlRequestState(attempts: number, result: Pick<CrawlResult, "status" | "error" | "signals">, now: string): CrawlRequestUpdate {
  const next = attempts + 1;
  if (result.status === "done") return { status: "done", attempts: next, done_at: now, last_error: null, ...(result.signals ? { signals: result.signals, rendered_at: now } : {}) };
  return { status: next < CRAWL_REQUEST_MAX_ATTEMPTS ? "pending" : "error", attempts: next, done_at: null, last_error: (result.error ?? "unspecified crawler error").slice(0, 300) };
}

/** Rendered results older than this are stale: used no longer, and the URL is re-queued when analysed again. */
export const RENDERED_MAX_AGE_MS = 30 * 864e5;
export const QUEUED_NOTE = "queued — rendered result usually within ~2 hours";

/** Public callers (critique/differentiate) may only add new URLs to the render queue within these bounds, so nobody can point the crawler at an unbounded list of sites. */
export const PUBLIC_QUEUE_MAX_PENDING = 50;
export const PUBLIC_QUEUE_MAX_PER_DAY = 100;
export const PUBLIC_QUEUE_FULL = "The rendering queue is full right now; try this URL again tomorrow";
/** Refuse a new public queue entry when the backlog or the last 24 hours' additions are at their caps; counts that could not be read refuse (fail closed). */
export function publicQueueAllowed(pending: number | null, lastDay: number | null): boolean {
  if (pending === null || lastDay === null || !Number.isFinite(pending) || !Number.isFinite(lastDay)) return false;
  return pending < PUBLIC_QUEUE_MAX_PENDING && lastDay < PUBLIC_QUEUE_MAX_PER_DAY;
}

/** host (lowercase, no www.) + path without trailing slashes; protocol, query and fragment ignored. */
export function urlKey(raw: string): string {
  const u = new URL(raw), path = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.hostname.toLowerCase().replace(/^www\./, "")}${path}`;
}

export type CrawlRow = { url: string; status: string; signals?: unknown; rendered_at?: string | null; done_at?: string | null };
export type CrawlState = "rendered" | "stale" | "pending" | "error" | "done_empty" | "none";
/**
 * Pick the queue row for a URL: exact URL first, then same host+path. A done row with signals rendered
 * within 30 days is used; a done row older than that (or never rendered) is stale and should be re-queued.
 */
export function pickCrawlRow<T extends CrawlRow>(rows: T[], raw: string, now: number): { state: CrawlState; row: T | null } {
  const key = urlKey(raw), matching = rows.filter(r => { try { return urlKey(r.url) === key; } catch { return false; } })
    .sort((a, b) => Number(b.url === raw) - Number(a.url === raw) || String(b.rendered_at ?? b.done_at ?? "").localeCompare(String(a.rendered_at ?? a.done_at ?? "")));
  const age = (r: T) => { const at = Date.parse(r.rendered_at ?? r.done_at ?? ""); return Number.isFinite(at) ? now - at : Infinity; };
  const hasSignals = (r: T) => !!r.signals && typeof r.signals === "object" && !Array.isArray(r.signals);
  const fresh = matching.find(r => r.status === "done" && hasSignals(r) && !!r.rendered_at && age(r) <= RENDERED_MAX_AGE_MS);
  if (fresh) return { state: "rendered", row: fresh };
  const pending = matching.find(r => r.status === "pending");
  if (pending) return { state: "pending", row: pending };
  const stale = matching.find(r => r.status === "done" && age(r) > RENDERED_MAX_AGE_MS);
  if (stale) return { state: "stale", row: stale };
  const done = matching.find(r => r.status === "done");
  if (done) return { state: "done_empty", row: done };
  const failed = matching.find(r => r.status === "error");
  return failed ? { state: "error", row: failed } : { state: "none", row: null };
}
/** Re-queue a stale row: pending with a fresh attempt budget; old signals stay until a new render replaces them. */
export const requeueUpdate = () => ({ status: "pending" as const, attempts: 0, last_error: null, done_at: null });
