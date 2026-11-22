// N5 · /desk's Publisher and Scout panels (staff only, after the editor key): the newest Digest package check with every item, the
// issue's social drafts with their status and a copy button each, this week's audience numbers against last week's and the five
// most-read stories; the sources register and this week's brand candidates. Nothing here posts, and nothing is on a reader's page.
import { useState } from "react";
import { line as voiced } from "@/lib/voice";
import { storyTime } from "@/lib/stories";

type Aud = { week: string; visitors: number; pageviews: number; top: { path: string; views: number }[]; sources: { name: string; visits: number }[]; test: boolean } | null;
export type N5 = {
  publisher: {
    check: { id: number; at: string; week: string; issue: number | null; pass: boolean; test: boolean; items: { id: string; name: string; ok: boolean; detail: string }[] } | null;
    drafts: { id: number; at: string; week: string; target: string; story_id: string | null; body: string; status: string; test: boolean }[];
    audience: { week: string; current: Aud; previous: Aud; stories: { path: string; views: number }[] };
    calls: { today: number; week: number; fixtures_week: number; cap: number; usd_week: number };
  } | null;
  scout: {
    register: { id: string; name: string; provides: string; status: string; terms_read: string; terms_link: string; note?: string; noted_at: string | null }[];
    candidates: { id: number; at: string; name: string; domain: string; sector: string; why: string; cites: string; status: string; test: boolean }[];
    week: string;
    calls: { today: number; week: number; fixtures_week: number; cap: number; usd_week: number };
  } | null;
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
function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="ed-tap min-h-11 border border-ed-ink px-3" aria-label="Copy this draft"
    onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); }).catch(() => {}); }}>
    <span aria-live="polite">{done ? "Copied" : "Copy"}</span>
  </button>;
}
const change = (a: number | undefined, b: number | undefined) => (a == null || b == null ? "" : b === 0 ? "" : ` (${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 1000) / 10)}%)`);

