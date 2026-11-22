// N5 proof: `bun scripts/n5.ts holds|pass|hold-review|release-review|sweep|rewrite94|package [base]|drafts-fixture <check>|audience-test|register|scout-fixture|note-tests|health`.
// Fixture calls are recorded as fixtures and store or file nothing; the audience entry and package rows made here are marked as tests.
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
const out = (x: unknown) => console.log(JSON.stringify(x, null, 1));

if (cmd === "holds") {
  // Every story with a hold in force made in the last seven days: whether it is a door hold (never offered to a review pass) or a
  // pass's own; then what the review pass would be offered now, which must contain no door-held story.
  const { holdInForce, doorHeld, holdDesk } = await import("../src/lib/newsroom/holds");
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: ed } = await db.from("story_edits").select("id,story_id,action,payload,note,at").gte("at", since).order("id");
  const ids = [...new Set((ed ?? []).filter(e => e.action === "kill" && (e.payload as { hold?: boolean } | null)?.hold).map(e => e.story_id))];
  const [{ data: all }, { data: rv }, { data: nums }] = await Promise.all([db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_reviews").select("story_id,desk,verdict,at").in("story_id", ids).eq("verdict", "hold"), db.from("story_numbers").select("story_id,number").in("story_id", ids)]);
  const rows = ids.map(id => { const e = (all ?? []).filter(x => x.story_id === id) as never[], r = (rv ?? []).filter(x => x.story_id === id), h = holdInForce(e) as { at: string; note: string | null } | null;
    return { id, number: (nums ?? []).find(n => n.story_id === id)?.number ?? null, in_force: h ? { at: h.at, by: holdDesk(h as never), note: h.note?.slice(0, 90) } : null, door_held: doorHeld(e, r) }; }).filter(x => x.in_force);
  out(rows);
  const { reviewIO } = await import("../src/lib/newsroom/review.server");
  const io = reviewIO(db as never, null);
  const [pending, reoffers, overruled, fixed] = await Promise.all([io.pending(), io.reoffers(), io.overruled!(), io.checklistRechecks!()]);
  const offered = [...pending, ...reoffers, ...overruled, ...fixed].map(p => p.id), door = new Set(rows.filter(r => r.door_held).map(r => r.id));
  out({ offered, door_held_offered: offered.filter(id => door.has(id)) });
}
if (cmd === "pass") {
  const rp = await import("../src/lib/newsroom/review-pass.server");
  out(await rp.runReviewPass(db as never, { byHand: true }));
}
if (cmd === "hold-review" || cmd === "release-review") {
  const { deskDoor } = await import("../src/lib/stories/desk.server");
  const body = cmd === "hold-review" ? { action: "job_hold", job: "review", until: new Date(Date.now() + 15 * 60_000).toISOString(), reason: "N5 proof: freeze before a gated deploy (test)" } : { action: "job_release", job: "review", reason: "N5 proof: deploy measured (test)" };
  out(await deskDoor("engineering", body));
}
if (cmd === "sweep") {
  const { applyEdits } = await import("../src/lib/stories/edits");
  const rows: Record<string, unknown>[] = [];
  for (let f = 0; f < 20000; f += 1000) { const { data } = await db.from("stories").select("id,status,reason,created_at,type,headline").order("created_at").range(f, f + 999); rows.push(...(data ?? [])); if ((data ?? []).length < 1000) break; }
  const edits: Record<string, unknown>[] = [];
  for (let f = 0; f < 20000; f += 1000) { const { data } = await db.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, f + 999); edits.push(...(data ?? [])); if ((data ?? []).length < 1000) break; }
  const byStory = new Map<string, unknown[]>(); for (const e of edits) { const k = e["story_id"] as string; byStory.set(k, [...(byStory.get(k) ?? []), e]); }
  const latest = new Map<string, Record<string, unknown>>(); for (const s of rows) latest.set(s["id"] as string, s);
  const now = Date.now(), want: { id: string; state: string; reason: string | null }[] = [];
  for (const s of latest.values()) { const cur = applyEdits(s as never, (byStory.get(s["id"] as string) ?? []) as never, now) as unknown as { state: string; reason: string | null }; if (cur.state === "published" || cur.state === "held") want.push({ id: s["id"] as string, state: cur.state, reason: cur.reason }); }
  const r = await buildCtx();
  const { reviewInput } = await import("../src/lib/newsroom/review.server");
  const { checklist } = await import("../src/lib/newsroom/standards");
  const fails: unknown[] = []; let ran = 0, noInput = 0, published = 0, withSheet = 0;
  for (const w of want) {
    const i = await reviewInput(w.id, r as never).catch(() => null);
    if (!i) { noInput++; continue; }
    ran++; if (i.state === "published") { published++; if (i.asWritten?.sheet) withSheet++; }
    const n = checklist(i).find(x => x.id === "numbers")!;
    if (n.result === "fail") fails.push({ id: w.id, state: w.state, reason: w.reason?.slice(0, 80), number: i.number ?? null, detail: n.detail });
  }
  out({ swept: ran, published, published_with_stored_sheet: withSheet, no_input: noInput, fails });
  const n85 = await reviewInput("brand:netlify.com:2026-11-20", r as never);
  out({ no85: n85 ? { state: n85.state, written_at: n85.asWritten?.at ?? null, numbers: checklist(n85).find(x => x.id === "numbers") } : null });
}
if (cmd === "rewrite94") {
  // One story-writer call for No. 94 through the normal path and check (the writer's daily limit applies).
  const id = "breakout:combo:immersive_3d:fintech:16";
  const { loadInput, factSource, BUILD_DAYS } = await import("../src/lib/stories/build.server");
  const { allCandidates } = await import("../src/lib/stories/candidates");
  const { writerFacts } = await import("../src/lib/stories/writer-facts");
  const { writeStories, writerIO } = await import("../src/lib/stories/writer.server");
  const { applyEdits } = await import("../src/lib/stories/edits");
  const input = await loadInput({ days: BUILD_DAYS + 7, allRuns: false, realRunIds: [] });
  const { ctx } = allCandidates(input), src = factSource(input, ctx);
  const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
  const [{ data: st }, { data: ed }] = await Promise.all([db.from("stories").select(cols).eq("id", id).single(), db.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", id).order("id")]);
  const s = applyEdits(st as never, (ed ?? []) as never, Date.now());
  const story = { id: s.id, type: s.type, headline: s.headline, deck: s.deck, facts: s.facts, sector: s.sector, signal_keys: s.signal_keys, domains: s.domains, source_ids: s.source_ids, basis: s.basis, happened_at: s.happened_at, kicker: s.kicker };
  const job = { story, ...writerFacts(story, src) };
  const { flatShareFailures, sheetLinesOf } = await import("../src/lib/stories/writer");
  const { data: old } = await db.from("story_texts").select("headline,deck,body,checked,created_at").eq("story_id", id).order("created_at", { ascending: false }).limit(1);
  const o = old?.[0] as { deck: string; body: string[] } | undefined;
  out({ before: o, before_check: o ? flatShareFailures([o.deck, ...(o.body ?? [])].join("\n"), sheetLinesOf(job.facts)) : null, sheet_numbers: job.facts.numbers.map(n => n.text) });
  const r = await writeStories([job], writerIO(db as never), { names: src.known }, { deadline: Date.now() + 120_000, perBuild: 1 });
  out({ written: r.written, checked: r.checked, calls: r.calls, skipped: r.skipped, rows: r.rows.map(x => ({ headline: x.headline, deck: x.deck, body: x.body, how_we_know: x.how_we_know, checked: x.checked, attempts: x.attempts, model: x.model, cost: x.cost, log: x.log })) });
}
if (cmd === "package") {
  const { runPackageCheck } = await import("../src/lib/newsroom/publisher.server");
  const r = await runPackageCheck(db as never, { test: true, base: process.argv[3] ?? "https://slug.global" });
  out(r);
}
if (cmd === "drafts-fixture") {
  const { runDrafts } = await import("../src/lib/newsroom/publisher.server");
  const { data: c } = await db.from("package_checks").select("id,week,pass").eq("id", Number(process.argv[3])).single();
  out(await runDrafts(db as never, { week: c!.week, checkId: c!.id, fixture: true, anyCheck: process.argv.includes("--any-check") }));
}
if (cmd === "audience-test") {
  const { deskDoor } = await import("../src/lib/stories/desk.server");
  out(await deskDoor("publisher", { action: "audience", week: "2026-W47", visitors: 0, pageviews: 0, top: [{ path: "/stories/no/94", views: 0 }], sources: [{ name: "direct", visits: 0 }], test: true }));
}
if (cmd === "register") {
  const { scoutPanel } = await import("../src/lib/newsroom/scout.server");
  const p = await scoutPanel(db as never);
  out(p.register.map(r => ({ name: r.name, status: r.status, terms_read: r.terms_read, terms_link: r.terms_link })));
}
if (cmd === "scout-fixture") {
  const { runCandidates } = await import("../src/lib/newsroom/scout.server");
  out(await runCandidates(db as never, { fixture: true }));
}
if (cmd === "note-tests") {
  // The three fake forecast rows the N4c test suite wrote at 12:07 UTC: marked as tests by an appended note (the rows stay).
  const { data } = await db.from("job_runs").select("id,at,job,phase,ok,note").gte("at", "2026-11-22T12:06:00Z").lt("at", "2026-11-22T12:09:00Z").order("id");
  out(data);
  if (process.argv[3] === "--write") {
    const ids = [...new Set((data ?? []).filter(r => /forecast/.test(r.job)).map(r => r.id))];
    for (const id of ids) { const { error } = await db.from("job_run_notes").insert({ run_id: id, test: true, actor: "engineering", note: "Test row: written by the N4c test suite at 12:07 UTC on 22 Nov before it was guarded; not a real forecast run." }); out({ id, error: error?.message ?? null }); }
  }
}
if (cmd === "health") {
  const r = await fetch(`${process.argv[3] ?? "http://localhost:8080"}/api/public/health`);
  const j = await r.json() as Record<string, unknown>;
  out({ status: r.status, build: j["build"] ?? null, keys: Object.keys(j) });
}
report(cmd ?? "none", performance.now() - t0);
