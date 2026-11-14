// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ hash: "", upserts: [] as Record<string, unknown>[][], merges: [] as { p_rows: unknown[]; p_add: boolean }[], wireRows: [] as Record<string, unknown>[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: async (name: string, args: { p_rows: unknown[]; p_add: boolean }) => { if (name === "discourse_merge") { state.merges.push(args); return { data: args.p_rows.length, error: null }; } return { data: null, error: { message: "unexpected" } }; },
  from(table: string) {
    const rows = (): Record<string, unknown>[] => table === "crawl_secrets" ? [{ secret_sha256: state.hash }] : table === "wire_items" ? state.wireRows
      : table === "font_usage" ? [{ key: "geist", sites: 26 }] : table === "font_catalog" ? [{ key: "geist", family: "Geist", license_hint: "free" }] : table === "color_tickers" ? [{ key: "amber·muted·dark" }] : [];
    let upserted: Record<string, unknown>[] | null = null;
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "eq", "order", "in", "not", "gte", "like", "limit"]) chain[k] = () => chain;
    chain["range"] = async () => ({ data: rows(), error: null });
    chain["maybeSingle"] = async () => ({ data: rows()[0] ?? null, error: null });
    chain["upsert"] = (r: Record<string, unknown>[]) => { upserted = r; state.upserts.push(r); return chain; };
    chain["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: upserted ? upserted.map((_, i) => ({ id: i })) : rows(), error: null }).then(resolve);
    return chain;
  },
} }));
vi.mock("./ingest.server", () => ({ ingestWire: vi.fn(async () => Response.json({ ok: true, polled: true })) }));
import { sha256Hex } from "./crawl-ingest.server";
import { handleDiscourseTerms, handleIngestWire, handleSeedCandidates } from "./wire-ingest.server";
import { WIRE_INGEST_BODY_LIMIT, wireIngestPayload } from "./wire-payload";

