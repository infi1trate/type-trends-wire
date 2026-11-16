import { line as voiced } from "@/lib/voice";
// /desk: the story queue for one day, readable by anyone inside the gate. Actions appear only after the editor key is pasted;
// the key lives in this component's memory for the tab (never storage, URL or logs).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { QueueModel } from "@/lib/stories/view";
import { storyTime } from "@/lib/stories";
import { DigestShell } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ReadFooter } from "./Bits";

type Item = QueueModel["published"][number];
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
    <h3 className="ed-h3 mt-1"><Link to="/stories/$id" params={{ id: s.id }} className="no-underline hover:underline">{s.headline}</Link></h3>
    {s.state !== "published" && <p className="ed-small mt-1">{s.state === "killed" ? `Killed: ${s.killReason ?? "by the editor"}` : `Held: ${s.reason}`}</p>}
    <details className="mt-2"><summary className="ed-tap ed-data cursor-pointer">Score parts and log</summary>
      <p className="ed-caption mt-2">{s.whyRan}</p>
      <ul className="ed-data mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">{s.components.map(c => <li key={c.id}><span className="ed-kicker">{c.label}</span> <span className="num">{c.value}/25</span><span className="ed-caption block">{c.why}</span></li>)}</ul>
      {s.edits.length > 0 && <ol className="ed-data mt-2">{s.edits.map((e, i) => <li key={i}>{day(e.at)} · {e.action}{e.note ? ` · ${e.note}` : ""}</li>)}</ol>}
    </details>
    {send && <Actions s={s} send={send} />}
  </li>;
}

export function DeskView({ q, onDay }: { q: QueueModel; onDay: (d: string | null) => void }) {
  const [key, setKey] = useState(""), [unlocked, setUnlocked] = useState(false), [err, setErr] = useState<string | null>(null);
  const client = useQueryClient();
  const call = async (body: Record<string, unknown>) => fetch("/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body), credentials: "same-origin" });
  const unlock = async () => { setErr(null); const r = await call({ action: "queue" }); if (r.ok) setUnlocked(true); else { setErr(r.status === 401 ? "That key was not accepted." : r.status === 429 ? "Too many tries; wait a minute." : "The desk could not be reached."); } };
  const send = async (body: Record<string, unknown>) => {
    const r = await call(body);
    if (r.status === 401) { setUnlocked(false); return "Key no longer accepted; paste it again."; }
    if (!r.ok) { const j = (await r.json().catch(() => null)) as { issues?: { message: string }[] } | null; return `Not saved (${r.status})${j?.issues?.[0] ? `: ${j.issues[0].message}` : ""}.`; }
    await client.invalidateQueries({ queryKey: ["story-queue"] }); await client.invalidateQueries({ queryKey: ["live"] }); await client.invalidateQueries({ queryKey: ["story"] });
    return "Saved. Pages update within a minute.";
  };
  const sections: [string, Item[], string][] = [["Ran", q.published, voiced("read.deskView.1")], ["Held", q.held, voiced("read.deskView.2")], ["Killed", q.killed, voiced("read.deskView.3")]];
  return <DigestShell label="Editor's desk" section="tools">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Desk · {q.day ?? "last 7 days"}</p>
      <h1 className="ed-cover mt-3">The story queue</h1>
      <p className="ed-standfirst mt-5">What the engine ran, what it held and why. Everyone inside the site can read this; only the editor key can pin, kill, correct or restore, and every action is logged.</p>
      <nav aria-label="Days" className="ed-data mt-6 flex flex-wrap gap-x-1 gap-y-1">
        <button type="button" onClick={() => onDay(null)} aria-current={q.day === null ? "true" : undefined} className={`ed-tap min-h-11 border px-3 ${q.day === null ? "border-ed-ink font-semibold" : "border-transparent"}`}>Last 7 days</button>
        {q.days.map(d => <button key={d.day} type="button" onClick={() => onDay(d.day)} aria-current={q.day === d.day ? "true" : undefined} className={`ed-tap min-h-11 gap-2 border px-3 ${q.day === d.day ? "border-ed-ink font-semibold" : "border-transparent"}`}>{d.day}<span className="ed-muted">{d.published} ran · {d.held} held{d.killed ? ` · ${d.killed} killed` : ""}</span></button>)}
      </nav>
      <div className="ed-data mt-6 flex flex-wrap items-center gap-2">
        {unlocked ? <><span>Editor key accepted for this tab.</span><button type="button" className="ed-tap min-h-11 border border-ed-ink px-3" onClick={() => { setKey(""); setUnlocked(false); }}>Lock</button></>
          : <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); void unlock(); }}>
            <label htmlFor="desk-key">Editor key</label>
            <input id="desk-key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} className="min-h-11 w-64 border border-ed-ink bg-transparent px-2" />
            <button type="submit" disabled={!key} className="ed-tap min-h-11 border border-ed-ink px-3 disabled:opacity-50">Unlock actions</button>
            {err && <span role="alert">{err}</span>}
          </form>}
      </div>
    </header>
    {sections.map(([title, items, empty]) => <section key={title} aria-labelledby={`desk-${title}`} className="ed-wrap mt-12">
      <h2 id={`desk-${title}`} className="ed-h2 ed-rule pt-3">{title} · {items.length}</h2>
      {items.length ? <ul className="mt-4 space-y-6">{items.map(s => <Row key={s.id} s={s} send={unlocked ? send : null} />)}</ul> : <p className="ed-small mt-3">{empty}</p>}
    </section>)}
    <section aria-labelledby="desk-log" className="ed-wrap mt-12">
      <h2 id="desk-log" className="ed-h2 ed-rule pt-3">Editor's log</h2>
      {q.edits.length ? <ol className="ed-data mt-4 space-y-1">{q.edits.map((e, i) => <li key={i}><time dateTime={e.at}>{e.at.slice(0, 16).replace("T", " ")}</time> · {e.action} · <Link to="/stories/$id" params={{ id: e.story }} className="ed-tap">{e.headline}</Link>{e.note ? ` · ${e.note}` : ""}</li>)}</ol> : <p className="ed-small mt-3">{voiced("read.deskView.4")}</p>}
      <p className="ed-data mt-6"><AppLink href="/terminal?panel=today" className="ed-tap">Dense queue in the terminal ⇄</AppLink></p>
    </section>
    <ReadFooter terminal="/terminal?panel=today" />
  </DigestShell>;
}
