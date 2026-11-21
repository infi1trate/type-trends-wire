// N1 · the newsroom on /desk (staff only, after the editor key): spend against the weekly cap, the action levels, the desk log with
// a desk filter, and the golden scores. Read through the desk's `newsroom` action; nothing here is on a reader-facing page.
import { useState } from "react";
import { line as voiced } from "@/lib/voice";
import { useQuery } from "@tanstack/react-query";
import { staffJson } from "@/lib/staff-key";
import { storyTime } from "@/lib/stories";
import type { HistoryRow } from "@/lib/newsroom/log";
import type { ActionDef, Level } from "@/lib/newsroom/register";
import type { SpendStatus } from "@/lib/newsroom/spend";
import { ACTORS, PIPELINE } from "@/lib/newsroom/desks";

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
};
export const newsroomQuery = (desk: string | null) => ({ queryKey: ["desk-newsroom", desk ?? "all"], staleTime: 0, queryFn: () => staffJson<Newsroom>({ action: "newsroom", ...(desk ? { desk } : {}) }) });
const LOG_SHOWN = 50;
const usd = (n: number) => `USD ${n.toFixed(2)}`;
const th = "py-2 pr-3 text-left font-normal ed-kicker align-bottom";
const td = "py-2 pr-3 align-top";

function Table({ caption, head, children, min = 560 }: { caption: string; head: string[]; children: React.ReactNode; min?: number }) {
  return <div className="mt-4 overflow-x-auto"><table className="ed-data ruled-table w-full border-collapse" style={{ minWidth: min }}>
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
        {(all ? data.log : data.log.slice(0, LOG_SHOWN)).map(r => <tr key={r.ref} className="ed-hair"><td className={td}><time dateTime={r.at}>{r.at.slice(0, 16).replace("T", " ")}</time></td><td className={td}>{r.actor}</td><td className={td}>{r.action}{r.level ? <span className="ed-caption block">{r.level}</span> : null}</td><td className={`${td} break-all`}>{r.subject_id ?? "—"}</td><td className={td}>{r.decision}</td><td className={td}>{r.reason ?? "—"}</td></tr>)}
      </Table> : null}
      {data.log.length > LOG_SHOWN && <button type="button" onClick={() => setAll(v => !v)} className="ed-tap ed-data mt-3 min-h-[44px] border border-ed-ink px-3">{all ? `Show the newest ${LOG_SHOWN}` : `Show all ${data.log.length}`}</button>}
      {data.log.length ? null : <p className="ed-small mt-3">Nothing logged{desk ? ` for ${desk}` : ""} in the last 14 days.</p>}
    </section>

    <section aria-labelledby="desk-board" className="ed-wrap mt-12" data-desk-board="">
      <h2 id="desk-board" className="ed-h2 ed-rule pt-3">The board</h2>
      <p className="ed-small mt-3">Each pitch with the desk that holds it. A desk assigns itself with the assign action; in N1 no desk is switched on.</p>
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