export function DeskN5({ n }: { n: N5 }) {
  const p = n.publisher, s = n.scout;
  return <>
    {p ? <section aria-labelledby="desk-publisher" className="ed-wrap mt-12" data-desk-publisher="">
      <h2 id="desk-publisher" className="ed-h2 ed-rule pt-3">Publisher</h2>
      <p className="ed-small mt-3">Drafts calls today: {p.calls.today} of {p.calls.cap}; {p.calls.week} this week{p.calls.fixtures_week ? `, plus ${p.calls.fixtures_week} fixture calls` : ""} (USD {p.calls.usd_week.toFixed(2)}). Drafts are drafts: only the owner sets a status, and nothing here posts.</p>
      <h3 className="ed-h3 mt-6">Package check{p.check ? ` · ${p.check.week}${p.check.issue ? ` (No. ${p.check.issue})` : ""} · ${storyTime(p.check.at)}` : ""}</h3>
      {p.check ? <>
        <p className="ed-small mt-3">{p.check.test ? <span className="ed-kicker" data-test-row="">Test </span> : null}<strong>{p.check.pass ? "Passed" : "Failed"}</strong>: {p.check.items.filter(i => i.ok).length} of {p.check.items.length} checks.</p>
        <Table caption="Every item of the newest package check" head={["Check", "Result", "Detail"]} min={640}>
          {p.check.items.map(i => <tr key={i.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{i.name}</th><td className={td}>{i.ok ? "pass" : "fail"}</td><td className={`${td} break-words`}>{i.detail}</td></tr>)}
        </Table>
      </> : <p className="ed-small mt-3">{voiced("read.deskN5.noCheck")}</p>}
      <h3 className="ed-h3 mt-6">Drafts</h3>
      {p.drafts.length ? <ul className="ed-data mt-3 space-y-4">{p.drafts.map(d => <li key={d.id} className="ed-hair pb-3">
        <span className="ed-kicker">{d.id} · {d.target === "digest" ? "Digest" : "Story"} · {d.status}{d.test ? " · test" : ""}</span>
        <p className="mt-1 break-words">{d.body}</p>
        <div className="mt-2"><Copy text={d.body} /></div>
      </li>)}</ul> : <p className="ed-small mt-3">{voiced("read.deskN5.noDrafts")}</p>}
      <h3 className="ed-h3 mt-6">Audience · {p.audience.week}</h3>
      {p.audience.current ? <>
        <dl className="ed-data mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><dt className="ed-kicker">Visitors</dt><dd className="num">{p.audience.current.visitors}{change(p.audience.current.visitors, p.audience.previous?.visitors)}</dd></div>
          <div><dt className="ed-kicker">Pageviews</dt><dd className="num">{p.audience.current.pageviews}{change(p.audience.current.pageviews, p.audience.previous?.pageviews)}</dd></div>
          <div><dt className="ed-kicker">Last week visitors</dt><dd className="num">{p.audience.previous?.visitors ?? "not entered"}</dd></div>
          <div><dt className="ed-kicker">Last week pageviews</dt><dd className="num">{p.audience.previous?.pageviews ?? "not entered"}</dd></div>
        </dl>
        {p.audience.current.test ? <p className="ed-small mt-2"><span className="ed-kicker" data-test-row="">Test</span> These numbers are a test entry.</p> : null}
        <h4 className="ed-kicker mt-4">Five most-read stories</h4>
        {p.audience.stories.length ? <ol className="ed-data mt-2 list-decimal space-y-1 pl-6">{p.audience.stories.map(x => <li key={x.path}><a className="ed-link" href={x.path}>{x.path}</a> · <span className="num">{x.views}</span> views</li>)}</ol> : <p className="ed-small mt-2">{voiced("read.deskN5.noStoryPaths")}</p>}
        {p.audience.current.sources.length ? <p className="ed-small mt-3">Sources: {p.audience.current.sources.map(x => `${x.name} ${x.visits}`).join(" · ")}</p> : null}
      </> : <p className="ed-small mt-3">{voiced("read.deskN5.noAudience")}</p>}
    </section> : null}

    {s ? <section aria-labelledby="desk-scout" className="ed-wrap mt-12" data-desk-scout="">
      <h2 id="desk-scout" className="ed-h2 ed-rule pt-3">Scout</h2>
      <p className="ed-small mt-3">Candidates calls today: {s.calls.today} of {s.calls.cap}; {s.calls.week} this week{s.calls.fixtures_week ? `, plus ${s.calls.fixtures_week} fixture calls` : ""} (USD {s.calls.usd_week.toFixed(2)}). Proposals only: the owner accepts, and nothing is added to the library by the product.</p>
      <h3 className="ed-h3 mt-6">Candidates · {s.week}</h3>
      {s.candidates.length ? <Table caption="This week's brand candidates with their status" head={["Brand", "Sector", "Why", "Status"]} min={720}>
        {s.candidates.map(c => <tr key={c.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{c.id} · {c.name}<span className="ed-caption block">{c.domain}</span>{c.test ? <span className="ed-kicker block" data-test-row="">Test</span> : null}</th><td className={td}>{c.sector}</td><td className={td}>{c.why}<span className="ed-caption block">{c.cites}</span></td><td className={td}>{c.status}</td></tr>)}
      </Table> : <p className="ed-small mt-3">{voiced("read.deskN5.noCandidates")}</p>}
      <h3 className="ed-h3 mt-6">Sources register</h3>
      <Table caption="Every outside source slug reads or has considered, with its status and terms" head={["Source", "Provides", "Status", "Terms read", "Terms"]} min={860}>
        {s.register.map(r => <tr key={r.id} className="ed-hair"><th scope="row" className={`${td} text-left font-normal`}>{r.name}{r.note ? <span className="ed-caption block">{r.note}</span> : null}</th><td className={td}>{r.provides}</td><td className={td}>{r.status}</td><td className={td}>{r.terms_read}</td><td className={`${td} break-all`}>{r.terms_link.startsWith("https://") ? <a className="ed-link" href={r.terms_link} rel="noopener noreferrer">{r.terms_link}</a> : r.terms_link}</td></tr>)}
      </Table>
    </section> : null}
  </>;
}
