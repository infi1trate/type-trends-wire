// N3 · /desk's News, Graphics and Data panels and the matching memory facts: today's picks and drops, pictures the graphics desk
// changed, stories with no usable picture, share-image failures, open findings by kind, the backtest score and this week's proposals,
// each desk's calls against its limits. Reads only (service role, behind the editor key).
import type { Admin } from "./review.server";
import { DESK_LIMITS } from "./caps";

const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
/** desk_log rows written as tests while building the desks (marked by an appended `test_mark` row; never edited or deleted). */
export async function testRefs(db: Admin): Promise<string[]> {
  const { data } = await db.from("desk_log").select("subject_id").eq("action", "test_mark").limit(200);
  return (data ?? []).flatMap(x => (x.subject_id ? [x.subject_id] : []));
}
export async function n3Panels(db: Admin, now = Date.now()) {
  const today = dayStart(now), week = new Date(now - 7 * 864e5).toISOString();
  const [calls, picks, drops, pictures, share, backtests, proposals, pitches, findings, tests] = await Promise.all([
    db.from("desk_calls").select("desk,purpose").gte("at", today).neq("purpose", "fixture").limit(500),
    db.from("wire_picks").select("id,at,item_id,subject,line,domain,actor").gte("at", today).order("at", { ascending: false }).limit(20),
    db.from("wire_pick_drops").select("id,at,pick_id,actor,reason").gte("at", week).order("at", { ascending: false }).limit(20),
    db.from("picture_choices").select("id,at,story_id,actor,kind,verdict,reason").gte("at", week).order("id", { ascending: false }).limit(60),
    db.from("share_checks").select("at,checked,rebuilt,failures").order("id", { ascending: false }).limit(1),
    db.from("forecast_backtests").select("at,run_id,scored_run_id,days,calls,right_calls,mean_miss").order("id", { ascending: false }).limit(8),
    db.from("desk_log").select("at,action,reason,subject_id").eq("actor", "data").in("action", ["propose", "pitch"]).gte("at", week).order("at", { ascending: false }).limit(10),
    db.from("desk_log").select("at,reason").eq("actor", "news").eq("action", "pitch").gte("at", week).order("at", { ascending: false }).limit(10),
    (await import("./datadesk.server")).openFindings(db).catch(() => []),
    testRefs(db).catch(() => []),
  ]);
  const used = new Map<string, number>(); for (const c of calls.data ?? []) used.set(`${c.desk}|${c.purpose}`, (used.get(`${c.desk}|${c.purpose}`) ?? 0) + 1);
  const limits = DESK_LIMITS.filter(l => l.desk === "news" || l.desk === "graphics" || l.desk === "data").map(l => ({ desk: l.desk, what: l.what, cap: l.cap, used: used.get(`${l.desk}|${l.purpose}`) ?? 0 }));
  const items = (picks.data ?? []).map(p => p.item_id);
  const { data: wi } = items.length ? await db.from("wire_items").select("id,title,url,source").in("id", items) : { data: [] };
  const byItem = new Map((wi ?? []).map(w => [w.id, w]));
  const dropped = new Map((drops.data ?? []).map(d => [d.pick_id, d]));
  const storyIds = [...new Set((pictures.data ?? []).map(p => p.story_id))];
  const { data: heads } = storyIds.length ? await db.from("stories").select("id,headline").in("id", storyIds) : { data: [] };
  const head = new Map((heads ?? []).map(h => [h.id, h]));
  const pics = (pictures.data ?? []).map(p => ({ ...p, headline: head.get(p.story_id)?.headline ?? p.story_id, number: null as number | null }));
  const byKind: Record<string, number> = {}; for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  const bt = backtests.data ?? [];
  return {
    limits,
    news: { picks: (picks.data ?? []).map(p => ({ ...p, title: byItem.get(p.item_id)?.title ?? "", url: byItem.get(p.item_id)?.url ?? "", outlet: byItem.get(p.item_id)?.source ?? "", dropped: dropped.get(p.id)?.reason ?? null })), drops: drops.data ?? [], pitches: pitches.data ?? [] },
    graphics: { changed: pics.filter(p => p.verdict === "alternate" || (p.actor !== "graphics" && p.kind !== "rule")), none: pics.filter(p => p.kind === "none"), fallbacks: pics.filter(p => p.verdict === "fallback").length, kept: pics.filter(p => p.verdict === "keep").length, share: share.data?.[0] ?? null },
    data: { byKind, newest: findings.slice(0, 10).map(f => ({ id: f.id, at: f.at, kind: f.kind, subject: f.subject, text: [f.measure, f.expected ? `expected ${f.expected}` : null, f.found ? `found ${f.found}` : null].filter(Boolean).join(" · ") })), open: findings.length, backtest: bt[0] ? { ...bt[0], line: `${bt[0].right_calls} of ${bt[0].calls} calls right on forecast run ${bt[0].scored_run_id} (${Math.round(Number(bt[0].days))} days), mean miss ${bt[0].mean_miss == null ? "–" : Number(bt[0].mean_miss).toFixed(2)} points` } : null, running: bt.length ? { calls: bt.reduce((s, b) => s + b.calls, 0), right: bt.reduce((s, b) => s + b.right_calls, 0) } : null, proposals: proposals.data ?? [] },
    tests,
  };
}

