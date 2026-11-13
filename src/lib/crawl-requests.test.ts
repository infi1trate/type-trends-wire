// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ hash: "" as string | null, rows: new Map<string, Record<string, unknown>>() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from(table: string) {
    let op = "select", values: Record<string, unknown> = {}, limit = Infinity;
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    const run = () => {
      if (table === "crawl_secrets") return { data: state.hash === null ? null : { secret_sha256: state.hash }, error: null };
      const matched = [...state.rows.values()].filter(r => filters.every(f => f(r)));
      if (op === "update") for (const r of matched) Object.assign(r, values);
      return { data: matched.slice(0, limit).map(r => ({ ...r })), error: null };
    };
    const chain = {
      select: () => chain, order: () => chain,
      update: (v: Record<string, unknown>) => { op = "update"; values = v; return chain; },
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return chain; },
      in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return chain; },
      limit: (n: number) => { limit = n; return chain; },
      maybeSingle: async () => { const r = run(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; },
      then: (resolve: (v: ReturnType<typeof run>) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return chain;
  },
} }));
import { sha256Hex } from "./crawl-ingest.server";
import { handleCrawlRequestsGet, handleCrawlRequestsPost } from "./crawl-requests.server";
import { CRAWL_REQUESTS_BODY_LIMIT, crawlResultsSchema, nextCrawlRequestState, parseRequestLimit } from "./crawl-requests";

const secret = "test-only-queue-secret", base = "http://localhost/api/public/crawl-requests";
const get = (q = "", key: string | null = secret) => new Request(base + q, { headers: key === null ? {} : { authorization: `Bearer ${key}` } });
const post = (body: unknown, key: string | null = secret) => new Request(base, { method: "POST", headers: { "content-type": "application/json", ...(key === null ? {} : { authorization: `Bearer ${key}` }) }, body: typeof body === "string" ? body : JSON.stringify(body) });
const row = (url: string, requested_at: string, extra: Record<string, unknown> = {}) => state.rows.set(url, { url, domain: new URL(url).hostname, requested_at, status: "pending", attempts: 0, last_error: null, done_at: null, ...extra });

beforeEach(async () => { state.hash = await sha256Hex(secret); state.rows.clear(); row("https://a.com/", "2026-11-01T00:00:00Z"); row("https://b.com/", "2026-11-02T00:00:00Z"); });

describe("crawl-requests auth", () => {
  it("returns 401 without a secret", async () => {
    expect((await handleCrawlRequestsGet(get("", null))).status).toBe(401);
    expect((await handleCrawlRequestsPost(post({ results: [{ url: "https://a.com/", status: "done" }] }, null))).status).toBe(401);
  });
  it("returns 401 with a wrong secret", async () => {
    expect((await handleCrawlRequestsGet(get("", "wrong"))).status).toBe(401);
    expect((await handleCrawlRequestsPost(post({ results: [{ url: "https://a.com/", status: "done" }] }, "wrong"))).status).toBe(401);
    expect(state.rows.get("https://a.com/")?.["attempts"]).toBe(0);
  });
  it("returns 401 when no secret hash is configured", async () => { state.hash = null; expect((await handleCrawlRequestsGet(get())).status).toBe(401); });
  it("accepts the Bearer secret and lists pending requests", async () => {
    const res = await handleCrawlRequestsGet(get("?limit=1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ requests: [{ url: "https://a.com/", domain: "a.com", requested_at: "2026-11-01T00:00:00Z", status: "pending", attempts: 0, last_error: null, done_at: null }] });
  });
});

describe("crawl-requests caps", () => {
  it("limits N to 1..25 with default 10", () => {
    expect(parseRequestLimit(null)).toBe(10); expect(parseRequestLimit("25")).toBe(25);
    expect(parseRequestLimit("26")).toBeNull(); expect(parseRequestLimit("0")).toBeNull(); expect(parseRequestLimit("5.5")).toBeNull();
  });
  it("rejects limit above 25 with 400", async () => { expect((await handleCrawlRequestsGet(get("?limit=26"))).status).toBe(400); });
  it("rejects more than 25 results, long errors, unknown fields and duplicates", () => {
    const r = (i: number) => ({ url: `https://s${i}.com/`, status: "done" as const });
    expect(crawlResultsSchema.safeParse({ results: Array.from({ length: 25 }, (_, i) => r(i)) }).success).toBe(true);
    expect(crawlResultsSchema.safeParse({ results: Array.from({ length: 26 }, (_, i) => r(i)) }).success).toBe(false);
    expect(crawlResultsSchema.safeParse({ results: [{ ...r(1), status: "error", error: "x".repeat(301) }] }).success).toBe(false);
    expect(crawlResultsSchema.safeParse({ results: [{ ...r(1), extra: 1 }] }).success).toBe(false);
    expect(crawlResultsSchema.safeParse({ results: [r(1), r(1)] }).success).toBe(false);
  });
  it("rejects bodies over 64 KB with 413", async () => {
    expect((await handleCrawlRequestsPost(post(" ".repeat(CRAWL_REQUESTS_BODY_LIMIT + 1)))).status).toBe(413);
  });
});

describe("crawl-requests retry logic", () => {
  it("sends errors back to pending until the third attempt", () => {
    expect(nextCrawlRequestState(0, { status: "error", error: "timeout" }, "t")).toEqual({ status: "pending", attempts: 1, done_at: null, last_error: "timeout" });
    expect(nextCrawlRequestState(1, { status: "error", error: "timeout" }, "t").status).toBe("pending");
    expect(nextCrawlRequestState(2, { status: "error", error: "timeout" }, "t")).toEqual({ status: "error", attempts: 3, done_at: null, last_error: "timeout" });
    expect(nextCrawlRequestState(1, { status: "done" }, "t")).toEqual({ status: "done", attempts: 2, done_at: "t", last_error: null });
  });
  it("applies results and skips unknown or finished URLs", async () => {
    state.rows.get("https://b.com/")!["attempts"] = 2;
    row("https://c.com/", "2026-11-03T00:00:00Z", { status: "done" });
    const res = await handleCrawlRequestsPost(post({ results: [{ url: "https://a.com/", status: "error", error: "blocked" }, { url: "https://b.com/", status: "error", error: "blocked" }, { url: "https://c.com/", status: "done" }, { url: "https://z.com/", status: "done" }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: [{ url: "https://a.com/", status: "pending", attempts: 1 }, { url: "https://b.com/", status: "error", attempts: 3 }], skipped: [{ url: "https://c.com/", reason: "not_pending" }, { url: "https://z.com/", reason: "unknown" }] });
    expect(state.rows.get("https://a.com/")).toMatchObject({ status: "pending", attempts: 1, last_error: "blocked" });
    expect(state.rows.get("https://b.com/")).toMatchObject({ status: "error", attempts: 3 });
  });
});
