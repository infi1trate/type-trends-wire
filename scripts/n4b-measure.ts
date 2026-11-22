// N4b · what the share-image and chart checks read: every request to the backend counted by table or bucket (rows, bytes, ms),
// run against live data with nothing written. `bun scripts/n4b-measure.ts share|chart|news`.
type Tally = { calls: number; bytes: number; ms: number; rows: number };
const tally = new Map<string, Tally>();
const real = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const t0 = performance.now(), res = await real(input as RequestInfo, init);
  const m = /\/(rest|storage)\/v1\/(?:object\/)?([^/?]+)/.exec(url.pathname);
  if (!m) return res;
  const key = `${m[1]}:${m[2]}`, buf = await res.clone().arrayBuffer();
  let rows = 0; try { const j = JSON.parse(new TextDecoder().decode(buf)); rows = Array.isArray(j) ? j.length : 1; } catch { /* binary */ }
  const t = tally.get(key) ?? { calls: 0, bytes: 0, ms: 0, rows: 0 };
  t.calls++; t.bytes += buf.byteLength; t.ms += performance.now() - t0; t.rows += rows; tally.set(key, t);
  return res;
}) as typeof fetch;
const report = (label: string, ms: number) => {
  const all = [...tally.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  const sum = all.reduce((s, [, t]) => ({ calls: s.calls + t.calls, bytes: s.bytes + t.bytes }), { calls: 0, bytes: 0 });
  console.log(JSON.stringify({ label, seconds: +(ms / 1000).toFixed(1), calls: sum.calls, kb: Math.round(sum.bytes / 1024), by: all.map(([k, t]) => ({ k, calls: t.calls, rows: t.rows, kb: Math.round(t.bytes / 1024), ms: Math.round(t.ms) })) }, null, 1));
};
const cmd = process.argv[2];
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const t0 = performance.now();
if (cmd === "share") {
  const { shareCheck } = await import("../src/lib/newsroom/graphics.server");
  const s = await shareCheck(db as never, { write: false });
  console.log(JSON.stringify({ checked: s.checked, rebuilt: s.rebuilt, failures: s.failures.slice(0, 5) }));
}
if (cmd === "chart-read") {
  const { DATA_STORIES } = await import("../src/lib/data-stories/registry");
  const { loadDataStory } = await import("../src/lib/data-stories/page.server");
  for (const e of DATA_STORIES) { const r = await loadDataStory(e.slug); console.log(e.slug, r.kind); }
}
if (cmd === "compute-story") {
  const { computeDataStory } = await import("../src/lib/data-stories/page.server");
  const r = await computeDataStory(process.argv[3]!); console.log(r.kind);
}
if (cmd === "pass") {
  const { busyJob } = await import("../src/lib/newsroom/passes");
  while (busyJob(Date.now())) await new Promise(r => setTimeout(r, 2000));
  tally.clear();
  const { runDeskPass } = await import("../src/lib/newsroom/passes.server");
  const r = await runDeskPass(db as never, { only: process.argv[3] as "share" | "chart", byHand: true });
  console.log(JSON.stringify(r, null, 1));
}
if (cmd === "news") {
  const n = await import("../src/lib/newsroom/news.server");
  const { items, picked } = await n.newsInputs(db as never, Date.now());
  const { newsCandidates } = await import("../src/lib/newsroom/news");
  const cands = newsCandidates(items, picked, Date.now());
  console.log("candidates", JSON.stringify(cands.map(c => ({ id: c.id, outlet: (c as { source?: string }).source, title: c.title }))));
  const r = await n.runNewsDesk(db as never, { deadline: Date.now() + 25_000 });
  console.log(JSON.stringify(r, null, 1));
}
if (cmd === "holds") {
  const { deskDoor } = await import("../src/lib/stories/desk.server");
  const { heldJobs } = await import("../src/lib/newsroom/passes.server");
  const until = new Date(Date.now() + 10 * 60_000).toISOString(), reason = "N4b proof: hold and release by hand";
  const steps: [string, Record<string, unknown>][] = [
    ["graphics", { action: "job_hold", job: "backtest", until, reason }],
    ["news", { action: "job_hold", job: "backtest", until, reason }],
    ["engineering", { action: "job_hold", job: "backtest", until: new Date(Date.now() + 8 * 864e5).toISOString(), reason }],
    ["engineering", { action: "job_hold", job: "backtest", until, reason }],
    ["data", { action: "job_release", job: "backtest", reason }],
    ["engineering", { action: "job_release", job: "backtest", reason }],
    ["engineering", { action: "job_release", job: "backtest", reason }],
  ];
  for (const [actor, b] of steps) {
    const r = await deskDoor(actor, b);
    console.log(actor, b["action"], r.status, JSON.stringify(r.body).slice(0, 160), "holds now:", JSON.stringify((await heldJobs(db as never)).map(h => h.job)));
  }
}
if (cmd === "state") { const { data, error } = await db.rpc("library_state" as never); console.log(error ? error.message : (data as unknown[] | null)?.length); }
report(cmd ?? "", performance.now() - t0);
process.exit(0);
