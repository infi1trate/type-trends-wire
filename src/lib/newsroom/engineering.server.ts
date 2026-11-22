// N4 · the build queue's store behind the door (append-only items, moves and gate results), the gate's loads, and the engineering
// desk's daily health run over stored run records (job names, run times, durations and success only). Rules are in queue.ts,
// build-gate.ts and engineering.ts. Service role only; every decision goes through the door.
import type { Admin } from "./review.server";
import * as q from "./queue";
import type { Problem } from "./engineering";

type ItemRow = { id: number; at: string; title: string; why: string; desk: string; kind: string; expects: string; source_kind: string; source_ref: string | null; proposal_log_id: number | null; ikey: string | null; move: unknown; test: boolean };
type MoveRow = { id: number; at: string; item_id: number; status: string; actor: string; reason: string | null };
export type QueueItem = ItemRow & { status: q.QueueStatus; open: boolean; moves: q.QueueMove[]; proposal: "open" | "accepted" | "declined" | null; gate: { id: number; at: string; pass: boolean; commit_sha: string } | null; credits: number };
const COLS = "id,at,title,why,desk,kind,expects,source_kind,source_ref,proposal_log_id,ikey,move,test";

export async function proposalStatuses(db: Admin, ids: number[]): Promise<Map<number, "open" | "accepted" | "declined">> {
  const out = new Map<number, "open" | "accepted" | "declined">();
  if (!ids.length) return out;
  const { data, error } = await db.from("proposal_statuses").select("log_id,status").in("log_id", ids).order("id", { ascending: false });
  if (error) throw new Error("proposal_statuses_read_failed");
  for (const s of data ?? []) if (!out.has(s.log_id)) out.set(s.log_id, s.status as "open" | "accepted" | "declined");
  for (const id of ids) if (!out.has(id)) out.set(id, "open");
  return out;
}
/** Items with their status, moves, proposal status, newest gate result and credits spent (newest first). */
export async function loadQueueItems(db: Admin, o: { ids?: number[]; limit?: number } = {}): Promise<QueueItem[]> {
  let iq = db.from("build_queue").select(COLS).order("id", { ascending: false }).limit(o.limit ?? 500);
  if (o.ids) iq = iq.in("id", o.ids);
  const { data: items, error } = await iq;
  if (error) throw new Error("queue_read_failed");
  const ids = (items ?? []).map(i => i.id);
  if (!ids.length) return [];
  const [mv, gr, sp] = await Promise.all([
    db.from("build_queue_moves").select("id,at,item_id,status,actor,reason").in("item_id", ids).order("id"),
    db.from("gate_results").select("id,at,item_id,pass,commit_sha").in("item_id", ids).order("id", { ascending: false }),
    db.from("spend_entries").select("queue_item,credits").in("queue_item", ids),
  ]);
  if (mv.error || gr.error || sp.error) throw new Error("queue_read_failed");
  const props = await proposalStatuses(db, (items ?? []).flatMap(i => (i.proposal_log_id ? [i.proposal_log_id] : [])));
  return ((items ?? []) as ItemRow[]).map(i => {
    const moves = ((mv.data ?? []) as MoveRow[]).filter(m => m.item_id === i.id).map(m => ({ status: m.status as q.QueueStatus, actor: m.actor, reason: m.reason, at: m.at }));
    const status = q.statusOf(moves), g = (gr.data ?? []).find(x => x.item_id === i.id) ?? null;
    return { ...i, status, open: q.isOpenStatus(status), moves, proposal: i.proposal_log_id ? props.get(i.proposal_log_id) ?? "open" : null, gate: g ? { id: g.id, at: g.at, pass: g.pass, commit_sha: g.commit_sha } : null,
      credits: (sp.data ?? []).filter(s => s.queue_item === i.id).reduce((s, x) => s + Number(x.credits), 0) };
  });
}
const itemOf = async (db: Admin, id: number) => (await loadQueueItems(db, { ids: [id] }))[0] ?? null;

