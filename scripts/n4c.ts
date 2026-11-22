// N4c proof: `bun scripts/n4c.ts load|item1 <ids>|sweep|waiting|news-cands|news-replay|news-recheck|review-hand [n]|pass|hand-wire|hand-desk|lines`.
// Every backend request is counted by table (rows, bytes, ms). news-replay makes three fixture calls; review-hand, pass and hand-wire do
// the product's real work (door actions, model calls within the desks' daily limits) and write job_runs rows.
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
async function buildCtx() {
  const b = await import("../src/lib/stories/build.server");
  const { confirmedInput } = await import("../src/lib/stories/editor");
  const raw = await b.loadInput({ days: b.BUILD_DAYS ?? 7, allRuns: false, realRunIds: [] });
  const input = confirmedInput(raw).input;
  const { allCandidates } = await import("../src/lib/stories/candidates");
  const { ctx } = allCandidates(input as never);
  return { input, ctx, bases: b.shareBases };
}
if (cmd === "load") {
  const r = await buildCtx();
  report("load", performance.now() - t0); void r;
}
if (cmd === "item1") {
  const r = await buildCtx();
  const { reviewInput } = await import("../src/lib/newsroom/review.server");
  const { checklist } = await import("../src/lib/newsroom/standards");
  for (const id of process.argv.slice(3)) {
    const i = await reviewInput(id, r as never);
    if (!i) { console.log(id, "no input"); continue; }
    console.log(id, JSON.stringify(checklist(i).find(x => x.id === "numbers")));
    console.log("deck:", i.deck);
    console.log("sheet:", JSON.stringify(i.sheet).slice(0, 3000));
  }
}
if (cmd === "news-cands") {
  const n = await import("../src/lib/newsroom/news.server"), P = await import("../src/lib/newsroom/news");
  const now = Date.now(), seen = new Map<number, unknown>();
  for (const back of [0, 36]) {
    const at = now - back * 36e5, { items } = await n.newsInputs(db as never, at);
    for (const c of P.newsCandidates(items, new Set(), at)) seen.set(c.id, { id: c.id, outlet: c.outlet, date: c.date, title: c.title, excerpt: (c.excerpt ?? "").slice(0, 160) });
  }
  console.log(JSON.stringify([...seen.values()], null, 0));
}
if (cmd === "beat") {
  const P = await import("../src/lib/newsroom/news");
  const t = require("node:fs").readFileSync("/tmp/n4c/cands.json", "utf8"); const j = JSON.parse(t.slice(t.indexOf("["))) as { id: number; title: string; excerpt: string }[];
  for (const c of j) { const w = P.offBeat(c); if (!w) console.log("ON ", c.id, c.title.slice(0, 90)); }
}
if (cmd === "news-replay") {
  const N = await import("../src/lib/newsroom/news.server"), P = await import("../src/lib/newsroom/news");
  const { deskPromptHash } = await import("../src/lib/newsroom/golden/versions");
  const WANT = /\b(rebrand\w*|re-brand\w*|new (?:visual )?identity|logo\w*|wordmark|typeface\w*|fonts?|foundr\w+|typograph\w*|website|site redesign|redesign\w*|design tools?|figma|framer|webflow|canva|adobe)\b/i;
  const stamps = ["2026-11-20T23:59:00Z", "2026-11-21T23:59:00Z", new Date().toISOString()], out: unknown[] = [];
  for (const st of stamps) {
    const now = Date.parse(st);
    const r = await N.runNewsDesk(db as never, { now, fixture: true, deadline: Date.now() + 90_000 });
    const { items, picked } = await N.newsInputs(db as never, now), cands = P.newsCandidates(items, picked, now);
    const byId = new Map(items.map(i => [i.id, i]));
    const picks = r.picked.map(p => ({ item: p.item, outlet: byId.get(p.item)?.source ?? "", title: byId.get(p.item)?.title ?? "", subject: p.subject, line: p.line, brand: p.domain }));
    const dropped = r.dropped.map(x => ({ item: x.id, line: x.line, reasons: x.reasons, title: byId.get(x.id)?.title ?? "" }));
    const pickedIds = new Set(r.picked.map(p => p.item));
    const passed_over = cands.filter(c => !pickedIds.has(c.id) && WANT.test(`${c.title} ${c.excerpt ?? ""}`)).map(c => ({ item: c.id, outlet: c.outlet, title: c.title, matched: `${c.title} ${c.excerpt ?? ""}`.match(WANT)![0], code_beat: P.offBeat(c) ?? "on the beat" }));
    const on_beat = cands.filter(c => !P.offBeat(c)).map(c => ({ item: c.id, title: c.title }));
    const day = { at: st, candidates: r.candidates, why: r.why, call_id: r.call_id, picks, dropped, passed_over, on_beat, within_rules: picks.every(p => !P.offBeat({ title: p.title, excerpt: byId.get(p.item)?.excerpt ?? null })) };
    out.push(day); console.log(JSON.stringify(day));
  }
  require("node:fs").writeFileSync("newsroom/scores/news-v2.json", JSON.stringify({ desk: "news", version: "v2", prompt_hash: deskPromptHash("news"), run_at: new Date().toISOString(), note: "N4c: the last 72 hours of candidates replayed as fixture calls on the beat prompt; every pick is checked by the code beat rule.", days: out }, null, 1) + "\n");
}
if (cmd === "news-recheck") {
  const P = await import("../src/lib/newsroom/news"), N = await import("../src/lib/newsroom/news.server");
  const f = "newsroom/scores/news-v2.json", j = JSON.parse(require("node:fs").readFileSync(f, "utf8"));
  const { items } = await N.newsInputs(db as never, Date.now()); const byId = new Map(items.map(i => [i.id, i]));
  for (const d of j.days) for (const x of d.dropped) { const it = byId.get(x.item); const c = { title: P.clean(it?.title ?? x.title), excerpt: P.clean(it?.excerpt ?? "") || null }; x.after_code_fix = P.offBeat(c) ?? (P.lineFailures(x.line, c).join("; ") || "kept"); console.log(x.item, x.after_code_fix); }
  require("node:fs").writeFileSync(f, JSON.stringify(j, null, 1) + "\n");
}
if (cmd === "sweep") {
  const { applyEdits } = await import("../src/lib/stories/edits");
  const rows: Record<string, unknown>[] = [];
  for (let f = 0; f < 20000; f += 1000) { const { data } = await db.from("stories").select("id,status,reason,created_at,type,headline").order("created_at").range(f, f + 999); rows.push(...(data ?? [])); if ((data ?? []).length < 1000) break; }
  const edits: Record<string, unknown>[] = [];
  for (let f = 0; f < 20000; f += 1000) { const { data } = await db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, f + 999); edits.push(...(data ?? [])); if ((data ?? []).length < 1000) break; }
  const byStory = new Map<string, unknown[]>(); for (const e of edits) { const k = e.story_id as string; byStory.set(k, [...(byStory.get(k) ?? []), e]); }
  // Newest row per story id (stories are insert-only).
  const latest = new Map<string, Record<string, unknown>>(); for (const s of rows) latest.set(s.id as string, s);
  const now = Date.now(), want: { id: string; state: string; reason: string | null }[] = [];
  for (const s of latest.values()) {
    const cur = applyEdits(s as never, (byStory.get(s.id as string) ?? []) as never, now) as unknown as { status: string; reason: string | null };
    if (cur.status === "published" || cur.status === "held") want.push({ id: s.id as string, state: cur.status, reason: cur.reason });
  }
  console.error("stories", latest.size, "to sweep", want.length);
  const r = await buildCtx();
  const { reviewInput } = await import("../src/lib/newsroom/review.server");
  const { checklist } = await import("../src/lib/newsroom/standards");
  const fails: unknown[] = [], noIn: typeof want = []; let ran = 0, noInput = 0;
  for (const w of want) {
    const i = await reviewInput(w.id, r as never).catch(() => null);
    if (!i) { noInput++; noIn.push(w); continue; }
    ran++;
    const n = checklist(i).find(x => x.id === "numbers")!;
    if (n.result === "fail") fails.push({ ...w, number: (i as { number?: unknown }).number ?? null, detail: n.detail, deck: i.deck, headline: i.headline });
  }
  console.log(JSON.stringify({ swept: want.length, ran, no_input: noInput, published: want.filter(w => w.state === "published").length, held: want.filter(w => w.state === "held").length, no_input_published: noIn.filter(w => w.state === "published").map(w => w.id), no_input_held_reasons: [...new Set(noIn.filter(w => w.state === "held").map(w => (w.reason ?? "").slice(0, 30)))].slice(0, 20), fails }, null, 1));
}
if (cmd === "waiting") {
  const { reviewIO } = await import("../src/lib/newsroom/review.server");
  const io = reviewIO(db as never, null);
  console.log(JSON.stringify({ pending: (await io.pending()).map(p => p.id), fixed: (await io.checklistRechecks!()).map(p => p.id), rechecks: (await io.rechecks()).map(p => p.id) }));
}
if (cmd === "review-hand") {
  const r = await buildCtx();
  const rp = await import("../src/lib/newsroom/review-pass.server");
  console.log("sheets", await rp.storeSheets(db as never, r as never, Date.now() + 120_000));
  for (let i = 0; i < Number(process.argv[3] ?? 1); i++) {
    const out = await rp.runReviewPass(db as never, { byHand: true });
    console.log(JSON.stringify(out));
  }
}
if (cmd === "pass") {
  const rp = await import("../src/lib/newsroom/review-pass.server");
  console.log(JSON.stringify(await rp.runReviewPass(db as never, { byHand: true })));
}
if (cmd === "hand-wire") {
  // The scheduled wire call's body, by hand (no auth step): start row, ingest, news turn, story build tail, records refresh, finish row.
  const started = Date.now();
  const run = await (await import("../src/lib/jobs/runs.server")).startRun("ingest-wire", { note: "by hand (N4c proof)" });
  const { ingestWire } = await import("../src/lib/ingest.server"), res = await ingestWire();
  const ingestMs = Date.now() - started; let news = "";
  const resp = res as unknown as { ok?: boolean };
  if (resp.ok !== false) {
    const [{ newsTurn }, { CALL_BUDGET_MS }] = await Promise.all([import("../src/lib/newsroom/news.server"), import("../src/lib/jobs/steps")]);
    const t = Date.now(); await newsTurn(started, CALL_BUDGET_MS); news = ` · news ${Math.round((Date.now() - t) / 100) / 10} s`;
    await (await import("../src/lib/stories/build.server")).afterJob("wire", started);
  }
  await (await import("../src/lib/records/refresh.server")).refreshAfterJob("wire", started);
  await run.finish(resp.ok !== false, `by hand · ingest in ${Math.round(ingestMs / 100) / 10} s${news}`);
  console.log("wire by hand", Date.now() - started, "ms");
}
if (cmd === "lines") {
  const jr = await import("../src/lib/jobs/runs"), js = await import("../src/lib/jobs/runs.server");
  const now = Date.now(), runs = jr.pairRuns(await js.loadRunRows(db as never, { days: 1, now }), now);
  for (const l of jr.jobLines(runs, now)) console.log(`${l.name}: ${l.line}`);
  console.log("---"); for (const r of runs.slice(0, 30)) console.log(r.job, r.started_at.slice(11, 19), r.ms, r.ok, r.note);
}
if (cmd === "hand-desk") {
  const { runDeskJobs } = await import("../src/lib/newsroom/desks-run.server");
  console.log("desk jobs", JSON.stringify(await runDeskJobs(Date.now() + 50_000)));
  const { withRun } = await import("../src/lib/jobs/runs.server");
  const { runDeskPass } = await import("../src/lib/newsroom/passes.server");
  const p = await withRun("desk-passes", () => runDeskPass(db as never), x => ({ ok: !x.why.startsWith("failed"), note: `by hand · ${x.why}` }));
  console.log("desk pass", p.why);
  const h = await withRun("health", async () => (await import("../src/lib/newsroom/engineering.server")).runHealth(db as never, { write: false, force: true }), x => ({ ok: !x.errors.length, note: `by hand, nothing filed · ${x.why || x.errors[0] || "ok"}` }));
  console.log("health (not filed)", JSON.stringify({ why: h.why, errors: h.errors, found: (h as unknown as { found?: { key: string; title: string }[] }).found?.map(f => `${f.key} · ${f.title}`) ?? null, facts: (h as unknown as { facts?: { job_runs?: number } }).facts?.job_runs }));
}
