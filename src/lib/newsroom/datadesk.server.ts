// N3 · the data desk's I/O: the findings store behind the door (append-only open and close rows), the daily checks over stored data,
// the weekly forecast backtest and the weekly proposal call. Loads and records only; every rule is in datadesk.ts. Service role only;
// each finding and each run goes through the door as `data`.
import type { Admin } from "./review.server";
import * as dd from "./datadesk";

const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
type FindingRow = { id: number; at: string; op: string; finding_id: number | null; kind: string | null; fkey: string | null; subject: string | null; measure: string | null; expected: string | null; found: string | null; receipt: unknown; actor: string; reason: string | null };

/** Open findings (an open row with no close row), newest first. */
export async function openFindings(db: Admin): Promise<(dd.OpenFinding & { key: string; at: string; expected: string | null; receipt: unknown })[]> {
  const rows: FindingRow[] = [];
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await db.from("data_findings").select("id,at,op,finding_id,kind,fkey,subject,measure,expected,found,receipt,actor,reason").order("id", { ascending: false }).range(f, f + 999);
    if (error) throw new Error("findings_read_failed");
    rows.push(...((data ?? []) as FindingRow[]));
    if (!data || data.length < 1000) break;
  }
  const closed = new Set(rows.filter(r => r.op === "close").map(r => r.finding_id));
  return rows.filter(r => r.op === "open" && !closed.has(r.id)).map(r => ({ id: r.id, at: r.at, kind: r.kind!, key: r.fkey!, subject: r.subject!, measure: r.measure, found: r.found, expected: r.expected, receipt: r.receipt }));
}
export async function insertFinding(db: Admin, r: { kind: string; fkey: string; subject: string; measure: string | null; expected: string | null; found: string | null; receipt: Record<string, unknown>; actor: string }): Promise<{ id: number; existing: boolean }> {
  const { data: had, error: e1 } = await db.from("data_findings").select("id").eq("op", "open").eq("fkey", r.fkey).order("id", { ascending: false }).limit(5);
  if (e1) throw new Error("finding_read_failed");
  if ((had ?? []).length) {
    const { data: cl } = await db.from("data_findings").select("finding_id").eq("op", "close").in("finding_id", (had ?? []).map(x => x.id));
    const closed = new Set((cl ?? []).map(x => x.finding_id));
    const open = (had ?? []).find(x => !closed.has(x.id));
    if (open) return { id: open.id, existing: true };
  }
  const { data, error } = await db.from("data_findings").insert({ op: "open", kind: r.kind, fkey: r.fkey.slice(0, 300), subject: r.subject.slice(0, 300), measure: r.measure, expected: r.expected?.slice(0, 600) ?? null, found: r.found?.slice(0, 600) ?? null, receipt: r.receipt as never, actor: r.actor }).select("id").single();
  if (error || !data) throw new Error("finding_insert_failed");
  return { id: data.id, existing: false };
}
export async function closeFinding(db: Admin, r: { finding_id: number; actor: string; reason: string }): Promise<{ id: number } | null> {
  const [o, c] = await Promise.all([db.from("data_findings").select("id").eq("op", "open").eq("id", r.finding_id).maybeSingle(), db.from("data_findings").select("id").eq("op", "close").eq("finding_id", r.finding_id).limit(1)]);
  if (o.error || c.error) throw new Error("finding_read_failed");
  if (!o.data || (c.data ?? []).length) return null;
  const { data, error } = await db.from("data_findings").insert({ op: "close", finding_id: r.finding_id, actor: r.actor, reason: r.reason.slice(0, 600) }).select("id").single();
  if (error || !data) throw new Error("finding_close_failed");
  return { id: data.id };
}