/** The door's store for `queue_add`: a stable key is not filed twice while its item is open; a proposal source must be a proposal. */
export async function insertQueueItem(db: Admin, r: { title: string; why: string; desk: string; kind: string; expects: string; source_kind: string; source_ref: string | null; proposal_log_id: number | null; ikey: string | null; move: unknown; test: boolean; phase?: string }): Promise<{ id: number; existing: boolean } | { refused: string }> {
  if (r.proposal_log_id != null) {
    const { data, error } = await db.from("desk_log").select("id").eq("id", r.proposal_log_id).eq("action", "propose").eq("decision", "proposed").maybeSingle();
    if (error) throw new Error("proposal_lookup_failed");
    if (!data) return { refused: `Desk log row ${r.proposal_log_id} is not a proposal.` };
  }
  if (r.ikey) {
    const { data, error } = await db.from("build_queue").select("id").eq("ikey", r.ikey).order("id", { ascending: false }).limit(20);
    if (error) throw new Error("queue_read_failed");
    const open = (data?.length ? await loadQueueItems(db, { ids: data.map(x => x.id) }) : []).find(x => x.open);
    if (open) return { id: open.id, existing: true };
  }
  const { data, error } = await db.from("build_queue").insert({ title: r.title, why: r.why, desk: r.desk, kind: r.kind, expects: r.expects, source_kind: r.source_kind, source_ref: r.source_ref, proposal_log_id: r.proposal_log_id, ikey: r.ikey, move: (r.move ?? null) as never, test: r.test, ...(r.phase ? { phase: r.phase } : {}) } as never).select("id").single();
  // L2 · kind `phase` needs the queue's stored kind list widened and a phase column (owner's approval pending): until then the store
  // refuses it plainly rather than failing the door.
  if (error && r.kind === "phase" && (error.code === "23514" || error.code === "42703" || error.code === "PGRST204")) return { refused: "The build queue does not take phase items yet: its database change is waiting for the owner's approval." };
  if (error || !data) throw new Error("queue_insert_failed");
  const m = await db.from("build_queue_moves").insert({ item_id: data.id, status: "queued", actor: r.desk, reason: "filed" });
  if (m.error) throw new Error("queue_move_insert_failed");
  return { id: data.id, existing: false };
}
/** The door's store for `queue_move`: the order and its conditions from queue.ts. Null when there is no such item. */
export async function moveQueueItem(db: Admin, r: { item: number; to: string; actor: string; reason: string | null }): Promise<{ status: q.QueueStatus } | { refused: string } | null> {
  const it = await itemOf(db, r.item);
  if (!it) return null;
  const d = q.moveDecision({ kind: it.kind, status: it.status, to: r.to, actor: r.actor, reason: r.reason, proposal: it.proposal, gatePass: it.gate ? it.gate.pass : null });
  if (!d.ok) return { refused: d.reason };
  const { error } = await db.from("build_queue_moves").insert({ item_id: it.id, status: r.to, actor: r.actor, reason: r.reason });
  if (error) throw new Error("queue_move_insert_failed");
  return { status: r.to as q.QueueStatus };
}
/** The door's store for `gate_result`: code works the verdict out from the two review runs and the test numbers, stores every check
 *  with its numbers and moves the item to gate passed or gate failed. Null when there is no such item. */
