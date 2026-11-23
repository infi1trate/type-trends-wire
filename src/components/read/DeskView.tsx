import { line as voiced } from "@/lib/voice";
// /desk: the story queue for one day. Staff only: it renders after the editor key is accepted (StaffGate); the key lives in the
// tab's memory (staff-key.ts; never storage, URL or logs) and is sent as the bearer on every action.
import { useState } from "react";
import { setStaffKey, staffCall } from "@/lib/staff-key";
import type { NewsDrops } from "@/lib/stories/candidates";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { QueueModel } from "@/lib/stories/view";
import type { PitchedItem } from "@/lib/stories/pitch";
import { storyTime } from "@/lib/stories";
import { DigestShell } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ReadFooter } from "./Bits";
import { DeskNewsroom } from "./DeskNewsroom";

type Item = QueueModel["published"][number] & { states?: { state: string; actor: string; reason: string | null; at: string }[] };
export type DeskQueue = QueueModel & { news?: { kept: number; dropped: number; drops: NewsDrops } | null; pitches?: PitchedItem[]; db?: import("@/lib/db-health").DbDesk | null };

/** D1 Part 6 · the database above the fold: safe mode (with the owner's switch) and the engineering alerts of the last 48 hours. */
function DbPanel({ db, send }: { db: NonNullable<DeskQueue["db"]>; send: (body: Record<string, unknown>) => Promise<string> }) {
  const [msg, setMsg] = useState<string | null>(null), [reason, setReason] = useState("");
  const flip = async () => { setMsg("Saving…"); setMsg(await send({ action: "safe_mode", on: !db.safe_mode.on, reason: reason.trim() || (db.safe_mode.on ? "owner turned safe mode off" : "owner turned safe mode on"), confirm: "owner confirms safe_mode" })); };
  return <section aria-labelledby="desk-db" className="ed-data mt-6 border border-ed-ink p-3" data-desk-db="">
    <h2 id="desk-db" className="ed-kicker">Database · safe mode {db.safe_mode.on ? `on (${db.safe_mode.by ?? "auto"}: ${db.safe_mode.why})` : "off"}</h2>
    {db.alerts.length ? <ul className="mt-2 space-y-1">{db.alerts.map(a => <li key={a.at}><time dateTime={a.at}>{a.at.slice(0, 16).replace("T", " ")}</time> · <strong>{a.level === "bad" ? "Bad" : "Warn"}</strong> · {a.line}</li>)}</ul> : <p className="mt-2">{voiced("read.deskView.db")}</p>}
    {db.changes.length > 0 && <p className="ed-muted mt-2">Last change: {db.changes[0]!.at.slice(0, 16).replace("T", " ")} · {db.changes[0]!.is_on ? "on" : "off"} · {db.changes[0]!.actor} · {db.changes[0]!.reason}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">Reason <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} className="min-h-11 border border-ed-ink bg-transparent px-2" /></label>
      <button type="button" className="ed-tap min-h-11 border border-ed-ink px-3" onClick={() => void flip()}>{db.safe_mode.on ? "Turn safe mode off" : "Turn safe mode on"}</button>
      {msg && <span role="status">{msg}</span>}
    </div>
  </section>;
}
const day = (iso: string) => iso.slice(0, 10);

function Actions({ s, send }: { s: Item; send: (body: Record<string, unknown>) => Promise<string> }) {
  const [msg, setMsg] = useState<string | null>(null), [reason, setReason] = useState(""), [headline, setHeadline] = useState(s.headline), [hours, setHours] = useState(24);
  const run = async (body: Record<string, unknown>) => { setMsg("Saving…"); setMsg(await send({ id: s.id, ...body })); };
  return <div className="ed-data mt-3 space-y-3 border-l-2 border-ed-ink pl-3">
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">Pin for <input type="number" min={1} max={168} value={hours} onChange={e => setHours(Number(e.target.value))} className="w-20 border border-ed-ink bg-transparent px-2 min-h-11" /> hours</label>
      <button type="button" className="ed-tap min-h-11 border border-ed-ink px-3" onClick={() => run({ action: "pin", until: new Date(Date.now() + hours * 36e5).toISOString() })}>Pin</button>
      {s.state === "published" ? <>
        <input aria-label="Kill reason" placeholder="Reason to kill" value={reason} onChange={e => setReason(e.target.value)} className="min-h-11 flex-1 border border-ed-ink bg-transparent px-2" />
        <button type="button" disabled={reason.trim().length < 3} className="ed-tap min-h-11 border border-ed-ink px-3 disabled:opacity-50" onClick={() => run({ action: "kill", reason: reason.trim() })}>Kill</button>
      </> : <button type="button" className="ed-tap min-h-11 border border-ed-ink px-3" onClick={() => run({ action: "restore" })}>{s.state === "held" ? "Run it anyway" : "Restore"}</button>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label="Corrected headline" value={headline} onChange={e => setHeadline(e.target.value)} className="min-h-11 flex-1 border border-ed-ink bg-transparent px-2" />
      <button type="button" disabled={headline.trim().length < 3 || headline === s.headline} className="ed-tap min-h-11 border border-ed-ink px-3 disabled:opacity-50" onClick={() => run({ action: "correct", headline: headline.trim() })}>Correct headline</button>
    </div>
    {msg && <p role="status" className="ed-caption">{msg}</p>}
  </div>;
}

function Row({ s, send }: { s: Item; send: ((body: Record<string, unknown>) => Promise<string>) | null }) {
  return <li className="ed-hair pt-3">
    <p className="ed-kicker flex flex-wrap gap-x-3"><span>{s.kicker}</span><span className="ed-muted">Score {s.score}</span><time dateTime={s.at} className="ed-muted">{storyTime(s.at)}</time>{s.pinnedUntil && <span>Pinned until {s.pinnedUntil.slice(0, 16).replace("T", " ")}</span>}{s.corrected && <span>Corrected {day(s.corrected)}</span>}</p>
    <h3 className="ed-h3 mt-1 break-words"><Link to="/stories/$id" params={{ id: s.id }} className="no-underline hover:underline">{s.headline}</Link></h3>
    {s.state !== "published" && <p className="ed-small mt-1">{s.state === "killed" ? `Killed: ${s.killReason ?? "by the editor"}` : `Held: ${s.reason}`}</p>}
    {s.written && <p className="ed-data mt-1">Template · {s.template.headline}{s.template.deck ? ` — ${s.template.deck}` : ""}</p>}
    <p className="ed-caption mt-1">{s.written ? `Written by ${s.written.model}, version ${s.written.version}, ${day(s.written.at)}` : "Template text (no checked written version yet)"}</p>
    <details className="mt-2"><summary className="ed-tap ed-data cursor-pointer">Score parts, states and log</summary>
      <p className="ed-caption mt-2">{s.whyRan}</p>
      {s.dataLines.length > 0 && <ul className="ed-data mt-2 space-y-1">{s.dataLines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {s.whyLine && <p className="ed-caption mt-2">Stored why line (not shown to readers): {s.whyLine}</p>}
      <ul className="ed-data mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">{s.components.map(c => <li key={c.id}><span className="ed-kicker">{c.label}</span> <span className="num">{c.value}/25</span><span className="ed-caption block">{c.why}</span></li>)}</ul>
      {s.states && s.states.length > 0 && <ol className="ed-data mt-2" data-states="" aria-label="State history">{s.states.map((x, i) => <li key={i}><time dateTime={x.at}>{x.at.slice(0, 16).replace("T", " ")}</time> · {x.state} · {x.actor}{x.reason ? ` · ${x.reason}` : ""}</li>)}</ol>}
      {s.edits.length > 0 && <ol className="ed-data mt-2">{s.edits.map((e, i) => <li key={i}>{day(e.at)} · {e.action}{e.note ? ` · ${e.note}` : ""}</li>)}</ol>}
    </details>
    {send && <Actions s={s} send={send} />}
  </li>;
}

const VERDICT_LABEL: Record<string, string> = { story: "Already a story", ran: "Ran", would_run: "Would run", held: "Held", refused: "Not a change under the rules" };
/** U4 · what editors pitched, each with the engine's own answer. A pitch never publishes; it only records the answer. */
function Pitched({ items }: { items: PitchedItem[] }) {
  return <section aria-labelledby="desk-pitched" className="ed-wrap mt-12" data-desk-pitched="">
    <h2 id="desk-pitched" className="ed-h2 ed-rule pt-3">Pitched · {items.length}</h2>
    <p className="ed-small mt-3">Rows sent from the terminal, Data views and receipts. The engine answers each with the rules that build stories; held pitches are asked again on every build, and one that passes every rule and the daily cap runs like any other story.</p>
    {items.length ? <ul className="mt-4 space-y-5">{items.map(({ pitch: p, verdict: v, answeredAt }) => <li key={p.id} className="ed-hair pt-3" data-pitch-status={v?.status ?? "open"}>
      <p className="ed-kicker flex flex-wrap gap-x-3"><span>{VERDICT_LABEL[v?.status ?? ""] ?? "Waiting for the next build"}</span><span className="ed-muted">{p.kind} · {p.ref}</span><time dateTime={p.at} className="ed-muted">{storyTime(p.at)}</time></p>
      <p className="ed-small mt-1">“{p.note}”</p>
      {v && <p className="ed-data mt-1">{v.text}{"storyId" in v ? <> <Link to="/stories/$id" params={{ id: v.storyId }} className="ed-tap">{v.number != null ? `No. ${v.number}` : "Open"} →</Link></> : null}{answeredAt ? <span className="ed-muted"> · answered {storyTime(answeredAt)}</span> : null}</p>}
      {p.facts.length > 0 && <details className="mt-1"><summary className="ed-tap ed-data cursor-pointer">The row as pitched</summary><ul className="ed-data mt-1">{p.facts.map((f, i) => <li key={i}>{f}</li>)}</ul></details>}
    </li>)}</ul> : <p className="ed-small mt-3">{voiced("read.deskView.5")}</p>}
  </section>;
}

export function DeskView({ q, onDay }: { q: DeskQueue; onDay: (d: string | null) => void }) {
  const client = useQueryClient();
  const send = async (body: Record<string, unknown>) => {
    const r = await staffCall(body);
    if (r.status === 401) return "Key no longer accepted; paste it again.";
    if (!r.ok) { const j = (await r.json().catch(() => null)) as { issues?: { message: string }[] } | null; return `Not saved (${r.status})${j?.issues?.[0] ? `: ${j.issues[0].message}` : ""}.`; }
    await client.invalidateQueries({ queryKey: ["desk-queue"] }); await client.invalidateQueries({ queryKey: ["story-queue"] }); await client.invalidateQueries({ queryKey: ["live"] }); await client.invalidateQueries({ queryKey: ["story"] });
    return "Saved. Pages update within a minute.";
  };
  const sections: [string, Item[], string][] = [["Ran", q.published, voiced("read.deskView.1")], ["Held", q.held, voiced("read.deskView.2")], ["Killed", q.killed, voiced("read.deskView.3")]];
  return <DigestShell label="Editor's desk" section="tools">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Desk · {q.day ?? "last 7 days"}</p>
      <h1 className="ed-cover mt-3">The story queue</h1>
      <p className="ed-standfirst mt-5">What the engine ran, what it held and why. Staff only: the editor key opens this page and can pin, kill, correct or restore; every call is logged in the desk log below with who made it.</p>
      {q.news && <p className="ed-data mt-4" data-news-drops="">Outside news, last 7 days: {q.news.kept} became candidates · {q.news.dropped} dropped ({q.news.drops.bluesky} Bluesky posts · {q.news.drops.no_name} no tracked name in the title · {q.news.drops.no_subject} no design subject)</p>}
      <nav aria-label="Days" className="ed-data mt-6 flex flex-wrap gap-x-1 gap-y-1">
        <button type="button" onClick={() => onDay(null)} aria-current={q.day === null ? "true" : undefined} className={`ed-tap min-h-11 border px-3 ${q.day === null ? "border-ed-ink font-semibold" : "border-transparent"}`}>Last 7 days</button>
        {q.days.map(d => <button key={d.day} type="button" onClick={() => onDay(d.day)} aria-current={q.day === d.day ? "true" : undefined} className={`ed-tap min-h-11 gap-2 border px-3 ${q.day === d.day ? "border-ed-ink font-semibold" : "border-transparent"}`}>{d.day}<span className="ed-muted">{d.published} ran · {d.held} held{d.killed ? ` · ${d.killed} killed` : ""}</span></button>)}
      </nav>
      {q.db && <DbPanel db={q.db} send={send} />}
      <div className="ed-data mt-6 flex flex-wrap items-center gap-2">
        <span>Editor key accepted for this tab.</span><button type="button" className="ed-tap min-h-11 border border-ed-ink px-3" onClick={() => setStaffKey(null)}>Lock</button>
      </div>
    </header>
    {sections.map(([title, items, empty]) => <section key={title} aria-labelledby={`desk-${title}`} className="ed-wrap mt-12">
      <h2 id={`desk-${title}`} className="ed-h2 ed-rule pt-3">{title} · {items.length}</h2>
      {items.length ? <ul className="mt-4 space-y-6">{items.map(s => <Row key={s.id} s={s} send={send} />)}</ul> : <p className="ed-small mt-3">{empty}</p>}
    </section>)}
    <Pitched items={q.pitches ?? []} />
    <DeskNewsroom />
    <section aria-labelledby="desk-log" className="ed-wrap mt-12">
      <h2 id="desk-log" className="ed-h2 ed-rule pt-3">Editor's log</h2>
      {q.edits.length ? <ol className="ed-data mt-4 space-y-1">{q.edits.map((e, i) => <li key={i}><time dateTime={e.at}>{e.at.slice(0, 16).replace("T", " ")}</time> · {e.action} · <Link to="/stories/$id" params={{ id: e.story }} className="ed-tap">{e.headline}</Link>{e.note ? ` · ${e.note}` : ""}</li>)}</ol> : <p className="ed-small mt-3">{voiced("read.deskView.4")}</p>}
      <p className="ed-data mt-6"><AppLink href="/terminal?panel=today" className="ed-tap">Dense queue in the terminal ⇄</AppLink></p>
    </section>
    <ReadFooter terminal="/terminal?panel=today" />
  </DigestShell>;
}
