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
  }).strict()).min(1).max(CRAWL_REQUESTS_MAX_BATCH),
}).strict().refine(v => new Set(v.results.map(r => r.url)).size === v.results.length, "Duplicate url in results");
export type CrawlResult = z.infer<typeof crawlResultsSchema>["results"][number];

export type CrawlRequestUpdate = { status: "pending" | "done" | "error"; attempts: number; done_at: string | null; last_error: string | null };
/** done → done; error → back to pending while attempts (after this one) < 3, otherwise error. */
export function nextCrawlRequestState(attempts: number, result: Pick<CrawlResult, "status" | "error">, now: string): CrawlRequestUpdate {
  const next = attempts + 1;
  if (result.status === "done") return { status: "done", attempts: next, done_at: now, last_error: null };
  return { status: next < CRAWL_REQUEST_MAX_ATTEMPTS ? "pending" : "error", attempts: next, done_at: null, last_error: (result.error ?? "unspecified crawler error").slice(0, 300) };
}
