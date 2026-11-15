// /watch/<id>: what changed on a watchlist's sites and signals. Editing needs the edit token (from ?k= or remembered on this device).
import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkWatchEdit, editWatchlist } from "@/lib/agency.functions";
import type { WatchView, WatchRange } from "@/lib/agency/watch-feed";
import type { Classified, Op } from "@/lib/agency/watch";
import { AUDIT_MAX } from "@/lib/agency/audit";
import { localWatches } from "@/lib/agency/watch-local";
import { SITE_URL } from "@/lib/site";
import { SectionHead, SiteCard, StageWord, Dim, pr } from "@/components/digest/Editorial";
import { AgencyShell, Btn, CopyField, day } from "./Shell";
import { TargetsInput, splitList } from "./Targets";
import { ClassifiedReport } from "./Report";

const KIND: Record<string, string> = { site: "Site change", rebrand: "Rebrand", stage: "Stage change", alert: "Alert", summary: "Summary" };
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

export function WatchPage({ v, k }: { v: WatchView; k?: string | undefined }) {
  const qc = useQueryClient(), router = useRouter(), navigate = useNavigate();
  const edit = useServerFn(editWatchlist), check = useServerFn(checkWatchEdit);
  const [token, setToken] = useState<string | null>(null);
  const [editable, setEditable] = useState<boolean | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<{ c: Classified | null; q: string[] } | null>(null);
  const [add, setAdd] = useState(""), [name, setName] = useState(v.name), [render, setRender] = useState(true);

  useEffect(() => {
    const store = localWatches(), local = store.get(v.id), t = k ?? local?.token ?? null;
    setRemembered(!!local);
    if (local) store.save({ id: v.id, name: v.name });
    if (!t) { setEditable(false); return; }
    setToken(t);
    check({ data: { id: v.id, token: t } }).then(ok => { setEditable(ok); if (!ok && local?.token === t) store.forgetToken(v.id); }).catch(() => setEditable(false));
  }, [v.id, v.name, k, check]);

  const run = async (op: Op, confirmText?: string) => {
    if (!token || (confirmText && !window.confirm(confirmText))) return;
    setBusy(true); setMsg(null);
    try {
      const r = await edit({ data: { id: v.id, token, op } });
      if (!r.ok) { setMsg(r.message); setReport("classified" in r && r.classified ? { c: r.classified, q: [] } : null); return; }
      if ("deleted" in r) { localWatches().remove(v.id); navigate({ to: "/watch/new", search: { add: undefined, name: undefined } }); return; }
      setReport(op.op === "add" ? { c: r.classified, q: r.queued } : null);
      if (op.op === "rename") localWatches().save({ id: v.id, name: r.watch.name });
      setMsg(op.op === "rotate_feed" ? `New feed link made: ${r.feed_url}. The old one now returns “not found”; update your RSS reader.` : "Saved.");
      setAdd("");
      await qc.invalidateQueries({ queryKey: ["watch-view", v.id] }); await router.invalidate();
    } catch { setMsg("That didn't go through. Try again in a minute."); }
    finally { setBusy(false); }
  };
  const remember = () => { localWatches().save({ id: v.id, name: v.name, token: editable ? token : null }); setRemembered(true); };
  const range = (r: WatchRange) => ({ k, range: r });
  const domains = [...v.sites.map(s => s.domain)];
  const n = domains.length + v.pending.length;

  return <AgencyShell label={`Watchlist ${v.name}`} crumb="Watchlist">
    <header className="ed-wrap pb-8 pt-10">
      <p className="ed-kicker">Watchlist</p>
      <h1 className="ed-h1 mt-3 break-words">{v.name}</h1>
      <p className="ed-data mt-3">{n} {n === 1 ? "site" : "sites"} · {v.traits.length} {v.traits.length === 1 ? "signal" : "signals"} · updated {day(v.updated_at)}</p>
      <div className="no-print mt-5 flex flex-wrap gap-3">
        {domains.length >= 2 && <Link to="/audit" search={{ sites: domains.slice(0, AUDIT_MAX).join(","), sector: undefined }} className="ed-kicker inline-flex min-h-[44px] items-center border border-ed-ink bg-ed-ink px-4 text-ed-paper no-underline">Audit these sites{domains.length > AUDIT_MAX ? ` (first ${AUDIT_MAX})` : ""}</Link>}
        {!remembered && <Btn onClick={remember}>Keep on this device</Btn>}
      </div>
      {k && editable === false && <p className="ed-small mt-4">This edit link isn't valid. The list can still be viewed; ask whoever made it for the edit link.</p>}
      {k && editable && <p className="ed-small mt-4">You opened the edit link. Share the view link instead: <a href={`/watch/${v.id}`} {...pr(`/watch/${v.id}`)}>{SITE_URL}/watch/{v.id}</a></p>}
    </header>

    <section className="ed-wrap" aria-labelledby="w-changes">
      <SectionHead n="01" title="What changed" id="w-changes" />
      <div role="group" aria-label="Time range" className="no-print mb-6 flex gap-0">
        {(["week", "30d"] as const).map(r => <Link key={r} to="/watch/$id" params={{ id: v.id }} search={range(r)} aria-current={v.range === r ? "true" : undefined} className={`ed-kicker inline-flex min-h-[44px] items-center border border-ed-ink px-4 no-underline ${r === "30d" ? "border-l-0" : ""} ${v.range === r ? "bg-ed-ink text-ed-paper" : ""}`}>{r === "week" ? "Since last week" : "Last 30 days"}</Link>)}
      </div>
      {v.empty ? <p className="ed-body ed-standfirst">{v.empty}</p> :
        <ol className="flex flex-col">{v.items.map(i => <li key={i.guid} id={`c-${i.guid}`} className="ed-hair grid gap-x-6 gap-y-1 py-3 md:grid-cols-[9rem_10rem_1fr]">
          <span className="ed-data ed-muted">{day(i.at)}</span>
          <span className="ed-kicker">{KIND[i.kind]}</span>
          <span><span className="ed-small">{i.title}</span>{i.detail && <span className="ed-caption block">{i.detail}</span>} <a href={i.href} className="ed-data" {...pr(i.href)}>receipt</a></span>
        </li>)}</ol>}
    </section>

    {(v.sites.length > 0 || v.pending.length > 0) && <section className="ed-wrap mt-14" aria-labelledby="w-sites">
      <SectionHead n="02" title="Sites" id="w-sites" />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {v.sites.map(s => <div key={s.domain} className="flex flex-col gap-1">
          <SiteCard domain={s.domain} name={s.name} sector={s.sector} thumb={s.thumb} lines={[s.sector, s.lastChange ? `last change ${day(s.lastChange)}` : "no changes yet"]} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
          {editable && <Btn disabled={busy} onClick={() => run({ op: "remove", sites: [s.domain] })}>Remove {s.domain}</Btn>}
        </div>)}
        {v.pending.map(d => <div key={d} className="flex flex-col gap-2"><div className="ed-typo"><span className="ed-kicker ed-muted">Pending</span><span className="ed-h3 break-words">{d}</span><span className="ed-caption">Not tracked yet — joins once tracked</span></div>
          {editable && <Btn disabled={busy} onClick={() => run({ op: "remove", sites: [d] })}>Remove {d}</Btn>}</div>)}
      </div>
    </section>}

    {v.traits.length > 0 && <section className="ed-wrap mt-14" aria-labelledby="w-traits">
      <SectionHead n="03" title="Signals" id="w-traits" kicker="Stage and share across all sectors in the latest forecast." />
      <ul className="grid gap-x-10 md:grid-cols-2">{v.traits.map(t => <li key={t.trait} className="ed-hair flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <a href={t.explainer} {...pr(t.explainer)}>{t.name}</a> <Dim d={t.dimension} /> <StageWord stage={t.stage} />
        <a href={`/?panel=brief&trait=${encodeURIComponent(t.trait)}`} className="ed-data ed-muted">{pct(t.share)} of sites</a>
        {editable && <button type="button" disabled={busy} onClick={() => run({ op: "remove", traits: [t.trait] })} className="ed-kicker no-print ml-auto min-h-[44px] px-2 underline" aria-label={`Remove ${t.name}`}>Remove</button>}
      </li>)}</ul>
    </section>}

    <section className="ed-wrap mt-14" aria-labelledby="w-feed">
      <SectionHead n="04" title="RSS alerts" id="w-feed" kicker="Paste this into any RSS reader. It needs no password; anyone with the link can read the changes, so rotate it if it leaks." />
      <div className="max-w-2xl"><CopyField label="Feed link" value={v.feedUrl} /></div>
      {editable && <div className="no-print mt-4"><Btn disabled={busy} onClick={() => run({ op: "rotate_feed" }, "Make a new feed link? The current one stops working immediately.")}>Rotate feed link</Btn></div>}
      <div className="mt-6 max-w-2xl"><CopyField label="View link" value={`${SITE_URL}/watch/${v.id}`} note="Opens this page (behind the site password). Editing needs the separate edit link." /></div>
    </section>

    {editable && <section className="ed-wrap no-print mt-14" aria-labelledby="w-edit">
      <SectionHead n="05" title="Edit" id="w-edit" kicker="Up to 25 sites and 25 signals. Changes apply for everyone with the view link." />
      <div className="grid max-w-3xl gap-6">
        <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); const xs = splitList(add); if (xs.length) void run({ op: "add", sites: xs.filter(x => !x.includes(":")), traits: xs.filter(x => x.includes(":")), request_render: render }); }}>
          <TargetsInput id="w-add" label="Add sites or signals" value={add} onChange={setAdd} hint="Domains (linear.app) or signal keys (css:subgrid), separated by commas." />
          <label className="ed-small flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={render} onChange={e => setRender(e.target.checked)} className="h-5 w-5" /> Not tracked yet? Request a render and add it once tracked</label>
          <div><Btn type="submit" kind="solid" disabled={busy || !add.trim()}>Add</Btn></div>
        </form>
        <ClassifiedReport c={report?.c} queued={report?.q} />
        <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); void run({ op: "rename", name }); }}>
          <label htmlFor="w-name" className="ed-kicker">Name</label>
          <input id="w-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} className="ed-data min-h-[44px] border border-ed-ink bg-transparent px-3" />
          <div><Btn type="submit" disabled={busy || !name.trim() || name === v.name}>Rename</Btn></div>
        </form>
        <div className="flex flex-wrap gap-3">
          {!localWatches().get(v.id)?.token && <Btn onClick={remember}>Remember edit link on this device</Btn>}
          <Btn disabled={busy} onClick={() => run({ op: "delete" }, `Delete “${v.name}”? The view, edit and feed links stop working.`)}>Delete watchlist</Btn>
        </div>
      </div>
    </section>}
    {msg && <p role="status" className="ed-wrap ed-small mt-6">{msg}</p>}
  </AgencyShell>;
}