const secret = "test-only-sampler-secret", base = "http://localhost/api/public/ingest-wire";
const post = (body: unknown, headers: Record<string, string> = { authorization: `Bearer ${secret}` }) => new Request(base, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const now = new Date();
const item = (o: Record<string, unknown> = {}) => ({ source_kind: "bluesky", url: "https://bsky.app/profile/did:plc:abc123/post/3kxyz", title: "Glassmorphism is so 2025", author: "@designer.bsky.social", published_at: now.toISOString(), link: "https://example.com/post", ...o });
const mentions = (o: Record<string, unknown> = {}) => ({ kind: "mentions", window_start: new Date(now.getTime() - 3600_000).toISOString(), window_end: now.toISOString(), sampled_posts: 50000, design_posts: 800, counts: { glassmorphism: { n: 12, fatigue: 3 } }, ...o });

beforeEach(async () => { state.hash = await sha256Hex(secret); state.upserts = []; state.merges = []; state.wireRows = []; vi.stubEnv("LOVABLE_CRON_SECRET", "test-only-cron"); });

describe("ingest-wire payload schema", () => {
  it("accepts bluesky items and mention windows", () => { expect(wireIngestPayload.safeParse({ kind: "items", items: [item()] }).success).toBe(true); expect(wireIngestPayload.safeParse(mentions()).success).toBe(true); });
  it("is strict and bounded", () => {
    expect(wireIngestPayload.safeParse({ kind: "items", items: [item({ extra: 1 })] }).success).toBe(false);
    expect(wireIngestPayload.safeParse({ kind: "items", items: [item({ url: "https://bsky.app/profile/x" })] }).success).toBe(false);
    expect(wireIngestPayload.safeParse({ kind: "items", items: [item({ title: "x".repeat(301) })] }).success).toBe(false);
    expect(wireIngestPayload.safeParse({ kind: "items", items: Array.from({ length: 201 }, () => item()) }).success).toBe(false);
    expect(wireIngestPayload.safeParse({ kind: "items", items: [item({ terms: Array(21).fill("a") })] }).success).toBe(false);
    expect(wireIngestPayload.safeParse(mentions({ counts: Object.fromEntries(Array.from({ length: 601 }, (_, i) => [`t${i}`, { n: 1, fatigue: 0 }])) })).success).toBe(false);
    expect(wireIngestPayload.safeParse(mentions({ counts: { a: { n: 1, fatigue: 2 } } })).success).toBe(false);
    expect(wireIngestPayload.safeParse(mentions({ counts: { "*": { n: 1, fatigue: 0 } } })).success).toBe(false);
    expect(wireIngestPayload.safeParse(mentions({ window_end: new Date(now.getTime() - 7200_000).toISOString() })).success).toBe(false);
    expect(wireIngestPayload.safeParse(mentions({ design_posts: 60000 })).success).toBe(false);
  });
});

describe("ingest-wire endpoint", () => {
  it("rejects callers without the crawler secret or cron credential", async () => {
    expect((await handleIngestWire(post({ kind: "items", items: [item()] }, {}))).status).toBe(401);
    expect((await handleIngestWire(post({ kind: "items", items: [item()] }, { authorization: "Bearer wrong" }))).status).toBe(401);
  });
  it("keeps the scheduled RSS/HN poll on the cron credential with an empty body", async () => {
    const res = await handleIngestWire(post({}, { authorization: "Bearer test-only-cron" }));
    expect(await res.json()).toEqual({ ok: true, polled: true });
    expect((await handleIngestWire(post({ kind: "items" }, { authorization: "Bearer test-only-cron" }))).status).toBe(400);
  });
  it("accepts x-crawl-secret too and caps the body at 256 KB", async () => {
    const big = JSON.stringify({ kind: "items", items: [item({ title: "x".repeat(WIRE_INGEST_BODY_LIMIT) })] });
    expect((await handleIngestWire(post(big, { "x-crawl-secret": secret }))).status).toBe(413);
  });
  it("writes bluesky items with the public projection only", async () => {
    const res = await handleIngestWire(post({ kind: "items", items: [item(), item({ url: "https://bsky.app/profile/a.b/post/old", published_at: "2020-01-01T00:00:00Z" })] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, received: 2, written: 1, skipped: [{ reason: "stale" }] });
    expect(state.upserts[0]).toEqual([{ url: item().url, title: "Glassmorphism is so 2025", source: "Bluesky @designer.bsky.social", source_kind: "bluesky", published_at: item().published_at, excerpt: null, link: "https://example.com/post", tags: [] }]);
  });
  it("replaces a mention window with a total row plus terms", async () => {
    const res = await handleIngestWire(post(mentions()));
    expect(await res.json()).toMatchObject({ ok: true, terms: 1, written: 2 });
    expect(state.merges[0]!.p_add).toBe(false);
    expect(state.merges[0]!.p_rows).toEqual([expect.objectContaining({ term: "*", n: 800, sampled_posts: 50000, source: "bluesky" }), expect.objectContaining({ term: "glassmorphism", n: 12, fatigue: 3 })]);
  });
  it("returns 400 with issues for invalid payloads", async () => {
    const res = await handleIngestWire(post({ kind: "mentions" }));
    expect(res.status).toBe(400); expect((await res.json()).issues.length).toBeGreaterThan(0);
  });
});

describe("sampler reads", () => {
  it("discourse-terms needs the secret and returns terms + fatigue phrases", async () => {
    expect((await handleDiscourseTerms(new Request("http://localhost/api/public/discourse-terms"))).status).toBe(401);
    const body = await (await handleDiscourseTerms(new Request("http://localhost/api/public/discourse-terms", { headers: { authorization: `Bearer ${secret}` } }))).json();
    expect(body.version).toMatch(/^[0-9a-f]{8}$/); expect(body.terms.length).toBeLessThanOrEqual(600);
    expect(body.terms).toEqual(expect.arrayContaining([{ term: "Geist", kind: "font" }, { term: "amber", kind: "color" }]));
    expect(body.fatigue).toContain("played out");
  });
  it("seed-candidates needs the secret and returns registrable domains", async () => {
    expect((await handleSeedCandidates(new Request("http://localhost/api/public/seed-candidates"))).status).toBe(401);
    state.wireRows = [{ link: "https://studio.example/work", source_kind: "arena", fetched_at: "2026-11-12T00:00:00Z" }];
    const body = await (await handleSeedCandidates(new Request("http://localhost/api/public/seed-candidates", { headers: { "x-crawl-secret": secret } }))).json();
    expect(body).toEqual({ domains: [{ domain: "studio.example", sources: ["arena"], first_seen: "2026-11-12T00:00:00.000Z" }] });
  });
});
