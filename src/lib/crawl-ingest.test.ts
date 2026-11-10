// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRAWL_BODY_LIMIT, crawlPayload } from "./crawl-payload";

const state = vi.hoisted(() => ({
  hash: "" as string | null,
  runs: new Map<string, Record<string, unknown>>(),
  sites: new Map<string, Record<string, unknown>>(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from(table: string) {
    let operation = "select";
    let values: Record<string, unknown> | Record<string, unknown>[] = {};
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const execute = () => {
      if (table === "crawl_secrets") return { data: state.hash === null ? null : { secret_sha256: state.hash }, error: null };
      const rows = table === "crawl_runs" ? state.runs : state.sites;
      if (operation === "upsert") {
        for (const row of Array.isArray(values) ? values : [values]) {
          const key = table === "crawl_runs" ? String(row['id']) : `${row['run_id']}/${row['domain']}`;
          rows.set(key, { ...rows.get(key), ...row });
        }
        return { data: null, error: null };
      }
      const matched = [...rows.values()].filter(row => filters.every(filter => filter(row)));
      if (operation === "update") for (const row of matched) Object.assign(row, values);
      return { data: matched.map(row => ({ ...row })), error: null };
    };
    const chain = {
      select: () => chain,
      upsert: (value: typeof values) => { operation = "upsert"; values = value; return chain; },
      update: (value: typeof values) => { operation = "update"; values = value; return chain; },
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain; },
      neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return chain; },
      lt: (key: string, value: string) => { filters.push(row => String(row[key]) < value); return chain; },
      maybeSingle: async () => { const result = execute(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; },
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
    };
    return chain;
  },
} }));
import { constantTimeHashEqual, handleCrawlIngest, sha256Hex } from "./crawl-ingest.server";

const secret = "test-only-crawler-secret";
const request = (body: unknown, key: string | null = secret) => new Request("http://localhost/api/public/ingest-crawl", {
  method: "POST", headers: { "content-type": "application/json", ...(key === null ? {} : { "x-crawl-secret": key }) },
  body: JSON.stringify(body),
});
const start = { kind: "start", run_id: "weekly_1", started_at: "2026-11-10T06:00:00Z", seeds_meta: null, target_per_index: 500 };
const site = { run_id: "weekly_1", domain: "example.com", index: "vanguard", crawled_at: "2026-11-10T06:05:00Z", ok: true,
  type: { rendered: { h1: { family: "Inter" } } }, color: {}, layout: {}, composition: {}, lexicon: {}, tech: {} };

