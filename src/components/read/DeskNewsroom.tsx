// N1 · the newsroom on /desk (staff only, after the editor key): spend against the weekly cap, the action levels, the desk log with
// a desk filter, and the golden scores. Read through the desk's `newsroom` action; nothing here is on a reader-facing page.
import { useState } from "react";
import { line as voiced } from "@/lib/voice";
import { useQuery } from "@tanstack/react-query";
import { staffJson } from "@/lib/staff-key";
import { storyTime } from "@/lib/stories";
import type { HistoryRow } from "@/lib/newsroom/log";
import { confirmPhrase, type ActionDef, type Level } from "@/lib/newsroom/register";
import type { SpendStatus } from "@/lib/newsroom/spend";
import { ACTORS, PIPELINE } from "@/lib/newsroom/desks";
import { CHECKLIST } from "@/lib/newsroom/checklist-names";
import { staffCall } from "@/lib/staff-key";
import { useQueryClient } from "@tanstack/react-query";
import { DeskN4, type N4 } from "./DeskN4";
import { DeskN5, type N5 } from "./DeskN5";

export type Newsroom = {
  log: HistoryRow[];
  spend: (SpendStatus & { split: { writers: number; readers: number }; reached: boolean; line: string }) | null;
  register: { levels: readonly Level[]; actions: (ActionDef & { confirm?: string })[]; confirm: string };
  board: { pitch: { id: number; kind: string; ref: string; note: string }; assignment: { desk: string; status: string; at: string; reason: string | null } | null }[] | null;
  golden: {
    calls: { cases: number; skipped: { name: string; why: string }[] };
    writing_set: { frozen_at: string; mean: number; passed: number; total: number; items: { number: number; id: string; score: number; failures: string[] }[] };
    versions: { writer: string; current: string | null; recorded: { version: string; prompt_hash: string; template: string; note: string }[] }[];
  };
  switches: { wire_only: boolean };
  // N2 · the desks at work.
  desks?: { desks: { desk: string; cap: number; used: number; failed: number; week_usd: number }[]; fixture_calls_today: number; without_second_reader_today: number } | null;
  notes?: { id: number; at: string; actor: string; subject_kind: string; subject_id: string; text: string }[];
  proposals?: { id: number; at: string; desk: string; kind: string; subject: string | null; text: string; status: "open" | "accepted" | "declined"; status_at: string | null; status_reason: string | null }[];
  reviews?: { story_id: string; headline: string; standards: Review | null; chief: Review | null }[];
  // N3 · the news, graphics and data desks.
  n3?: N3 | null;
  // N4 · the design review and engineering desks.
  n4?: N4 | null;
  n5?: N5 | null;
};
type N3 = {
  limits: { desk: string; what: string; cap: number; used: number }[];
  news: { picks: { id: number; at: string; subject: string; line: string; domain: string | null; title: string; url: string; outlet: string; dropped: string | null }[]; drops: { id: number; at: string; pick_id: number; actor: string; reason: string }[]; pitches: { at: string; reason: string | null }[] };
  graphics: { changed: Pic[]; none: Pic[]; fallbacks: number; kept: number; share: { at: string; checked: number; rebuilt: number; failures: unknown } | null;
    /** L2 · the chart registry, figures waiting on a proposed form and each form's proposals */
    forms?: { registry: { id: string; name: string; status: string; shapes: string[]; least: string; proposals: { log: number; status: string }[] }[]; waiting: { log: number; at: string; study: string | null; form: string | null; text: string; status: string }[] } | null };
  data: { byKind: Record<string, number>; open: number; newest: { id: number; kind: string; subject: string; text: string; at: string }[]; backtest: { line: string; at: string } | null; running: { calls: number; right: number } | null; proposals: { at: string; action: string; reason: string | null }[] };
  tests: string[];
};
type Pic = { id: number; at: string; story_id: string; actor: string; kind: string; verdict: string; reason: string | null; headline: string; number: number | null };
type Review = { at: string; verdict: string; reason: string | null; checklist: unknown; problems: unknown; second_reader: string | null; placement: number | null; basis: string };
type Item = { id: string; result: "pass" | "fail" | "n/a"; detail: string | null };
type Problem = { kind: string; words: string; severity: "blocker" | "note"; why: string };
const asItems = (v: unknown): Item[] => (Array.isArray(v) ? v.filter((x): x is Item => !!x && typeof x === "object" && typeof (x as Item).id === "string") : []);
const asProblems = (v: unknown): Problem[] => (Array.isArray(v) ? v.filter((x): x is Problem => !!x && typeof x === "object" && typeof (x as Problem).why === "string") : []);
export const newsroomQuery = (desk: string | null) => ({ queryKey: ["desk-newsroom", desk ?? "all"], staleTime: 0, queryFn: () => staffJson<Newsroom>({ action: "newsroom", ...(desk ? { desk } : {}) }) });
const LOG_SHOWN = 50;
const usd = (n: number) => `USD ${n.toFixed(2)}`;
const th = "py-2 pr-3 text-left font-normal ed-kicker align-bottom";
const td = "py-2 pr-3 align-top";