// LOADS ---------------------------------------------------------------------------------------------------------------------------------
async function pages<T>(q: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, max = 20000, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let f = 0; f < max; f += size) { const { data, error } = await q(f, f + size - 1); if (error) throw error; const rows = (data ?? []) as T[]; out.push(...rows); if (rows.length < size) break; }
  return out;
}
async function activeSites(db: Admin) {
  return pages<{ domain: string; name: string | null; sector: string; last_snapshot_at: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,last_snapshot_at").eq("active", true).order("domain").range(f, t));
}
/** The brand cards readers see (stored records), as the contradiction check reads them. */
async function storedCards(db: Admin, active: ReadonlySet<string>): Promise<dd.CardFacts[]> {
  const rows = await pages<{ key: string; computed_at: string; theme: string | null; layout: { id: string; value: string }[] | null; palette: { hex: string; name: string; share: number | null }[] | null; accent: { hex: string; name: string } | null }>((f, t) =>
    db.from("read_records").select("key,computed_at,theme:body->identity->>theme,layout:body->identity->layout,palette:body->identity->palette,accent:body->identity->accent").like("key", "brand-card:%").order("key").range(f, t), 5000, 500);
  return rows.map(r => ({ domain: r.key.slice("brand-card:".length), name: "", theme: r.theme, hero: (r.layout ?? []).find(x => x.id === "hero")?.value ?? null, palette: [...(r.palette ?? []), ...(r.accent ? [{ ...r.accent, share: null }] : [])], at: r.computed_at })).filter(c => active.has(c.domain));
}
type Ev = { id: number; domain: string; type: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; detected_at: string; effective_at: string | null; source: string; page_type: string | null; viewport: string | null; snapshot_id: number | null; prev_snapshot_id: number | null };
async function tapeEvents(db: Admin, days: number) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rows = await pages<Ev>((f, t) => db.from("library_event_feed").select("id,domain,type,before,after,detected_at,effective_at,source,page_type,viewport,snapshot_id,prev_snapshot_id").eq("source", "live").neq("type", "new_surface").gte("detected_at", since).order("id").range(f, t), 5000);
  const { latestChecks } = await import("../integrity.server");
  const checks = await latestChecks(db, rows.map(r => r.id)).catch(() => new Map());
  return { rows, checks, tape: rows.filter(r => checks.get(r.id)?.verdict === "pass") };
}

export type DataRun = { ran: boolean; why: string; counts: Record<string, number>; opened: number; closed: number; findings: dd.Finding[]; errors: string[] };
/**
 * One day's checks (code, no model). `write` opens new findings and closes ones the run no longer finds, through the door as `data`, and
 * logs the run; without it the run only reports (the proof). Runs once a UTC day unless `force`. Never throws.
 */
