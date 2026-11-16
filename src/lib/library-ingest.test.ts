// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ hash: "", sites: new Map<string, Record<string, unknown>>(), snapshots: [] as Record<string, unknown>[], events: [] as Record<string, unknown>[], text: new Map<number, string>(), retry: false, baselines: new Map<string, Record<string, unknown>>() }));
// The story build runs after the job; stub it so job tests stay offline (its own tests live in stories/).
const afterJob = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./stories/build.server", () => ({ afterJob }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from() { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { secret_sha256: state.hash }, error: null }) }; return chain; },
  async rpc(name: string, args: Record<string, unknown> = {}) {
    const row = args['p_snapshot'] as Record<string, unknown>;
    const context = () => {
      const prev = state.snapshots.filter(s => s['domain'] === row['domain'] && s['page_type'] === row['page_type'] && s['viewport'] === row['viewport'] && s['source'] === row['source'] && String(s['captured_at']) < String(row['captured_at'])).sort((a, b) => String(b['captured_at']).localeCompare(String(a['captured_at'])))[0];
      const first = state.snapshots.filter(s => s['domain'] === row['domain']).map(s => String(s['captured_at'])).sort()[0] ?? null;
      return { sector: "ai", latest_captured_at: prev?.["captured_at"] ?? null, baseline: state.baselines.get([row["domain"],row["page_type"],row["viewport"],row["source"]].join(":")) ?? null, prev: prev ? { id: prev['id'], signals: prev['signals'], content_hash: prev['content_hash'] ?? null } : null, first_captured_at: first, new_surface: !!first && Date.parse(String(row['captured_at'])) - Date.parse(first) > 86400000 && !state.snapshots.some(s => s['domain'] === row['domain'] && s['page_type'] === row['page_type']) };
    };
    if (name === "refresh_library_history") return {data:null,error:null};
    if(name==="library_archive_store"){state.snapshots.push({...row,id:state.snapshots.length+1});return {data:1,error:null};}
    if(name==="library_archive_input")return {data:state.snapshots.filter(s=>s['domain']===args['p_domain']&&s['source']==="wayback").map(s=>({...s,sector:"ai"})),error:null};
    if(name==="library_archive_replace")return {data:true,error:null};
    if(name==="library_archive_state")return {data:{sites:[...state.sites.values()].filter(s=>s['active']).map(s=>({domain:s['domain'],wayback:state.snapshots.filter(r=>r['domain']===s['domain']&&r['source']==="wayback").sort((a,b)=>String(a['captured_at']).localeCompare(String(b['captured_at']))).map(r=>({captured_at:r['captured_at'],quarter:(r['signals'] as {archive:{quarter:string}}).archive.quarter}))}))},error:null};
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
      const change = args['p_events'] as { baseline: Record<string, unknown>; pending: Record<string, Record<string, unknown>>; events: Record<string, unknown>[] };
      const events = change.events;
      state.baselines.set([row['domain'],row['page_type'],row['viewport'],row['source']].join(":"), { ...change.baseline, snapshot_id: change.baseline['snapshot_id'] ?? id, pending: change.pending });
      state.events.push(...events);
      const site = state.sites.get(String(row['domain']));
      if (site) site['pages'] = { ...site['pages'] as object, ...row['discovered_pages'] as object };
      return { data: { inserted: 1, events: events.length }, error: null };
    }
    if (name === "library_state") return { data: { sites: [...state.sites.values()].filter(s => s['active']).map(site => ({ ...site, wayback: state.snapshots.filter(s=>s["domain"]===site["domain"]&&s["source"]==="wayback"&&s["page_type"]==="home"&&s["viewport"]==="desktop").map(s=>s["captured_at"]).sort(), latest: Object.fromEntries(state.snapshots.filter(s => s['domain'] === site['domain'] && s['source'] === "live").map(s => [`${s['page_type']}:${s['viewport']}`, { html_hash: s['html_hash'], content_hash: s['content_hash'] ?? null, signals_hash: s['signals_hash'] ?? null, captured_at: s['captured_at'] }])) })) }, error: null };
    throw new Error("Unexpected RPC");
  },
} }));
import { handleCrawlIngest, handleLibraryState, sha256Hex } from "./crawl-ingest.server";
const credential = "library-test-only";
const request = (body: unknown) => new Request("http://localhost/api/public/ingest-crawl", { method: "POST", headers: { "x-crawl-secret": credential }, body: JSON.stringify(body) });
const snapshot = { domain: "example.com", page_type: "home", viewport: "desktop", source: "live", captured_at: "2026-11-11T01:00:00Z", url: "https://example.com", html_hash: "hash-1", signals: { color: { theme: "light" } }, raw_text: "private text" };
beforeEach(async () => { state.hash = await sha256Hex(credential); state.sites.clear(); state.snapshots = []; state.events = []; state.text.clear(); state.retry = false; state.baselines.clear(); });
it("authenticated sync → snapshots → events → state, duplicates are no-op", async () => {
  expect(await (await handleCrawlIngest(request({ kind: "library_sync", sites: [{ domain: "example.com", sector: "ai" }] }))).json()).toEqual({ ok: true, inserted: 0, events: 0 });
  const post = (value: unknown) => handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [value] }));
  expect(await (await post(snapshot)).json()).toEqual({ ok: true, inserted: 1, events: 0 });
  state.retry = true;
  const next = { ...snapshot, captured_at: "2026-11-11T02:00:00Z", html_hash: "hash-2", signals: { color: { theme: "dark" } }, discovered_pages: { pricing: "https://example.com/pricing" } };
  expect(await (await post(next)).json()).toEqual({ ok: true, inserted: 1, events: 0 });
  expect(await (await post({ ...next, captured_at: "2026-11-11T03:00:00Z" })).json()).toEqual({ ok: true, inserted: 1, events: 1 });
  expect(await (await post(next)).json()).toEqual({ ok: true, inserted: 0, events: 0 });
  expect(state.events).toMatchObject([{ type: "theme_flip", severity: 2 }]);
  expect(state.text.get(1)).toBe("private text");
  const response = await handleLibraryState(new Request("http://localhost/api/public/library-state", { headers: { "x-crawl-secret": credential } }));
  const data = await response.json();
  expect(data.sites[0].latest['home:desktop'].html_hash).toBe("hash-2");
  expect(data.sites[0].pages).toEqual({ pricing: "https://example.com/pricing" });
  expect(JSON.stringify(data)).not.toContain("private text");
});
it("quarterly state returns only active domains and capture/quarter pairs",async()=>{
 state.sites.set("example.com",{domain:"example.com",active:true});state.sites.set("inactive.com",{domain:"inactive.com",active:false});
 state.snapshots.push({...snapshot,source:"wayback",captured_at:"2021-04-03T00:00:00Z",signals:{archive:{quarter:"2021Q2"}}});
 const response=await handleLibraryState(new Request("http://localhost/api/public/library-state?source=wayback",{headers:{"x-crawl-secret":credential}}));
 expect(await response.json()).toEqual({sites:[{domain:"example.com",wayback:[{captured_at:"2021-04-03T00:00:00Z",quarter:"2021Q2"}]}]});
});
it("state rejects absent/wrong credentials with 401", async () => { for (const key of ["", "wrong"]) expect((await handleLibraryState(new Request("http://localhost/api/public/library-state", { headers: { "x-crawl-secret": key } }))).status).toBe(401); });
it("sync deactivates omitted sites", async () => { state.sites.set("old.com", { domain: "old.com", active: true }); await handleCrawlIngest(request({ kind: "library_sync", sites: [] })); expect(state.sites.get("old.com")?.['active']).toBe(false); });
it("new page type emits exactly one new_surface across viewports", async () => {
  await handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [snapshot] }));
  expect(await (await handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [{ ...snapshot, page_type: "pricing", captured_at: "2026-11-12T01:00:01Z" }, { ...snapshot, page_type: "pricing", viewport: "mobile", captured_at: "2026-11-12T01:00:01Z" }] }))).json()).toEqual({ ok: true, inserted: 2, events: 1 });
  expect(state.events).toMatchObject([{ type: "new_surface", severity: 1 }]);
});
it("baseline run adds pages without emitting surface events", async () => {
  const response = await handleCrawlIngest(request({ kind: "library_snapshots", snapshots: [snapshot, { ...snapshot, page_type: "pricing", captured_at: "2026-11-11T02:00:00Z" }] }));
  expect(await response.json()).toEqual({ ok: true, inserted: 2, events: 0 });
});
it("archive state contains sorted desktop home timestamps and live hashes stay separate",async()=>{
 state.sites.set("example.com",{domain:"example.com",active:true});
 await handleCrawlIngest(request({kind:"library_snapshots",snapshots:[snapshot,{...snapshot,source:"wayback",captured_at:"2021-07-03T01:00:00Z",raw_text:undefined},{...snapshot,source:"wayback",captured_at:"2021-01-03T01:00:00Z",raw_text:undefined}]}));
 const response=await handleLibraryState(new Request("http://localhost/api/public/library-state",{headers:{"x-crawl-secret":credential}}));
 expect((await response.json()).sites[0]).toMatchObject({wayback:["2021-01-03T01:00:00Z","2021-07-03T01:00:00Z"],latest:{"home:desktop":{captured_at:snapshot.captured_at}}});
});
