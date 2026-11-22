// N4 · THE ENGINEERING DESK's daily health run (pure): what counts as a problem worth a `bug` item on the build queue, each with a
// stable key so the same problem is never filed twice while open, and which open items are gone (declined "no longer found", never
// deleted). Job facts are names, run times, durations and success only: never a job's command text. No model call.
import { SPEED_TARGETS } from "../perf/speed";
import { REVIEW_PAGES, cellsOf, type ReviewRow } from "./design-review";

export const LATE_FACTOR = 2;
export const SLOW_FACTOR = 3;
/** A run shorter than this is never called slow, however it compares to its median (a 0.1 s job taking 0.4 s is not a problem). */
export const SLOW_FLOOR_MS = 5_000;
export const MIN_RUNS_FOR_INTERVAL = 3;
export const MIN_RUNS_FOR_MEDIAN = 5;
export const CALL_FAIL_SHARE = 0.1;
export const CHECK_FAIL_SHARE = 0.5;
export const HISTORY_MAX_MS = 60_000;
export const HEALTH_DAYS = 14;
export const HEALTH_PREFIX = "health:";

export type Problem = { key: string; title: string; why: string };
export type JobRun = { started_at: string; finished_at: string | null; ok: boolean | null; error?: string | null };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2) : null; };
const secs = (ms: number) => (ms < 120_000 ? `${Math.round(ms / 100) / 10} s` : ms < 7_200_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 3_600_000)} h`);
/** One scheduled job's problems from its own run records over 14 days: the newest run failed; nothing ran within twice its usual
 *  interval (the median gap between starts); the newest run took more than three times its median duration. */
export function jobProblems(name: string, runs: readonly JobRun[], now: number): Problem[] {
  const rs = [...runs].filter(r => Number.isFinite(Date.parse(r.started_at))).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const newest = rs[0]; if (!newest) return [];
  const out: Problem[] = [];
  if (newest.ok === false) out.push({ key: `${HEALTH_PREFIX}job-failed:${name}`, title: `Scheduled job ${name} failed`, why: `Its newest run (${newest.started_at.slice(0, 16).replace("T", " ")} UTC) did not succeed${newest.error ? `: ${newest.error.slice(0, 160)}` : ""}.` });
  if (rs.length >= MIN_RUNS_FOR_INTERVAL) {
    const gaps = rs.slice(0, -1).map((r, i) => Date.parse(r.started_at) - Date.parse(rs[i + 1]!.started_at)).filter(g => g > 0);
    const every = median(gaps), since = now - Date.parse(newest.started_at);
    if (every && since > LATE_FACTOR * every) out.push({ key: `${HEALTH_PREFIX}job-late:${name}`, title: `Scheduled job ${name} has not run`, why: `It usually runs every ${secs(every)}; the last run started ${secs(since)} ago (more than ${LATE_FACTOR} times its interval).` });
  }
  const took = rs.filter(r => r.finished_at).map(r => Date.parse(r.finished_at!) - Date.parse(r.started_at)).filter(d => d >= 0);
  const med = took.length >= MIN_RUNS_FOR_MEDIAN ? median(took) : null, last = newest.finished_at ? Date.parse(newest.finished_at) - Date.parse(newest.started_at) : null;
  if (med && last != null && last > SLOW_FACTOR * med && last > SLOW_FLOOR_MS) out.push({ key: `${HEALTH_PREFIX}job-slow:${name}`, title: `Scheduled job ${name} ran slowly`, why: `Its newest run took ${secs(last)}, more than ${SLOW_FACTOR} times its ${HEALTH_DAYS}-day median of ${secs(med)}.` });
  return out;
}
/** A crawl or the wire older than health.ts's staleness rules (its own `stale` flag). */
export function staleProblems(jobs: readonly { job: string; stale: boolean; last_ok_at: string | null; expected_every: string }[]): Problem[] {
  return jobs.filter(j => (j.job === "crawl" || j.job === "wire") && j.stale).map(j => ({ key: `${HEALTH_PREFIX}stale:${j.job}`, title: `The ${j.job === "crawl" ? "crawl" : "wire"} is stale`, why: `Its last good run was ${j.last_ok_at ? `${j.last_ok_at.slice(0, 16).replace("T", " ")} UTC` : "never"}, older than twice its interval (${j.expected_every}).` }));
}
/** A page over its speed target (first byte, largest paint, layout shift) in the newest review run that counts (never a test run). */
export function speedProblems(run: { run: string; rows: readonly ReviewRow[] } | null): Problem[] {
  if (!run) return [];
  const out: Problem[] = [], c = [...cellsOf(run.rows).values()];
  for (const p of REVIEW_PAGES) {
    const over = c.filter(r => r.page === p.id).flatMap(r => [
      ...(r.measures.first_byte_ms != null && r.measures.first_byte_ms > SPEED_TARGETS.firstMs ? [`first byte ${Math.round(r.measures.first_byte_ms)} ms at ${r.width} px`] : []),
      ...(r.measures.lcp_ms != null && r.measures.lcp_ms > SPEED_TARGETS.lcpMs ? [`largest paint ${Math.round(r.measures.lcp_ms)} ms at ${r.width} px`] : []),
      ...(r.measures.cls != null && r.measures.cls > SPEED_TARGETS.cls ? [`layout shift ${r.measures.cls} at ${r.width} px`] : []),
    ]);
    if (over.length) out.push({ key: `${HEALTH_PREFIX}speed:${p.id}`, title: `${p.name} is over its speed target`, why: `In review run “${run.run}”: ${over.join("; ")} (targets: first byte ${SPEED_TARGETS.firstMs} ms, largest paint ${SPEED_TARGETS.lcpMs} ms, layout shift ${SPEED_TARGETS.cls}).` });
  }
  return out;
}
/** More than 10% of one caller's model calls failing over the last 24 hours (each desk, and the writers' model ledger). */
export function callProblems(calls: readonly { who: string; ok: boolean }[]): Problem[] {
  const by = new Map<string, { n: number; failed: number }>();
  for (const c of calls) { const x = by.get(c.who) ?? { n: 0, failed: 0 }; x.n++; if (!c.ok) x.failed++; by.set(c.who, x); }
  return [...by.entries()].filter(([, x]) => x.n > 0 && x.failed / x.n > CALL_FAIL_SHARE).map(([who, x]) => ({ key: `${HEALTH_PREFIX}calls:${who}`, title: `${who}: model calls failing`, why: `${x.failed} of ${x.n} model calls failed in the last 24 hours (more than ${Math.round(CALL_FAIL_SHARE * 100)}%).` }));
}
/** A writer's texts failing the shared check more than half the time over the last 24 hours. */
export function checkProblems(texts: readonly { writer: string; passed: boolean }[]): Problem[] {
  const by = new Map<string, { n: number; failed: number }>();
  for (const t of texts) { const x = by.get(t.writer) ?? { n: 0, failed: 0 }; x.n++; if (!t.passed) x.failed++; by.set(t.writer, x); }
  return [...by.entries()].filter(([, x]) => x.n > 0 && x.failed / x.n > CHECK_FAIL_SHARE).map(([w, x]) => ({ key: `${HEALTH_PREFIX}check:${w}`, title: `The ${w} writer's texts fail the shared check`, why: `${x.failed} of ${x.n} texts failed the shared check in the last 24 hours (more than half).` }));
}
/** The history refresh taking over 60 seconds (its newest run). */
export function historyProblem(newest: { ms: number | null; started_at: string } | null): Problem[] {
  return newest?.ms != null && newest.ms > HISTORY_MAX_MS ? [{ key: `${HEALTH_PREFIX}history-refresh`, title: "The history refresh is slow", why: `Its newest run (${newest.started_at.slice(0, 16).replace("T", " ")} UTC) took ${secs(newest.ms)}, over ${HISTORY_MAX_MS / 1000} s.` }] : [];
}
/** What to file and what to decline: problems with no open item are filed; open health items whose problem is gone are declined. */
export function reconcileHealth(open: readonly { id: number; key: string | null }[], found: readonly Problem[]): { add: Problem[]; close: number[] } {
  const keys = new Set(found.map(f => f.key)), have = new Set(open.map(o => o.key));
  return { add: found.filter(f => !have.has(f.key)), close: open.filter(o => o.key?.startsWith(HEALTH_PREFIX) && !keys.has(o.key)).map(o => o.id) };
}
