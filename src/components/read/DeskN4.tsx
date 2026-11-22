// N4 · /desk's Design review and Engineering panels (staff only, after the editor key): the newest weekly review run against the one
// before, its breaches, the newest test runs, this week's design proposals and the calls used; the build queue by status, the newest
// gate result with every check and its numbers, the health run's open items and credits per item. Nothing here is on a reader's page.
import { line as voiced } from "@/lib/voice";
import { storyTime } from "@/lib/stories";

type Measures = Record<string, number | boolean>;
type Cell = { page: string; width: number; measures: Measures; picture: boolean; against: string | null };
type Run = { run: string; kind: string; first_at: string; last_at: string; rows: number; cells: number; complete: boolean; pictures: number };
type Diff = { page: string; width: number; changes: { measure: string; before: number | boolean | null; after: number | boolean | null }[] };
type Item = { id: number; at: string; title: string; why: string; desk: string; kind: string; expects: string; status: string; source: string; source_ref: string | null; proposal: string | null; key: string | null; test: boolean; credits: number; gate: { pass: boolean; at: string } | null };
type Check = { id: string; name: string; ok: boolean; applies: boolean; numbers: Record<string, unknown>; problems: string[] };
export type N4 = {
  design: {
    runs: Run[]; newest: (Run & { rows: Cell[] }) | null; previous: Run | null; diff: Diff[];
    breaches: { line: string; bug: boolean; page: string; width: number; measure: string }[]; budgets: number;
    tests: { newest: Run & { rows: Cell[] }; previous: Run | null; diff: Diff[] } | null;
    proposals: { id: number; at: string; kind: string; subject: string | null; text: string; status: string; test: boolean }[]; proposals_counted: number; per_week: number;
    calls: { today: number; week: number; fixtures_week: number; cap: number; usd_week: number };
    pages: readonly { id: string; name: string }[]; widths: readonly number[]; waiting_moves: number;
  };
  engineering: {
    by_status: Record<string, number>; items: Item[];
    gate: { id: number; at: string; item_id: number; item_title: string | null; commit_sha: string; tests: { passed: number; failed: number; skipped: number }; before_run: string; after_run: string; pass: boolean; checks: Check[] } | null;
    checks: readonly { id: string; name: string }[]; health: Item[]; health_run: { at: string; reason: string | null } | null; credits: { id: number; title: string; credits: number }[];
    holds?: { job: string; actor: string; reason: string | null; until: string; at: string }[];
    passes?: { schedule: { name: string; cron: string }; limits: { items: number; slot_min: number; pass_ms: number }; today: { check: string; status: string; planned: number; done: number; failing: { id: string; error: string }[]; passes: number; failed_passes: number }[] } | null;
  };
};
const th = "py-2 pr-3 text-left font-normal ed-kicker align-bottom";
const td = "py-2 pr-3 align-top";
function Table({ caption, head, children, min = 560 }: { caption: string; head: string[]; children: React.ReactNode; min?: number }) {
  return <div className="mt-4 overflow-x-auto" role="region" aria-label={caption} tabIndex={0}><table className="ed-data ruled-table w-full border-collapse" style={{ minWidth: min }}>
    <caption className="sr-only">{caption}</caption>
    <thead><tr className="ed-hair">{head.map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}
const val = (m: string, v: number | boolean | null | undefined) => (v == null ? "not measured" : typeof v === "boolean" ? (v ? "yes" : "no") : m === "changed_share" ? `${Math.round(v * 1000) / 10}%` : m === "cls" ? String(v) : String(Math.round(v)));
const KEY = ["height_px", "words", "first_byte_ms", "lcp_ms", "small_targets", "low_contrast", "console_errors", "changed_share"] as const;
const pageName = (pages: readonly { id: string; name: string }[], id: string) => pages.find(p => p.id === id)?.name ?? id;

function RunTable({ caption, rows, pages }: { caption: string; rows: Cell[]; pages: readonly { id: string; name: string }[] }) {
  return <Table caption={caption} head={["Page", "Width", "Height", "Words", "First byte", "Largest paint", "Small targets", "Low contrast", "Console errors", "Changed", "Picture"]} min={980}>
    {rows.map(r => <tr key={`${r.page}@${r.width}`} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{pageName(pages, r.page)}</th><td className={`${td} num`}>{r.width}</td>
      {KEY.map(k => <td key={k} className={`${td} num`}>{val(k, r.measures[k])}</td>)}<td className={td}>{r.picture ? "stored" : "none"}</td></tr>)}
  </Table>;
}
function DiffList({ diff, pages }: { diff: Diff[]; pages: readonly { id: string; name: string }[] }) {
  if (!diff.length) return <p className="ed-small mt-3">{voiced("read.deskN4.noDiff")}</p>;
  return <Table caption="What differs from the run before, page and width by page and width" head={["Page", "Width", "Differences"]} min={640}>
    {diff.map(d => <tr key={`${d.page}@${d.width}`} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{pageName(pages, d.page)}</th><td className={`${td} num`}>{d.width}</td>
      <td className={td}>{d.changes.map(c => c.measure === "changed_share" ? `changed ${val(c.measure, c.after)}` : `${c.measure.replace(/_/g, " ")} ${val(c.measure, c.before)} → ${val(c.measure, c.after)}`).join(" · ")}</td></tr>)}
  </Table>;
}

export function DeskN4({ n }: { n: N4 }) {
  const d = n.design, e = n.engineering;
  return <>
    <section aria-labelledby="desk-design" className="ed-wrap mt-12" data-desk-design="">
      <h2 id="desk-design" className="ed-h2 ed-rule pt-3">Design review</h2>
      <p className="ed-small mt-3">{d.pages.length} pages at {d.widths.join(", ")} px. Page reviews today: {d.calls.today} of {d.calls.cap}; {d.calls.week} this week{d.calls.fixtures_week ? `, plus ${d.calls.fixtures_week} fixture calls` : ""} (USD {d.calls.usd_week.toFixed(2)}). Proposals this week: {d.proposals_counted} of {d.per_week}. {d.waiting_moves} accepted setting {d.waiting_moves === 1 ? "move waits" : "moves wait"} for the next monthly edition.</p>
      {d.newest ? <>
        <h3 className="ed-h3 mt-6">Weekly run {d.newest.run} · {storyTime(d.newest.last_at)}{d.previous ? ` · against ${d.previous.run}` : ""}</h3>
        <RunTable caption={`Weekly review run ${d.newest.run}`} rows={d.newest.rows} pages={d.pages} />
        {d.previous ? <DiffList diff={d.diff} pages={d.pages} /> : <p className="ed-small mt-3">{voiced("read.deskN4.firstWeekly")}</p>}
        <h3 className="ed-h3 mt-6">Breaches · {d.budgets} budgets</h3>
        {d.breaches.length ? <ul className="ed-data mt-3 space-y-1">{d.breaches.map(b => <li key={`${b.page}@${b.width}:${b.measure}`}><span className="ed-kicker">{b.bug ? "Bug" : "Proposal"}</span> {b.line}</li>)}</ul> : <p className="ed-small mt-3">{voiced("read.deskN4.noBreach")}</p>}
      </> : <p className="ed-small mt-3">{voiced("read.deskN4.noWeekly")}</p>}
      {d.tests ? <>
        <h3 className="ed-h3 mt-6"><span className="ed-kicker" data-test-row="">Test</span> Run {d.tests.newest.run}{d.tests.previous ? ` against ${d.tests.previous.run}` : ""}</h3>
        <p className="ed-small mt-2">Test runs are shown as tests: no budget, breach, queue item or gate reads them.</p>
        <RunTable caption={`Test review run ${d.tests.newest.run}`} rows={d.tests.newest.rows} pages={d.pages} />
        {d.tests.previous ? <DiffList diff={d.tests.diff} pages={d.pages} /> : null}
      </> : null}
      <h3 className="ed-h3 mt-6">Runs</h3>
      <Table caption="Review runs, newest first" head={["Run", "Kind", "Last row", "Cells", "Pictures", "Complete"]} min={560}>
        {d.runs.map(r => <tr key={r.run} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{r.run}</th><td className={td}>{r.kind}</td><td className={td}><time dateTime={r.last_at}>{storyTime(r.last_at)}</time></td><td className={`${td} num`}>{r.cells} of {d.pages.length * d.widths.length}</td><td className={`${td} num`}>{r.pictures}</td><td className={td}>{r.complete ? "yes" : "no"}</td></tr>)}
      </Table>
      <h3 className="ed-h3 mt-6">This week's proposals</h3>
      {d.proposals.length ? <Table caption="The design review desk's proposals this week with the owner's status" head={["When", "Kind", "Proposal", "Status"]} min={640}>
        {d.proposals.map(p => <tr key={p.id} className="ed-hair"><td className={td}><time dateTime={p.at}>{storyTime(p.at)}</time>{p.test ? <span className="ed-kicker block" data-test-row="">Test</span> : null}</td><td className={td}>{p.kind}{p.subject ? <span className="ed-caption block">{p.subject}</span> : null}</td><td className={td}>{p.text}</td><td className={td}>{p.status}</td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskN4.noProposals")}</p>}
    </section>

    <section aria-labelledby="desk-engineering" className="ed-wrap mt-12" data-desk-engineering="">
      <h2 id="desk-engineering" className="ed-h2 ed-rule pt-3">Engineering</h2>
      <dl className="ed-data mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(e.by_status).map(([s, c]) => <div key={s}><dt className="ed-kicker">{s}</dt><dd className="num">{c}</dd></div>)}</dl>
      <h3 className="ed-h3 mt-6">The build queue</h3>
      {e.items.length ? <Table caption="The build queue, newest first" head={["Item", "Kind", "Expects", "Status", "Filed by", "Proposal", "Credits"]} min={820}>
        {e.items.map(i => <tr key={i.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{i.id} · {i.title}{i.test ? <span className="ed-kicker block" data-test-row="">Test</span> : null}<span className="ed-caption block">{i.why}</span></th><td className={td}>{i.kind}</td><td className={td}>{i.expects}</td><td className={td}>{i.status}{i.gate ? <span className="ed-caption block">gate {i.gate.pass ? "passed" : "failed"}</span> : null}</td><td className={td}>{i.desk}</td><td className={td}>{i.proposal ?? "—"}</td><td className={`${td} num`}>{i.credits || "—"}</td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskN4.noItems")}</p>}
      <h3 className="ed-h3 mt-6">The newest gate result</h3>
      {e.gate ? <>
        <p className="ed-small mt-3">Item {e.gate.item_id}{e.gate.item_title ? ` (${e.gate.item_title})` : ""} at {e.gate.commit_sha.slice(0, 12)}, {storyTime(e.gate.at)}: <strong>{e.gate.pass ? "passed" : "failed"}</strong>. Tests {e.gate.tests.passed} passed, {e.gate.tests.failed} failed, {e.gate.tests.skipped} skipped; before run {e.gate.before_run}, after run {e.gate.after_run}.</p>
        <Table caption="Every check of the newest gate result with its numbers" head={["Check", "Result", "Numbers", "Problems"]} min={720}>
          {e.gate.checks.map(c => <tr key={c.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{c.name}</th><td className={td}>{!c.applies ? "not needed" : c.ok ? "pass" : "fail"}</td><td className={`${td} break-all`}>{JSON.stringify(c.numbers)}</td><td className={td}>{c.problems.slice(0, 6).join(" ")}{c.problems.length > 6 ? ` (+${c.problems.length - 6} more)` : ""}</td></tr>)}
        </Table>
      </> : <p className="ed-small mt-3">{voiced("read.deskN4.noGate")}</p>}
      <h3 className="ed-h3 mt-6">The gate's checks</h3>
      <ol className="ed-data mt-3 list-decimal space-y-1 pl-6">{e.checks.map(c => <li key={c.id}>{c.name}</li>)}</ol>
      <h3 className="ed-h3 mt-6">Health run</h3>
      <p className="ed-small mt-3">{e.health_run ? `${storyTime(e.health_run.at)}: ${e.health_run.reason ?? ""}` : voiced("read.deskN4.noHealthRun")}</p>
      {e.health.length ? <ul className="ed-data mt-3 space-y-2">{e.health.map(i => <li key={i.id}><span className="ed-kicker">Item {i.id} · {i.status}</span> {i.title}<span className="ed-caption block">{i.why}</span></li>)}</ul> : null}
      <h3 className="ed-h3 mt-6">Held jobs</h3>
      {e.holds?.length ? <ul className="ed-data mt-3 space-y-2">{e.holds.map(h => <li key={h.job}><span className="ed-kicker">{h.job}</span> held by {h.actor} until <time dateTime={h.until}>{storyTime(h.until)}</time><span className="ed-caption block">{h.reason ?? ""}</span></li>)}</ul> : <p className="ed-small mt-3">{voiced("read.deskN4.noHolds")}</p>}
      {e.passes ? <>
        <h3 className="ed-h3 mt-6">Share and chart passes today</h3>
        <p className="ed-small mt-3">At most {e.passes.limits.items} items a pass, one pass per {e.passes.limits.slot_min} minutes, each under {e.passes.limits.pass_ms / 1000} s, stored records only. Schedule “{e.passes.schedule.name}”: {e.passes.schedule.cron} (UTC).</p>
        <Table caption="Today's share-image and study-chart passes" head={["Check", "Status", "Planned", "Done", "Failing", "Passes", "Failed passes"]} min={640}>
          {e.passes.today.map(t => <tr key={t.check} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{t.check}</th><td className={td}>{t.status}</td><td className={`${td} num`}>{t.planned}</td><td className={`${td} num`}>{t.done}</td><td className={td}>{t.failing.length ? t.failing.slice(0, 4).map(f => `${f.id}: ${f.error}`).join(" · ") : "0"}</td><td className={`${td} num`}>{t.passes}</td><td className={`${td} num`}>{t.failed_passes}</td></tr>)}
        </Table>
      </> : null}
      {e.credits.length ? <><h3 className="ed-h3 mt-6">Credits per item</h3><ul className="ed-data mt-3 space-y-1">{e.credits.map(c => <li key={c.id}><span className="num">{c.credits}</span> credits · item {c.id} · {c.title}</li>)}</ul></> : null}
    </section>
  </>;
}