beforeEach(async () => { state.hash = await sha256Hex(secret); state.runs.clear(); state.sites.clear(); });
describe("crawler receiver", () => {
  it("returns 403 without a secret", async () => { expect((await handleCrawlIngest(request(start, null))).status).toBe(403); expect(state.runs.size).toBe(0); });
  it("returns 403 with a wrong secret", async () => { const res = await handleCrawlIngest(request(start, "wrong")); expect(res.status).toBe(403); expect(await res.json()).toEqual({ error: "forbidden" }); });
  it("returns 403 without a configured hash", async () => { state.hash = null; expect((await handleCrawlIngest(request(start))).status).toBe(403); });
  it("hashes with SHA-256 and rejects truncated or extended stored hashes", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const hash = await sha256Hex(secret);
    expect(constantTimeHashEqual(hash, hash.slice(0, 63))).toBe(false);
    expect(constantTimeHashEqual(hash, `${hash}0`)).toBe(false);
  });
  it("start → sites → finish writes rows and maps index_name", async () => {
    expect(await (await handleCrawlIngest(request(start))).json()).toEqual({ ok: true, written: 1 });
    expect(state.runs.get("weekly_1")?.['status']).toBe("running");
    expect(await (await handleCrawlIngest(request({ kind: "sites", run_id: "weekly_1", sites: [site] }))).json()).toEqual({ ok: true, written: 1 });
    expect(state.sites.get("weekly_1/example.com")).toMatchObject({ index_name: "vanguard", type: site.type });
    const finished_at = "2026-11-10T06:10:00Z";
    expect(await (await handleCrawlIngest(request({ kind: "finish", run_id: "weekly_1", finished_at, stats: { ok: 1 } }))).json()).toEqual({ ok: true, written: 1 });
    expect(state.runs.get("weekly_1")).toMatchObject({ status: "finished", finished_at, stats: { ok: 1 } });
  });
  it("marks only other running runs older than 24 hours failed", async () => {
    state.runs.set("stale", { id: "stale", status: "running", started_at: new Date(Date.now() - 25 * 3600000).toISOString() });
    state.runs.set("fresh", { id: "fresh", status: "running", started_at: new Date(Date.now() - 23 * 3600000).toISOString() });
    await handleCrawlIngest(request(start));
    expect(state.runs.get("stale")?.['status']).toBe("failed");
    expect(state.runs.get("fresh")?.['status']).toBe("running");
    expect(state.runs.get("weekly_1")?.['status']).toBe("running");
  });
  it("returns 404 for sites referencing an unknown run", async () => { expect((await handleCrawlIngest(request({ kind: "sites", run_id: "weekly_1", sites: [site] }))).status).toBe(404); });
  it("returns 404 when finishing an unknown run", async () => { expect((await handleCrawlIngest(request({ kind: "finish", run_id: "unknown", finished_at: start.started_at, stats: {} }))).status).toBe(404); });
  it("returns 400 with issues for a bad kind", async () => { const res = await handleCrawlIngest(request({ kind: "bad" })); expect(res.status).toBe(400); expect((await res.json()).issues.length).toBeGreaterThan(0); });
  it("returns 413 for a streamed body exceeding 2 MB without content-length", async () => {
    expect(CRAWL_BODY_LIMIT).toBe(2097152);
    expect((await handleCrawlIngest(request({ padding: "x".repeat(CRAWL_BODY_LIMIT) }))).status).toBe(413);
  });
  it("returns 413 for content-length above 2 MB", async () => { const req = request(start); req.headers.set("content-length", "2097153"); expect((await handleCrawlIngest(req)).status).toBe(413); });
  it("returns 400 for invalid JSON", async () => { const req = new Request("http://localhost/api/public/ingest-crawl", { method: "POST", headers: { "x-crawl-secret": secret }, body: "{" }); expect((await handleCrawlIngest(req)).status).toBe(400); });
});

describe("crawler payload bounds", () => {
  it("limits run IDs to 1–64 safe characters", () => {
    for (const run_id of ["", "x".repeat(65), "invalid/run"]) expect(crawlPayload.safeParse({ ...start, run_id }).success).toBe(false);
    expect(crawlPayload.safeParse({ ...start, run_id: "x".repeat(64) }).success).toBe(true);
  });
  it("limits site batches to 1–100", () => { for (const count of [0, 101]) expect(crawlPayload.safeParse({ kind: "sites", run_id: "weekly_1", sites: Array(count).fill(site) }).success).toBe(false); expect(crawlPayload.safeParse({ kind: "sites", run_id: "weekly_1", sites: Array(100).fill(site) }).success).toBe(true); });
  it.each([['domain', 253], ['error', 200], ['title', 300], ['lang', 35]] as const)("limits %s to %i characters", (field, limit) => {
    const batch = (value: string) => ({ kind: "sites", run_id: "weekly_1", sites: [{ ...site, [field]: value }] });
    expect(crawlPayload.safeParse(batch("x".repeat(limit))).success).toBe(true);
    expect(crawlPayload.safeParse(batch("x".repeat(limit + 1))).success).toBe(false);
  });
  it("requires ISO timestamps, integer targets and object signals", () => {
    expect(crawlPayload.safeParse({ ...start, started_at: "yesterday" }).success).toBe(false);
    expect(crawlPayload.safeParse({ ...start, target_per_index: 1.5 }).success).toBe(false);
    expect(crawlPayload.safeParse({ kind: "sites", run_id: "weekly_1", sites: [{ ...site, color: [] }] }).success).toBe(false);
  });
  it("rejects mismatched site run IDs", () => { expect(crawlPayload.safeParse({ kind: "sites", run_id: "weekly_1", sites: [{ ...site, run_id: "other" }] }).success).toBe(false); });
});