export async function runDataChecks(db: Admin, o: { now?: number; write?: boolean; force?: boolean } = {}): Promise<DataRun> {
  const now = o.now ?? Date.now(), out: DataRun = { ran: false, why: "", counts: {}, opened: 0, closed: 0, findings: [], errors: [] };
  try {
    if (o.write && !o.force) {
      const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).eq("actor", "data").eq("action", "data_run").eq("subject_id", "checks").gte("at", dayStart(now));
      if ((count ?? 0) > 0) { out.why = "already ran today"; return out; }
    }
    const sites = await activeSites(db), active = new Set(sites.map(s => s.domain));
    const [{ validMonthly }, { carouselIds }, { computeChecks }, { brandName }, { nameAppears }, { allowed }] = await Promise.all([import("../library-diff"), import("../carousel.server"), import("../integrity.server"), import("../brand-names"), import("../name-check"), import("./standards")]);
    const [cards, ev] = await Promise.all([storedCards(db, active), tapeEvents(db, 120)]);
    const home = ev.tape.filter(e => (e.page_type ?? "home") === "home" && (e.viewport ?? "desktop") === "desktop" && active.has(e.domain));
    // 1 · contradictions: the card against the change log's newest confirmed value.
    const log: dd.LogFact[] = home.flatMap(e => (["hero_media", "theme"] as const).flatMap(f => { const v = e.after?.[f]; const pass = ev.checks.get(e.id)?.pass ?? []; return typeof v === "string" && pass.includes(f) ? [{ domain: e.domain, field: f, value: v, event: e.id, at: e.effective_at ?? e.detected_at }] : []; }));
    const findings: dd.Finding[] = [...dd.contradictions(cards, log)];
    // 2 · detector sample: 25 measured changes from the last 30 days, re-derived from their stored captures under today's rules.
    const recent = ev.tape.filter(e => Date.parse(e.detected_at) >= now - 30 * 864e5 && e.type !== "imagery_shift" && e.type !== "aesthetic_shift" && active.has(e.domain));
    const pick = new Set(dd.sampleIds(recent.map(e => e.id), new Date(now).toISOString().slice(0, 10)));
    const sample = recent.filter(e => pick.has(e.id));
    const [today, rot] = await Promise.all([computeChecks(db as never, sample as never), carouselIds(db as never, sample as never)]);
    const rotating = new Set(rot);
    findings.push(...dd.detectorFindings(sample.map(e => { const t = today.get(e.id); return { id: e.id, domain: e.domain, type: e.type, detected_at: e.detected_at, stored: ev.checks.get(e.id)?.pass ?? [], rotating: rotating.has(e.id), today: { verdict: t?.verdict ?? "not checked", pass: t?.pass ?? [], failed: Object.values(t?.fields ?? {}).flatMap(f => f.failed).map(String) } }; })));
    // 3 · values that cannot be true, on the tape and on the cards.
    const colours: dd.ShownColour[] = cards.flatMap(c => c.palette.filter(p => /^#[0-9a-f]{6}$/i.test(p.hex) && p.name).map(p => ({ where: `card:${c.domain}`, subject: c.domain, name: p.name, hex: p.hex })));
    findings.push(...dd.impossibleFindings(ev.tape.filter(e => active.has(e.domain)).map(e => ({ id: e.id, domain: e.domain, before: e.before ?? {}, after: e.after ?? {}, detected_at: e.detected_at })), colours, validMonthly));
    // 4 · coverage: a good capture (a title or a headline) in the last three days; sectors; pages chosen as product.
    const since4 = new Date(now - 4 * 864e5).toISOString(), since14 = new Date(now - 14 * 864e5).toISOString();
    const caps = await pages<{ domain: string; captured_at: string; title: string | null; h1: string | null }>((f, t) => db.from("library_snapshots").select("domain,captured_at,title:signals->>title,h1:signals->lexicon->>h1").eq("page_type", "home").eq("viewport", "desktop").eq("source", "live").gte("captured_at", since4).order("id", { ascending: false }).range(f, t), 20000, 500);
    const latest = new Map<string, { title: string | null; h1: string | null; captured_at: string }>(), good = new Map<string, string>();
    for (const c of caps) { if (!latest.has(c.domain)) latest.set(c.domain, c); if ((c.title?.trim() || c.h1?.trim()) && !good.has(c.domain)) good.set(c.domain, c.captured_at); }
    const products = await pages<{ domain: string; url: string | null; title: string | null; captured_at: string }>((f, t) => db.from("library_snapshots").select("domain,url,title:signals->>title,captured_at").eq("page_type", "product").eq("viewport", "desktop").eq("source", "live").gte("captured_at", since14).order("id", { ascending: false }).range(f, t), 5000, 500);
    findings.push(...dd.coverageFindings(sites.map(s => ({ domain: s.domain, name: s.name ?? s.domain, sector: s.sector, last_good: good.get(s.domain) ?? (s.last_snapshot_at && Date.parse(s.last_snapshot_at) < now - 4 * 864e5 ? s.last_snapshot_at : null) })), products.filter(p => active.has(p.domain)), now));
    // 5 · wrong website: the name in its own title or headline, or on the allow-list with the same title.
    findings.push(...dd.wrongWebsite(sites.filter(s => latest.has(s.domain)).map(s => { const l = latest.get(s.domain)!, name = brandName(s.domain, s.name); return { domain: s.domain, name, title: l.title, nameInTitle: nameAppears([s.name, name], s.domain, [l.title, l.h1]), allowed: allowed({ domain: s.domain, title: l.title }) }; })));
    out.findings = findings; out.ran = true;
    for (const f of findings) out.counts[f.kind] = (out.counts[f.kind] ?? 0) + 1;
    out.why = `${findings.length} found: ${Object.entries(out.counts).map(([k, n]) => `${n} ${k}`).join(", ") || "none"}`;
    if (!o.write) return out;
    const open = await openFindings(db);
    const r = dd.reconcile(open, findings, new Set(dd.FINDING_KINDS));
    const { deskDoor } = await import("../stories/desk.server");
    for (const f of r.open.slice(0, 200)) {
      const res = await deskDoor("data", { action: "finding", kind: f.kind, key: f.key, subject: f.subject, ...(f.measure ? { measure: f.measure } : {}), ...(f.expected ? { expected: f.expected.slice(0, 600) } : {}), ...(f.found ? { found: f.found.slice(0, 600) } : {}), receipt: f.receipt });
      if (res.status < 300) out.opened++; else out.errors.push(`finding ${f.key}: ${res.status}`);
    }
    for (const id of r.close.slice(0, 200)) {
      const res = await deskDoor("data", { action: "finding_close", finding: id, reason: `No longer found by the daily check on ${new Date(now).toISOString().slice(0, 10)}.` });
      if (res.status < 300) out.closed++;
    }
    await deskDoor("data", { action: "data_run", run: "checks", summary: `Daily checks: ${out.why}; ${out.opened} opened, ${out.closed} closed.`.slice(0, 600), counts: out.counts });
  } catch (e) { out.errors.push(e instanceof Error ? e.message.slice(0, 120) : "error"); }
  return out;
}

// BACKTEST ------------------------------------------------------------------------------------------------------------------------------
/** The newest forecast old enough to score (28 days before the newest run) against the newest run's measured shares. `write` stores one
 *  row per scored run; `minDays` lets the proof show the arithmetic on a younger run without storing it. */
export async function runBacktest(db: Admin, o: { write?: boolean; minDays?: number } = {}) {
  const { data: runs, error } = await db.from("forecast_runs").select("id,computed_at,status").eq("status", "ok").order("id", { ascending: false }).limit(200);
  if (error) throw new Error("runs_read_failed");
  const list = (runs ?? []).map(r => ({ id: r.id as number, at: r.computed_at as string })).filter(r => !!r.at);
  const { data: had } = await db.from("forecast_backtests").select("scored_run_id");
  const scored = new Set((had ?? []).map(x => x.scored_run_id as number));
  let pick = dd.scoreable(list, scored);
  if (!pick && o.minDays != null) { const latest = list[0], then = list.find(r => latest && Date.parse(latest.at) - Date.parse(r.at) >= o.minDays! * 864e5); if (latest && then) pick = { then, now: latest, days: (Date.parse(latest.at) - Date.parse(then.at)) / 864e5 }; }
  if (!pick) return { scored: false as const, why: `no forecast is ${dd.BACKTEST_DAYS} days older than the newest yet (newest run ${list[0]?.id ?? "none"}, oldest ${list.at(-1)?.at?.slice(0, 10) ?? "none"})`, runs: list.length };
  const rowsOf = (id: number) => pages<{ dimension: string; value: string; scope: string; current_share: number | null; proj_q1: number | null }>((f, t) => db.from("forecasts").select("dimension,value,scope,current_share,proj_q1").eq("run_id", id).order("id").range(f, t), 20000);
  const [then, now] = await Promise.all([rowsOf(pick.then.id), rowsOf(pick.now.id)]);
  const b = dd.backtest(then.map(r => ({ key: `${r.dimension}:${r.value}`, scope: r.scope, share: r.current_share, proj_q1: r.proj_q1 })), now.map(r => ({ key: `${r.dimension}:${r.value}`, scope: r.scope, share: r.current_share })), pick.days);
  const stored = o.write && pick.days >= dd.BACKTEST_DAYS;
  if (stored) {
    const { error: e } = await db.from("forecast_backtests").insert({ run_id: pick.now.id, scored_run_id: pick.then.id, days: Math.round(pick.days * 100) / 100, calls: b.calls, right_calls: b.right, mean_miss: b.mean_miss == null ? null : Math.round(b.mean_miss * 1000) / 1000, detail: { worst: b.worst } as never });
    if (e) throw new Error("backtest_insert_failed");
    const { deskDoor } = await import("../stories/desk.server");
    await deskDoor("data", { action: "data_run", run: "backtest", summary: `Backtest of forecast run ${pick.then.id} (${pick.days.toFixed(0)} days): ${b.right} of ${b.calls} calls right, mean miss ${b.mean_miss?.toFixed(2) ?? "–"} points.`, counts: { calls: b.calls, right: b.right } });
  }
  return { scored: true as const, stored, then: pick.then, now: pick.now, days: pick.days, ...b };
}

// THE WEEKLY PROPOSAL -------------------------------------------------------------------------------------------------------------------
/** Once a week (after the backtest): one call that files at most three study pitches and two new-signal ideas through the door. */
export async function runProposal(db: Admin, o: { now?: number; fixture?: boolean } = {}) {
  const now = o.now ?? Date.now(), out = { ran: false, why: "", call_id: null as number | null, studies: [] as dd.ProposalItem[], signals: [] as dd.ProposalItem[], dropped: [] as { item: dd.ProposalItem; why: string }[], filed: 0 };
  if (!o.fixture) {
    const { count } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "data").eq("purpose", "proposal").gte("at", new Date(now - 7 * 864e5 + 3600_000).toISOString());
    if ((count ?? 0) > 0) { out.why = "already proposed this week"; return out; }
    const { count: today } = await db.from("desk_calls").select("id", { count: "exact", head: true }).eq("desk", "data").eq("purpose", "proposal").gte("at", dayStart(now));
    const { DESK_CAPS } = await import("./caps");
    if ((today ?? 0) >= DESK_CAPS.data) { out.why = "limit used"; return out; }
  }
  const [open, bt, beats, { DATA_STORIES }, { loadDataIndex }] = await Promise.all([openFindings(db).catch(() => []), db.from("forecast_backtests").select("scored_run_id,days,calls,right_calls,mean_miss,at").order("id", { ascending: false }).limit(4), import("../../../newsroom/beats.md?raw").then(m => m.default as string), import("../data-stories/registry"), import("../data-stories/page.server")]);
  const home = await loadDataIndex().catch(() => null), live = new Set(home ? [...(home.home.lead ? [home.home.lead.slug] : []), ...home.home.series.flatMap(s => s.studies.map(x => x.slug))] : []);
  const byKind: Record<string, number> = {}; for (const f of open) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  const { deskCall } = await import("./review.server");
  const c = await deskCall(db, "data", o.fixture ? "fixture" : "proposal", { system: dd.PROPOSAL_SYSTEM, user: dd.proposalUser({ findings: byKind, backtest: bt.data?.length ? bt.data : "no forecast is old enough to score yet", beats, studies: DATA_STORIES.map(s => ({ slug: s.slug, question: s.question, state: live.has(s.slug) ? "live" : "draft" })) }), schema: dd.PROPOSAL_SCHEMA as unknown as Record<string, unknown>, schemaName: "data_proposal", tool: dd.PROPOSAL_TOOL, maxTokens: 1500 }, dd.parseProposal, [], AbortSignal.timeout(40_000));
  out.ran = true; out.call_id = c?.call_id ?? null;
  if (!c?.parsed) { out.why = "call failed"; return out; }
  const e = dd.enforceProposal(c.parsed as dd.ProposalAnswer);
  out.studies = e.studies; out.signals = e.signals; out.dropped = e.dropped; out.why = `${e.studies.length} studies, ${e.signals.length} signals, ${e.dropped.length} dropped`;
  if (o.fixture) return out;
  const { deskDoor } = await import("../stories/desk.server");
  for (const s of e.studies) { const r = await deskDoor("data", { action: "pitch", kind: "study", ref: `study:${s.measure}`, facts: [`Measure: ${s.measure}`, `Minimum: ${s.minimum}`], note: s.question.slice(0, 140) }); if (r.status < 300) out.filed++; }
  for (const s of e.signals) { const r = await deskDoor("data", { action: "propose", kind: "signal", text: `${s.question} Measure: ${s.measure}. Minimum: ${s.minimum}.`.slice(0, 600), subject: s.measure }); if (r.status < 300) out.filed++; }
  return out;
}
