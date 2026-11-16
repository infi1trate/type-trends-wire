import type { LaunchPayload } from "@/lib/launch/launch.server";
import { answer } from "@/lib/launch/launch";
import { DigestShell } from "@/components/digest/Editorial";
import { Link } from "@tanstack/react-router";

const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

/** Read-only: what each switch is set to now, what turning it on would expose, and plain yes/no pre-flight lines. No controls. */
export function LaunchView({ p }: { p: LaunchPayload }) {
  return <DigestShell label="Status" section="tools">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker"><Link to="/status" className="ed-tap">Status</Link> · launch readiness</p>
      <h1 className="ed-cover mt-3">Before anything opens</h1>
      <p className="ed-standfirst mt-5">Every switch as it is set in the code today, what turning it on would expose, and the checks worth a yes first. This page changes nothing; the owner flips switches in code and publishes.</p>
      <p className="ed-caption mt-2">Checked {stamp(p.checked_at)}.</p>
    </header>
    <section aria-labelledby="ln-switches" className="ed-wrap mt-12">
      <h2 id="ln-switches" className="ed-h2 ed-rule pt-3">The switches</h2>
      <dl className="mt-4 divide-y divide-[var(--tk-rule)]" data-launch-switches="">
        {p.switches.map(s => <div key={s.id} className="grid gap-2 py-4 md:grid-cols-12 md:gap-6" data-switch={s.id}>
          <dt className="md:col-span-3"><span className="ed-h3">{s.name}</span> <span className="ed-badge" data-on={s.on ? "" : undefined}>{s.on ? "On" : "Off"}</span></dt>
          <dd className="md:col-span-9"><p>{s.now}</p><p className="ed-small mt-1">{s.exposes}</p></dd>
        </div>)}
      </dl>
    </section>
    <section aria-labelledby="ln-checks" className="ed-wrap mt-12 mb-16">
      <h2 id="ln-checks" className="ed-h2 ed-rule pt-3">Pre-flight</h2>
      <table className="ed-data ruled-table mt-4 w-full border-collapse text-left" data-launch-checks="">
        <caption className="sr-only">Pre-flight checks, each answered yes, no or unknown</caption>
        <thead><tr><th scope="col">Check</th><th scope="col">Answer</th><th scope="col" className="max-md:sr-only">Why</th></tr></thead>
        <tbody>{p.checks.map(c => <tr key={c.id} data-check={c.id}>
          <th scope="row" className="py-3 pr-4 align-top font-medium">{c.question}</th>
          <td className="py-3 pr-4 align-top"><span className="ed-kicker">{answer(c)}</span></td>
          <td className="py-3 align-top ed-small max-md:block">{c.detail}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </DigestShell>;
}
