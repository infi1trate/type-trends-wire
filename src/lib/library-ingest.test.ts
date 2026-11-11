// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ hash: "", sites: new Map<string, Record<string, unknown>>(), snapshots: [] as Record<string, unknown>[], events: [] as Record<string, unknown>[], text: new Map<number, string>(), retry: false }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from() { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { secret_sha256: state.hash }, error: null }) }; return chain; },
  async rpc(name: string, args: Record<string, unknown> = {}) {
    const row = args['p_snapshot'] as Record<string, unknown>;
    const context = () => {
      const prev = state.snapshots.filter(s => s['domain'] === row['domain'] && s['page_type'] === row['page_type'] && s['viewport'] === row['viewport'] && s['source'] === row['source'] && String(s['captured_at']) < String(row['captured_at'])).sort((a, b) => String(b['captured_at']).localeCompare(String(a['captured_at'])))[0];
      return { prev: prev ? { id: prev['id'], signals: prev['signals'], content_hash: prev['content_hash'] ?? null } : null, new_surface: state.snapshots.some(s => s['domain'] === row['domain']) && !state.snapshots.some(s => s['domain'] === row['domain'] && s['page_type'] === row['page_type']) };
    };
    if (name === "library_sync") {
      const sites = args['p_sites'] as Record<string, unknown>[];
      for (const site of state.sites.values()) site['active'] = false;
      for (const site of sites) state.sites.set(String(site['domain']), { ...site, active: true, pages: {} });
      return { data: null, error: null };
    }
    if (name === "library_snapshot_context") return { data: context(), error: null };
    if (name === "library_store_snapshot") {
      if (state.retry) { state.retry = false; return { data: { retry: true }, error: null }; }
      if (state.snapshots.some(s => ["domain", "page_type", "viewport", "source", "captured_at"].every(key => s[key] === row[key]))) return { data: { inserted: 0, events: 0 }, error: null };
      const id = state.snapshots.length + 1;
      state.snapshots.push({ ...row, id });
      if (typeof row['raw_text'] === "string") state.text.set(id, row['raw_text']);
      const events = args['p_events'] as Record<string, unknown>[];
      state.events.push(...events);
      const site = state.sites.get(String(row['domain']));
      if (site) site['pages'] = { ...site['pages'] as object, ...row['discovered_pages'] as object };
      return { data: { inserted: 1, events: events.length }, error: null };
    }
    if (name === "library_state") return { data: { sites: [...state.sites.values()].filter(s => s['active']).map(site => ({ ...site, latest: Object.fromEntries(state.snapshots.filter(s => s['domain'] === site['domain'] && s['source'] === "live").map(s => [`${s['page_type']}:${s['viewport']}`, { html_hash: s['html_hash'], content_hash: s['content_hash'] ?? null, signals_hash: s['signals_hash'] ?? null, captured_at: s['captured_at'] }])) })) }, error: null };
    throw new Error("Unexpected RPC");
  },
} }));
import { handleCrawlIngest, handleLibraryState, sha256Hex } from "./crawl-ingest.server";
const credential = "library-test-only";
const request = (body: unknown) => new Request("http://localhost/api/public/ingest-crawl", { method: "POST", headers: { "x-crawl-secret": credential }, body: JSON.stringify(body) });
const snapshot = { domain: "example.com", page_type: "home", viewport: "desktop", source: "live", captured_at: "2026-11-11T01:00:00Z", url: "https://example.com", html_hash: "hash-1", signals: { color: { theme: "light" } }, raw_text: "private text" };
beforeEach(async () => { state.hash = await sha256Hex(credential); state.sites.clear(); state.snapshots = []; state.events = []; state.text.clear(); state.retry = false; });
it("authenticated sync → snapshots → events → state, duplicates are no-op", async () => {
  expect(await (await handleCrawlIngest(request({ kind: "library_sync", sites: [{ domain: "example.com", sector: "ai" }] }))).json()).toEqual({ ok: true, inserted: 0, events: 0 });
  const post = (value: unknown) => handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [value] }));
  expect(await (await post(snapshot)).json()).toEqual({ ok: true, inserted: 1, events: 0 });
  state.retry = true;
  const next = { ...snapshot, captured_at: "2026-11-11T02:00:00Z", html_hash: "hash-2", signals: { color: { theme: "dark" } }, discovered_pages: { pricing: "https://example.com/pricing" } };
  expect(await (await post(next)).json()).toEqual({ ok: true, inserted: 1, events: 1 });
  expect(await (await post(next)).json()).toEqual({ ok: true, inserted: 0, events: 0 });
  expect(state.events).toMatchObject([{ type: "theme_flip", severity: 2 }]);
  expect(state.text.get(1)).toBe("private text");
  const response = await handleLibraryState(new Request("http://localhost/api/public/library-state", { headers: { "x-crawl-secret": credential } }));
  const data = await response.json();
  expect(data.sites[0].latest['home:desktop'].html_hash).toBe("hash-2");
  expect(data.sites[0].pages).toEqual({ pricing: "https://example.com/pricing" });
  expect(JSON.stringify(data)).not.toContain("private text");
});
it("state rejects absent/wrong credentials with 401", async () => { for (const key of ["", "wrong"]) expect((await handleLibraryState(new Request("http://localhost/api/public/library-state", { headers: { "x-crawl-secret": key } }))).status).toBe(401); });
it("sync deactivates omitted sites", async () => { state.sites.set("old.com", { domain: "old.com", active: true }); await handleCrawlIngest(request({ kind: "library_sync", sites: [] })); expect(state.sites.get("old.com")?.['active']).toBe(false); });
it("new page type emits exactly one new_surface across viewports", async () => {
  await handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [snapshot] }));
  expect(await (await handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [{ ...snapshot, page_type: "pricing" }, { ...snapshot, page_type: "pricing", viewport: "mobile" }] }))).json()).toEqual({ ok: true, inserted: 2, events: 1 });
  expect(state.events).toMatchObject([{ type: "new_surface", severity: 1 }]);
});