function Table({ caption, head, children, min = 560 }: { caption: string; head: string[]; children: React.ReactNode; min?: number }) {
  return <div className="mt-4 overflow-x-auto" role="region" aria-label={caption} tabIndex={0}><table className="ed-data ruled-table w-full border-collapse" style={{ minWidth: min }}>
    <caption className="sr-only">{caption}</caption>
    <thead><tr className="ed-hair">{head.map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}

export function DeskNewsroom() {
  const [desk, setDesk] = useState<string | null>(null), [all, setAll] = useState(false);
  const { data, isError } = useQuery(newsroomQuery(desk));
  if (isError) return <p className="ed-wrap ed-small mt-12">The newsroom data could not be loaded.</p>;
  if (!data) return <p className="ed-wrap ed-small mt-12" aria-busy="true">{voiced("staff.loading")}</p>;
  const s = data.spend, g = data.golden;
  return <>
    <DeskDesks data={data} />
    {data.n3 ? <DeskN3 n={data.n3} /> : null}
    {data.n4 ? <DeskN4 n={data.n4} /> : null}
    {data.n5 ? <DeskN5 n={data.n5} /> : null}
    <section aria-labelledby="desk-spend" className="ed-wrap mt-12" data-desk-spend="">
      <h2 id="desk-spend" className="ed-h2 ed-rule pt-3">Spend this week</h2>
      {s ? <>
        <p className="ed-small mt-3">Week from {storyTime(s.week_start)} (Monday, Eastern time). {s.line}</p>
        <dl className="ed-data mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><dt className="ed-kicker">Model spend</dt><dd className="num">{usd(s.model_usd)}</dd></div>
          <div><dt className="ed-kicker">Writers</dt><dd className="num">{usd(s.split.writers)}</dd></div>
          <div><dt className="ed-kicker">Readers (AI reads)</dt><dd className="num">{usd(s.split.readers)}</dd></div>
          <div><dt className="ed-kicker">Build credits</dt><dd className="num">{s.build_credits}</dd></div>
          <div><dt className="ed-kicker">Weekly cap</dt><dd>{s.cap ? `${s.cap.model_usd != null ? usd(s.cap.model_usd) : "no model cap"} · ${s.cap.build_credits != null ? `${s.cap.build_credits} credits` : "no build cap"}` : "Not set"}</dd></div>
          <div><dt className="ed-kicker">Wire only</dt><dd>{data.switches.wire_only ? "On" : "Off"}</dd></div>
        </dl>
        <Table caption="Model spend this week by kind and model" head={["Kind", "Model", "Calls", "Cost"]}>
          {s.by_kind.map(k => <tr key={`${k.kind}|${k.model}`} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{k.kind}</th><td className={td}>{k.model}</td><td className={`${td} num`}>{k.calls}</td><td className={`${td} num`}>{usd(k.usd)}</td></tr>)}
        </Table>
      </> : <p className="ed-small mt-3">Spend could not be read.</p>}
    </section>

    <section aria-labelledby="desk-levels" className="ed-wrap mt-12" data-desk-levels="">
      <h2 id="desk-levels" className="ed-h2 ed-rule pt-3">Actions and their levels</h2>
      <p className="ed-small mt-3">Ships alone runs. Ships to preview is recorded as a proposal and changes nothing live. Needs the owner is refused unless the actor is the owner and the call carries its confirmation phrase.</p>
      <Table caption="Every desk action with its level of autonomy" head={["Action", "Level", "What it does"]} min={640}>
        {data.register.actions.map(a => <tr key={a.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{a.id}</th><td className={td}>{a.level}{a.confirm ? <span className="ed-caption block">“{a.confirm}”</span> : null}</td><td className={td}>{a.what}</td></tr>)}
      </Table>
    </section>

    <section aria-labelledby="desk-history" className="ed-wrap mt-12" data-desk-history="">
      <h2 id="desk-history" className="ed-h2 ed-rule pt-3">Desk log · last 14 days</h2>
      <label className="ed-data mt-4 flex flex-wrap items-center gap-2">Desk
        <select value={desk ?? ""} onChange={e => setDesk(e.target.value || null)} className="ed-tap min-h-[44px] border border-ed-ink bg-transparent px-2">
          <option value="">Every desk</option>
          {[...ACTORS, ...PIPELINE].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      {data.log.length ? <Table caption="Desk log: every call through the desk and every story edit" head={["When", "Who", "Action", "Subject", "Decision", "Reason"]} min={720}>
        {(all ? data.log : data.log.slice(0, LOG_SHOWN)).map(r => <tr key={r.ref} className="ed-hair"><td className={td}><time dateTime={r.at}>{r.at.slice(0, 16).replace("T", " ")}</time>{data.n3?.tests.includes(r.ref) ? <span className="ed-kicker block" data-test-row="">Test</span> : null}</td><td className={td}>{r.actor}</td><td className={td}>{r.action}{r.level ? <span className="ed-caption block">{r.level}</span> : null}</td><td className={`${td} break-all`}>{r.subject_id ?? "—"}</td><td className={td}>{r.decision}</td><td className={td}>{r.reason ?? "—"}</td></tr>)}
      </Table> : null}
      {data.log.length > LOG_SHOWN && <button type="button" onClick={() => setAll(v => !v)} className="ed-tap ed-data mt-3 min-h-[44px] border border-ed-ink px-3">{all ? `Show the newest ${LOG_SHOWN}` : `Show all ${data.log.length}`}</button>}
      {data.log.length ? null : <p className="ed-small mt-3">Nothing logged{desk ? ` for ${desk}` : ""} in the last 14 days.</p>}
    </section>

    <section aria-labelledby="desk-board" className="ed-wrap mt-12" data-desk-board="">
      <h2 id="desk-board" className="ed-h2 ed-rule pt-3">The board</h2>
      <p className="ed-small mt-3">Each pitch with the desk that holds it. A desk assigns itself with the assign action.</p>
      {data.board?.length ? <Table caption="The board: pitches and the desk that holds each" head={["Pitch", "About", "Held by", "Status"]} min={560}>
        {data.board.map(b => <tr key={b.pitch.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{b.pitch.id}</th><td className={td}>{b.pitch.kind} · {b.pitch.ref}<span className="ed-caption block">“{b.pitch.note}”</span></td><td className={td}>{b.assignment?.desk ?? "nobody yet"}</td><td className={td}>{b.assignment ? `${b.assignment.status}${b.assignment.reason ? ` · ${b.assignment.reason}` : ""}` : "open"}</td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskView.5")}</p>}
    </section>

    <section aria-labelledby="desk-golden" className="ed-wrap mt-12" data-desk-golden="">
      <h2 id="desk-golden" className="ed-h2 ed-rule pt-3">Golden scores</h2>
      <p className="ed-small mt-3">The golden set: {g.calls.cases} cases; {g.calls.cases - g.calls.skipped.length} run in every test, {g.calls.skipped.length} are skipped with a reason. The frozen writing set (frozen {storyTime(g.writing_set.frozen_at)}): {g.writing_set.passed} of {g.writing_set.total} approved texts pass the shared check against their frozen facts, mean score {g.writing_set.mean}.</p>
      <Table caption="Frozen writing set: each approved text's score" head={["Story", "Score", "Check"]} min={420}>
        {g.writing_set.items.map(i => <tr key={i.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>No. {i.number}</th><td className={`${td} num`}>{i.score}</td><td className={td}>{i.failures.length ? i.failures.join("; ") : "passes"}</td></tr>)}
      </Table>
      <Table caption="Writer versions" head={["Writer", "Current version", "Recorded"]} min={480}>
        {g.versions.map(v => <tr key={v.writer} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{v.writer}</th><td className={td}>{v.current ?? "not recorded"}</td><td className={td}>{v.recorded.map(r => `${r.version} (${r.prompt_hash}, template ${r.template}): ${r.note}`).join(" · ")}</td></tr>)}
      </Table>
      <ul className="ed-data mt-4 space-y-2">{g.calls.skipped.map(x => <li key={x.name}><span className="ed-kicker">Skipped · {x.name}</span> <span className="ed-caption block">{x.why}</span></li>)}</ul>
    </section>
  </>;
}

const ITEM_TITLE = new Map<string, string>(CHECKLIST.map(c => [c.id, c.title]));
/** N2 · the desks today (calls against caps), each recent story's review, the desks' notes and the proposals with the owner's status. */
function DeskDesks({ data }: { data: Newsroom }) {
  const qc = useQueryClient(), [msg, setMsg] = useState<string | null>(null);
  const setStatus = async (log: number, status: "open" | "accepted" | "declined") => {
    setMsg(null);
    const r = await staffCall({ action: "proposal_status", log, status, confirm: confirmPhrase("proposal_status") }).catch(() => null);
    setMsg(r?.ok ? `Proposal ${log} is now ${status}.` : "The status could not be set.");
    await qc.invalidateQueries({ queryKey: ["desk-newsroom"] });
  };
  const d = data.desks;
  return <>
    <section aria-labelledby="desk-desks" className="ed-wrap mt-12" data-desk-desks="">
      <h2 id="desk-desks" className="ed-h2 ed-rule pt-3">The desks today</h2>
      {d ? <>
        <p className="ed-small mt-3">Model calls today (UTC) against each desk's daily cap. {d.without_second_reader_today} {d.without_second_reader_today === 1 ? "story was" : "stories were"} reviewed without the second reader today.{d.fixture_calls_today ? ` ${d.fixture_calls_today} fixture calls today are not counted.` : ""}</p>
        <Table caption="Each desk's model calls today against its cap" head={["Desk", "Calls today", "Failed", "This week"]} min={420}>
          {d.desks.map(x => <tr key={x.desk} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{x.desk}</th><td className={`${td} num`}>{x.used} of {x.cap}</td><td className={`${td} num`}>{x.failed}</td><td className={`${td} num`}>{usd(x.week_usd)}</td></tr>)}
        </Table>
      </> : <p className="ed-small mt-3">The desks' calls could not be read.</p>}
    </section>

    <section aria-labelledby="desk-reviews" className="ed-wrap mt-12" data-desk-reviews="">
      <h2 id="desk-reviews" className="ed-h2 ed-rule pt-3">Reviews · last 3 days</h2>
      {data.reviews?.length ? <ul className="mt-4 space-y-6">{data.reviews.map(r => {
        const items = asItems(r.standards?.checklist), probs = asProblems(r.standards?.problems);
        return <li key={r.story_id} className="ed-hair pt-3" data-review={r.story_id}>
          <p className="ed-data"><a className="ed-link" href={`/stories/${encodeURIComponent(r.story_id)}`}>{r.headline}</a></p>
          {r.standards ? <p className="ed-small mt-1"><span className="ed-kicker">Standards · {r.standards.verdict}</span> {r.standards.reason ?? ""} <span className="ed-caption">Second reader: {r.standards.second_reader ?? "not run"}.</span></p> : <p className="ed-small mt-1">Not reviewed by standards.</p>}
          {items.length ? <ul className="ed-data mt-2 grid gap-1 md:grid-cols-2">{items.map(i => <li key={i.id}><span className="ed-kicker">{i.result === "pass" ? "Pass" : i.result === "fail" ? "Fail" : "n/a"}</span> {ITEM_TITLE.get(i.id) ?? i.id}{i.detail ? <span className="ed-caption block">{i.detail}</span> : null}</li>)}</ul> : null}
          {probs.length ? <ul className="ed-data mt-2 space-y-1">{probs.map((p, k) => <li key={k}><span className="ed-kicker">{p.severity} · {p.kind}</span> {p.why}<span className="ed-caption block">“{p.words}”</span></li>)}</ul> : null}
          {r.chief ? <p className="ed-small mt-2"><span className="ed-kicker">Editor in chief · {r.chief.verdict}{r.chief.placement ? ` · place ${r.chief.placement}` : ""}</span> {r.chief.reason ?? ""}{r.chief.basis === "engine order" ? <span className="ed-caption"> (engine order)</span> : null}</p> : null}
        </li>;
      })}</ul> : <p className="ed-small mt-3">{voiced("read.deskNewsroom.reviews")}</p>}
    </section>

    <section aria-labelledby="desk-notes" className="ed-wrap mt-12" data-desk-notes="">
      <h2 id="desk-notes" className="ed-h2 ed-rule pt-3">Desk notes · last 14 days</h2>
      {data.notes?.length ? <Table caption="Notes the desks left on stories, studies, brands and signals" head={["When", "Desk", "About", "Note"]} min={560}>
        {data.notes.map(n => <tr key={n.id} className="ed-hair"><td className={td}><time dateTime={n.at}>{storyTime(n.at)}</time></td><td className={td}>{n.actor}</td><td className={td}>{n.subject_kind} · {n.subject_id}</td><td className={td}>{n.text}</td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskNewsroom.notes")}</p>}
    </section>

    <section aria-labelledby="desk-proposals" className="ed-wrap mt-12" data-desk-proposals="">
      <h2 id="desk-proposals" className="ed-h2 ed-rule pt-3">Proposals</h2>
      <p className="ed-small mt-3">Every propose call, with its status. Only the owner sets a status.</p>
      {msg ? <p className="ed-small mt-2" role="status">{msg}</p> : null}
      {data.proposals?.length ? <Table caption="Proposals from the desks with the owner's status" head={["When", "Desk", "Kind", "Proposal", "Status", "Set"]} min={720}>
        {data.proposals.map(p => <tr key={p.id} className="ed-hair"><td className={td}><time dateTime={p.at}>{storyTime(p.at)}</time>{data.n3?.tests.includes(`log:${p.id}`) ? <span className="ed-kicker block" data-test-row="">Test</span> : null}</td><td className={td}>{p.desk}</td><td className={td}>{p.kind}{p.subject ? <span className="ed-caption block">{p.subject}</span> : null}</td><td className={td}>{p.text}</td><td className={td}>{p.status}{p.status_reason ? <span className="ed-caption block">{p.status_reason}</span> : null}</td>
          <td className={td} data-no-csv=""><span className="flex flex-wrap gap-2">{(["accepted", "declined", "open"] as const).filter(x => x !== p.status).map(x => <button key={x} type="button" onClick={() => void setStatus(p.id, x)} className="ed-tap ed-data min-h-[44px] border border-ed-ink px-3">{x === "accepted" ? "Accept" : x === "declined" ? "Decline" : "Reopen"}</button>)}</span></td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskNewsroom.proposals")}</p>}
    </section>
  </>;
}

const shareFailures = (v: unknown): { kind: string; id: string; why: string }[] => (Array.isArray(v) ? v.filter((x): x is { kind: string; id: string; why: string } => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string") : []);
/** N3 · the news desk's picks and drops, the graphics desk's picture changes and share checks, the data desk's findings and backtest. */
function DeskN3({ n }: { n: N3 }) {
  const fails = shareFailures(n.graphics.share?.failures);
  return <>
    <section aria-labelledby="desk-n3-limits" className="ed-wrap mt-12" data-desk-n3-limits="">
      <h2 id="desk-n3-limits" className="ed-h2 ed-rule pt-3">News, graphics and data · calls today</h2>
      <Table caption="The news, graphics and data desks' model calls today against their limits" head={["Desk", "What one call is", "Calls today"]} min={420}>
        {n.limits.map(l => <tr key={`${l.desk}|${l.what}`} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{l.desk}</th><td className={td}>{l.what}</td><td className={`${td} num`}>{l.used} of {l.cap}</td></tr>)}
      </Table>
    </section>

    <section aria-labelledby="desk-news" className="ed-wrap mt-12" data-desk-news="">
      <h2 id="desk-news" className="ed-h2 ed-rule pt-3">News desk · today's picks</h2>
      {n.news.picks.length ? <Table caption="The news desk's picks today, with any drop" head={["When", "Outlet", "Line", "Subject", "Brand", "Status"]} min={720}>
        {n.news.picks.map(p => <tr key={p.id} className="ed-hair"><td className={td}><time dateTime={p.at}>{p.at.slice(11, 16)}</time></td><td className={td}>{p.outlet}</td><td className={td}><a className="ed-link" href={p.url} target="_blank" rel="noopener">{p.line}</a><span className="ed-caption block">{p.title}</span></td><td className={td}>{p.subject}</td><td className={td}>{p.domain ?? "—"}</td><td className={td}>{p.dropped ? `dropped · ${p.dropped}` : "shown"}</td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskNewsroom.picks")}</p>}
      {n.news.drops.length ? <ul className="ed-data mt-4 space-y-1">{n.news.drops.map(d => <li key={d.id}><span className="ed-kicker">Dropped pick {d.pick_id} · {d.actor}</span> {d.reason}</li>)}</ul> : null}
      {n.news.pitches.length ? <ul className="ed-data mt-4 space-y-1">{n.news.pitches.map((x, i) => <li key={i}><span className="ed-kicker">Pitch · {storyTime(x.at)}</span> {x.reason ?? ""}</li>)}</ul> : null}
    </section>

    <section aria-labelledby="desk-graphics" className="ed-wrap mt-12" data-desk-graphics="">
      <h2 id="desk-graphics" className="ed-h2 ed-rule pt-3">Graphics desk · last 7 days</h2>
      <p className="ed-small mt-3">{n.graphics.kept} pictures kept as the rule chose, {n.graphics.changed.length} changed, {n.graphics.none.length} stories with no usable picture, {n.graphics.fallbacks} decided by rule because the check could not run.</p>
      {n.graphics.changed.length + n.graphics.none.length ? <Table caption="Pictures the graphics desk changed and stories with no usable picture" head={["Story", "Choice", "Reason"]} min={560}>
        {[...n.graphics.changed, ...n.graphics.none].map(p => <tr key={p.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}><a className="ed-link" href={`/stories/${encodeURIComponent(p.story_id)}`}>{p.number ? `No. ${p.number} · ` : ""}{p.headline}</a></th><td className={td}>{p.kind} · {p.verdict}</td><td className={td}>{p.reason ?? "—"}</td></tr>)}
      </Table> : null}
      <p className="ed-small mt-4">{n.graphics.share ? `Share images, last check ${storyTime(n.graphics.share.at)}: ${n.graphics.share.checked} checked, ${n.graphics.share.rebuilt} rebuilt, ${fails.length} failing.` : voiced("read.deskNewsroom.share")}</p>
      {fails.length ? <ul className="ed-data mt-2 space-y-1">{fails.map(f => <li key={`${f.kind}|${f.id}`}><span className="ed-kicker">{f.kind} · {f.id}</span> {f.why}</li>)}</ul> : null}
      {n.graphics.forms && <>
        <h3 className="ed-h3 mt-8">Chart forms</h3>
        <Table caption="The chart registry: every form, its status and its proposals" head={["Form", "Status", "Fits", "Least data", "Proposals"]} min={640}>
          {n.graphics.forms.registry.map(f => <tr key={f.id} className="ed-hair" data-desk-form={f.id}><th scope="row" className={`${td} text-left font-normal`}>{f.name}</th><td className={td}>{f.status === "proposed" ? "Proposed, not in use" : "Live"}</td><td className={td}>{f.shapes.join("; ")}</td><td className={td}>{f.least}</td><td className={td}>{f.proposals.length ? f.proposals.map(p => `log ${p.log}: ${p.status}`).join(", ") : "—"}</td></tr>)}
        </Table>
        <p className="ed-small mt-3">{n.graphics.forms.waiting.length ? `${n.graphics.forms.waiting.length} figure${n.graphics.forms.waiting.length === 1 ? "" : "s"} waiting on a form:` : "No figure is waiting on a proposed form."}</p>
        {n.graphics.forms.waiting.length ? <ul className="ed-small mt-2 space-y-1">{n.graphics.forms.waiting.map(w => <li key={w.log}><span className="ed-kicker">log {w.log} · {w.status}</span> {w.text}</li>)}</ul> : null}
      </>}
    </section>

    <section aria-labelledby="desk-data" className="ed-wrap mt-12" data-desk-data="">
      <h2 id="desk-data" className="ed-h2 ed-rule pt-3">Data desk</h2>
      <p className="ed-small mt-3">{n.data.open} open findings{Object.keys(n.data.byKind).length ? `: ${Object.entries(n.data.byKind).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""}.</p>
      {n.data.newest.length ? <Table caption="The newest open findings" head={["When", "Kind", "About", "Finding"]} min={640}>
        {n.data.newest.map(f => <tr key={f.id} className="ed-hair"><td className={td}><time dateTime={f.at}>{storyTime(f.at)}</time></td><td className={td}>{f.kind}</td><td className={`${td} break-all`}>{f.subject}</td><td className={td}>{f.text}</td></tr>)}
      </Table> : null}
      <p className="ed-small mt-4">{n.data.backtest ? `Backtest: ${n.data.backtest.line}.${n.data.running ? ` Running record: ${n.data.running.right} of ${n.data.running.calls}.` : ""}` : voiced("read.deskNewsroom.backtest")}</p>
      {n.data.proposals.length ? <ul className="ed-data mt-2 space-y-1">{n.data.proposals.map((p, i) => <li key={i}><span className="ed-kicker">{p.action} · {storyTime(p.at)}</span> {p.reason ?? ""}</li>)}</ul> : <p className="ed-small mt-2">{voiced("read.deskNewsroom.dataProposals")}</p>}
    </section>
  </>;
}