export async function recordGate(db: Admin, r: { item: number; commit: string; tests: { passed: number; failed: number; skipped: number }; before_run: string; after_run: string; actor: string }) {
  const it = await itemOf(db, r.item);
  if (!it) return null;
  if (!q.GATE_FROM.includes(it.status)) return { refused: `A gate result is recorded for a built item; this one is ${it.status}.` };
  const [{ loadReviews }, { gateVerdict }, { LIVE_VALUES }] = await Promise.all([import("./design-review.server"), import("./build-gate"), import("../living/editions")]);
  const rows = await loadReviews(db, { runs: [r.before_run, r.after_run] });
  const side = (run: string) => { const rs = rows.filter(x => x.run === run); return { run, kind: rs[0]?.kind ?? null, rows: rs }; };
  const mv = it.move && typeof it.move === "object" ? (it.move as { setting: string; from?: never; to: never }) : null;
  const v = gateVerdict({ item: { kind: it.kind, expects: it.expects as q.Expects, move: mv }, tests: r.tests, before: side(r.before_run), after: side(r.after_run), proposal: it.proposal, live: LIVE_VALUES });
  const { data, error } = await db.from("gate_results").insert({ item_id: it.id, commit_sha: r.commit.toLowerCase(), tests: r.tests as never, before_run: r.before_run, after_run: r.after_run, pass: v.pass, checks: v.checks as never, actor: "engineering" }).select("id").single();
  if (error || !data) throw new Error("gate_insert_failed");
  const failed = v.checks.filter(c => !c.ok);
  const m = await db.from("build_queue_moves").insert({ item_id: it.id, status: v.pass ? "gate passed" : "gate failed", actor: "engineering", reason: (v.pass ? `Gate ${data.id} passed: every check passed.` : `Gate ${data.id} failed: ${failed.map(c => c.id).join(", ")}.`).slice(0, 600), detail: { gate: data.id, commit: r.commit } as never });
  if (m.error) throw new Error("queue_move_insert_failed");
  return { id: data.id, pass: v.pass, checks: v.checks };
}
export async function newestGate(db: Admin) {
  const { data } = await db.from("gate_results").select("id,at,item_id,commit_sha,tests,before_run,after_run,pass,checks").order("id", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}
/** Is there such a queue item (for `spend`)? */
export async function queueItemExists(db: Admin, id: number) { const { data } = await db.from("build_queue").select("id").eq("id", id).maybeSingle(); return !!data; }

// THE DAILY HEALTH RUN ---------------------------------------------------------------------------------------------------------------
export type HealthRun = { ran: boolean; why: string; found: Problem[]; filed: { key: string; item: number | null; existing: boolean }[]; declined: number[]; errors: string[]; facts: Record<string, unknown> };
/** One day's health run (code, no model). `write` files new bug items and declines gone ones through the door as `engineering`. */
export async function runHealth(db: Admin, o: { now?: number; write?: boolean; force?: boolean } = {}): Promise<HealthRun> {
  const now = o.now ?? Date.now(), out: HealthRun = { ran: false, why: "", found: [], filed: [], declined: [], errors: [], facts: {} };
  try {
    const e = await import("./engineering");
    if (o.write && !o.force) {
      const d = new Date(now); d.setUTCHours(0, 0, 0, 0);
      const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).eq("actor", "engineering").eq("action", "data_run").eq("subject_id", "health").gte("at", d.toISOString());
      if ((count ?? 0) > 0) { out.why = "already ran today"; return out; }
    }
    const since = new Date(now - e.HEALTH_DAYS * 864e5).toISOString(), day = new Date(now - 864e5).toISOString();
    const [ing, hist, crawl, fc, calls, usage, st, sy, dg, rv] = await Promise.all([
      db.from("ingest_runs").select("job,started_at,finished_at,ok,error:detail->>error").gte("started_at", since).order("started_at", { ascending: false }).limit(5000),
      db.from("library_history_runs").select("kind,started_at,finished_at,ms").gte("started_at", since).order("started_at", { ascending: false }).limit(2000),
      db.from("crawl_runs").select("status,started_at,finished_at").gte("started_at", new Date(now - 60 * 864e5).toISOString()).order("started_at", { ascending: false }).limit(50),
      db.from("forecast_runs").select("status,computed_at,error").gte("computed_at", new Date(now - 60 * 864e5).toISOString()).order("id", { ascending: false }).limit(50),
      db.from("desk_calls").select("at,desk,ok,purpose,usage_id").gte("at", new Date(now - 864e5 - 36e5).toISOString()).limit(4000),
      db.from("ai_usage").select("id,ok").eq("kind", "story_why").is("snapshot_id", null).neq("state", "rejected").gte("created_at", day).limit(5000),
      db.from("story_texts").select("checked").gte("created_at", day).limit(2000),
      db.from("study_texts").select("failures").gte("created_at", day).limit(2000),
      db.from("digest_texts").select("passed").gte("created_at", day).limit(500),
      import("./design-review.server").then(m => m.loadReviews(db, { days: 30 })),
    ]);
    for (const r of [ing, hist, crawl, fc, calls, usage, st, sy, dg]) if (r.error) throw new Error("health_inputs_read_failed");
    const found: Problem[] = [];
    const jobs = new Map<string, import("./engineering").JobRun[]>();
    for (const r of ing.data ?? []) jobs.set(r.job, [...(jobs.get(r.job) ?? []), { started_at: r.started_at, finished_at: r.finished_at, ok: r.ok, error: (r as { error?: string | null }).error ?? null }]);
    jobs.set("library-history-refresh", (hist.data ?? []).filter(r => r.kind === "job").map(r => ({ started_at: r.started_at, finished_at: r.finished_at, ok: null })));
    jobs.set("crawl", (crawl.data ?? []).map(r => ({ started_at: r.started_at, finished_at: r.finished_at, ok: r.status === "finished" ? true : r.status === "running" ? null : false })));
    jobs.set("forecast", (fc.data ?? []).filter(r => r.computed_at).map(r => ({ started_at: r.computed_at!, finished_at: null, ok: r.status === "ok" ? true : r.status === "error" ? false : null, error: r.error ? String(r.error).slice(0, 160) : null })));
    for (const [name, runs] of jobs) found.push(...e.jobProblems(name, runs, now));
    // N4c · the product's own run rows: a run that started and never finished, or one over three times its 14-day median.
    const jr = await import("../jobs/runs");
    const runRows = jr.pairRuns(await (await import("../jobs/runs.server")).loadRunRows(db, { days: e.HEALTH_DAYS, now }), now);
    for (const job of Object.keys(jr.RUN_JOBS)) found.push(...jr.runProblems(job, runRows, e.HEALTH_PREFIX));
    const { healthPayload } = await import("../health.server");
    const h = await healthPayload().catch(() => null);
    found.push(...e.staleProblems(h?.jobs ?? []));
    const runs = (await import("./design-review")).runsOf(rv).filter(r => r.kind !== "test");
    const newest = runs[0] ? { run: runs[0].run, rows: rv.filter(x => x.run === runs[0]!.run) } : null;
    found.push(...e.speedProblems(newest));
    // Desk text calls go through the writers' gateway too; a usage row a desk call names is the desk's, not a writer's (fixtures included).
    const deskUsage = new Set((calls.data ?? []).map(c => c.usage_id).filter((x): x is number => typeof x === "number"));
    const deskCalls = (calls.data ?? []).filter(c => c.purpose !== "fixture" && c.at >= day);
    found.push(...e.callProblems([...deskCalls.map(c => ({ who: `the ${c.desk} desk`, ok: !!c.ok })), ...(usage.data ?? []).filter(u => !deskUsage.has(u.id)).map(u => ({ who: "the writers' model", ok: !!u.ok }))]));
    found.push(...e.checkProblems([...(st.data ?? []).map(t => ({ writer: "story", passed: !!t.checked })), ...(sy.data ?? []).map(t => ({ writer: "study", passed: !(t.failures ?? []).length })), ...(dg.data ?? []).map(t => ({ writer: "Digest", passed: !!t.passed }))]));
    const nh = (hist.data ?? [])[0];
    found.push(...e.historyProblem(nh ? { ms: nh.ms, started_at: nh.started_at } : null));
    out.found = found; out.ran = true;
    out.facts = { jobs: [...jobs.entries()].map(([name, rs]) => ({ name, runs: rs.length, newest: rs[0]?.started_at ?? null, newest_ok: rs[0]?.ok ?? null })), job_runs: runRows.length, review_run: newest?.run ?? null, desk_calls_24h: deskCalls.length, writer_calls_24h: (usage.data ?? []).filter(u => !deskUsage.has(u.id)).length, texts_24h: (st.data?.length ?? 0) + (sy.data?.length ?? 0) + (dg.data?.length ?? 0), history_ms: nh?.ms ?? null };
    out.why = `${found.length} problems found`;
    if (!o.write) return out;
    const { deskDoor } = await import("../stories/desk.server");
    const open = (await loadQueueItems(db)).filter(i => i.open && !i.test && i.desk === "engineering" && i.ikey?.startsWith(e.HEALTH_PREFIX));
    const r = e.reconcileHealth(open.map(i => ({ id: i.id, key: i.ikey })), found);
    for (const p of found) {
      const res = await deskDoor("engineering", { action: "queue_add", title: p.title.slice(0, 140), why: p.why.slice(0, 600), kind: "bug", expects: "no visible change", source: { kind: "none" }, key: p.key });
      const b = res.body as { item?: number; existing?: boolean };
      if (res.status < 300) out.filed.push({ key: p.key, item: b.item ?? null, existing: !!b.existing }); else out.errors.push(`${p.key}: ${res.status}`);
    }
    for (const id of r.close) { const res = await deskDoor("engineering", { action: "queue_move", item: id, to: "declined", reason: q.NO_LONGER_FOUND }); if (res.status < 300) out.declined.push(id); }
    await deskDoor("engineering", { action: "data_run", run: "health", summary: `Health run: ${found.length} problems; ${out.filed.filter(f => !f.existing).length} filed, ${out.filed.filter(f => f.existing).length} already open, ${out.declined.length} no longer found.`, counts: { found: found.length, filed: out.filed.filter(f => !f.existing).length, open: out.filed.filter(f => f.existing).length, declined: out.declined.length } });
  } catch (err) { out.errors.push(err instanceof Error ? err.message.slice(0, 160) : "error"); }
  return out;
}