/** N4 · /desk's Design review and Engineering panels and the matching memory facts: the newest weekly review run against the one before,
 *  its breaches, the newest test runs, this week's design proposals with their statuses and the calls used; the build queue by status,
 *  the newest gate result with every check, the health run's open items and credits per item. Reads only. */
export async function n4Panels(db: Admin, now = Date.now()) {
  const [dr, g, { loadReviews }, { loadQueueItems, newestGate }, { loadProposals }, { QUEUE_STATUSES }, { HEALTH_PREFIX }] = await Promise.all([
    import("./design-review"), import("./build-gate"), import("./design-review.server"), import("./engineering.server"), import("./newsroom.server"), import("./queue"), import("./engineering")]);
  const today = dayStart(now), week = new Date(now - 7 * 864e5).toISOString();
  const [rows, items, gate, proposals, tests, calls, health] = await Promise.all([
    loadReviews(db, { days: 60 }), loadQueueItems(db, { limit: 300 }), newestGate(db), loadProposals(db).catch(() => []), testRefs(db).catch(() => []),
    db.from("desk_calls").select("purpose,at,ok,cost").eq("desk", "design review").gte("at", week).limit(200),
    db.from("desk_log").select("at,reason,detail").eq("actor", "engineering").eq("action", "data_run").eq("subject_id", "health").order("id", { ascending: false }).limit(1),
  ]);
  const runs = dr.runsOf(rows), w = dr.weeklyRuns(rows), wb = dr.weeklyBreaches(rows);
  const rowsOf = (run: string | undefined) => rows.filter(r => r.run === run);
  const testRuns = runs.filter(r => r.kind === "test").slice(0, 2);
  const summary = (run: string) => [...dr.cellsOf(rowsOf(run)).values()].map(r => ({ page: r.page, width: r.width, measures: r.measures, picture: !!r.picture, against: r.against }));
  const marked = new Set(tests);
  const design = proposals.filter(p => p.desk === "design review" && p.at >= week).map(p => ({ ...p, test: marked.has(`log:${p.id}`) }));
  const c = calls.data ?? [];
  // Counts are real items only; test items (the N4 proof) are listed, marked TEST, and counted apart.
  const byStatus = { ...Object.fromEntries(QUEUE_STATUSES.map(s => [s, items.filter(i => i.status === s && !i.test).length])), tests: items.filter(i => i.test).length };
  const slim = (i: (typeof items)[number]) => ({ id: i.id, at: i.at, title: i.title, why: i.why, desk: i.desk, kind: i.kind, expects: i.expects, status: i.status, source: i.source_kind, source_ref: i.source_ref, proposal: i.proposal, proposal_log: i.proposal_log_id, key: i.ikey, test: i.test, credits: i.credits, gate: i.gate, moves: i.moves });
  return {
    design: {
      runs: runs.slice(0, 8),
      newest: w.newest ? { ...w.newest, rows: summary(w.newest.run) } : null, previous: w.previous ?? null,
      diff: w.newest && w.previous ? dr.runDiff(rowsOf(w.newest.run), rowsOf(w.previous.run)) : [],
      breaches: wb.breaches.map(b => ({ ...b, line: dr.breachLine(b) })), budgets: wb.budgets.length,
      tests: testRuns.length ? { newest: { ...testRuns[0]!, rows: summary(testRuns[0]!.run) }, previous: testRuns[1] ?? null, diff: testRuns[1] ? dr.runDiff(rowsOf(testRuns[0]!.run), rowsOf(testRuns[1].run)) : [] } : null,
      proposals: design, proposals_counted: design.filter(p => !p.test).length, per_week: dr.PROPOSALS_PER_WEEK,
      calls: { today: c.filter(x => x.purpose === "review" && x.at >= today).length, week: c.filter(x => x.purpose === "review").length, fixtures_week: c.filter(x => x.purpose === "fixture").length, cap: (await import("./caps")).capOf("design review", "review"), usd_week: Math.round(c.reduce((s, x) => s + Number(x.cost ?? 0), 0) * 1e4) / 1e4 },
      pages: dr.REVIEW_PAGES, widths: dr.REVIEW_WIDTHS, rules: dr.BUDGET_RULES,
      waiting_moves: items.filter(i => i.kind === "design move" && i.proposal === "accepted" && i.open && !i.test).length,
    },
    engineering: {
      by_status: byStatus, items: items.slice(0, 60).map(slim),
      gate: gate ? { ...gate, item_title: items.find(i => i.id === gate.item_id)?.title ?? null } : null,
      checks: g.GATE_CHECKS, visible: g.VISIBLE_LIMITS, no_worse: g.NO_WORSE,
      health: items.filter(i => i.open && i.desk === "engineering" && i.ikey?.startsWith(HEALTH_PREFIX)).map(slim),
      health_run: health.data?.[0] ?? null,
      credits: items.filter(i => i.credits > 0).map(i => ({ id: i.id, title: i.title, credits: i.credits })),
      // N4b · the job holds in force (who, why, until when) and today's share and chart passes.
      holds: await import("./passes.server").then(m => m.heldJobs(db, now)).catch(() => []),
      passes: await import("./passes.server").then(m => m.passesPanel(db, now)).catch(() => null),
    },
  };
}
