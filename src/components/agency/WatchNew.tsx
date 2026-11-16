// /watch/new: create a watchlist; shows the view link, the one-time edit link and the feed link.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createWatchlist } from "@/lib/agency.functions";
import { localWatches } from "@/lib/agency/watch-local";
import type { Classified } from "@/lib/agency/watch";
import { SectionHead } from "@/components/digest/Editorial";
import { AgencyShell, Btn, CopyField, FORM_BOX } from "./Shell";
import { TargetsInput, splitList } from "./Targets";
import { ClassifiedReport } from "./Report";

type Made = { id: string; name: string; edit_url: string; view_url: string; feed_url: string; classified: Classified | null; queued: string[] };
export function WatchNew({ add, name: initialName }: { add?: string | undefined; name?: string | undefined }) {
  const create = useServerFn(createWatchlist);
  const [name, setName] = useState(initialName ?? ""), [targets, setTargets] = useState(add ?? ""), [render, setRender] = useState(true), [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [made, setMade] = useState<Made | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const xs = splitList(targets);
      const r = await create({ data: { name, sites: xs.filter(x => !x.includes(":")), traits: xs.filter(x => x.includes(":")), request_render: render } });
      if (!r.ok) { setErr(r.message); return; }
      localWatches().save({ id: r.id, name: r.watch.name, token: keep ? r.edit_token : null });
      localWatches().setCurrent(r.id);
      setMade({ id: r.id, name: r.watch.name, edit_url: r.edit_url!, view_url: r.view_url, feed_url: r.feed_url, classified: r.classified, queued: r.queued });
    } catch { setErr("That didn't go through. Check the name and try again."); }
    finally { setBusy(false); }
  };
  return <AgencyShell label="New watchlist" crumb="Watchlists">
    <header className="ed-wrap pb-8 pt-10">
      <p className="ed-kicker">Watchlists</p>
      <h1 className="ed-h1 mt-3">Keep an eye on a competitive set</h1>
      <p className="ed-standfirst mt-4">Pick up to 25 sites and 25 signals. You get a view link to share, a private edit link and an RSS feed of every confirmed change. No account needed.</p>
    </header>
    <section className="ed-wrap" aria-labelledby="wn-form">
      {!made ? <form data-container="rulebox" className={FORM_BOX} onSubmit={e => { e.preventDefault(); void submit(); }}>
        <SectionHead n="01" title="New watchlist" id="wn-form" />
        <div className="flex flex-col gap-1"><label htmlFor="wn-name" className="ed-kicker">Name</label>
          <input id="wn-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Acme — competitors" className="ed-data min-h-[44px] border border-ed-ink bg-transparent px-3" /></div>
        <TargetsInput id="wn-targets" label="Sites and signals (optional)" value={targets} onChange={setTargets} hint="Domains (linear.app) or signal keys (css:subgrid), separated by commas. You can add more later with the edit link." />
        <label className="ed-small flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={render} onChange={e => setRender(e.target.checked)} className="h-5 w-5" /> Not tracked yet? Request a render and add it once tracked</label>
        <label className="ed-small flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} className="h-5 w-5" /> Remember the edit link on this device</label>
        <div><Btn type="submit" kind="solid" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create watchlist"}</Btn></div>
        {err && <p role="alert" className="ed-small">{err}</p>}
      </form> : <div className="grid max-w-3xl gap-6" aria-live="polite">
        <SectionHead n="01" title={`“${made.name}” is ready`} id="wn-form" />
        <CopyField label="View link — share this" value={made.view_url} note="Anyone with the site password and this link can see the list." />
        <CopyField label="Edit link — shown once" value={made.edit_url} note={`Copy it now: only a fingerprint of it is stored, so it can't be shown again.${keep ? " It is also remembered on this device." : ""} Anyone with it can change or delete the list.`} />
        <CopyField label="RSS feed" value={made.feed_url} note="Works in any RSS reader without the password. You can rotate it from the edit link." />
        <ClassifiedReport c={made.classified} queued={made.queued} />
        <div className="flex flex-wrap gap-3"><Link to="/watch/$id" params={{ id: made.id }} search={{ k: undefined, range: "week" }} className="ed-kicker inline-flex min-h-[44px] items-center border border-ed-ink bg-ed-ink px-4 text-ed-paper no-underline">Open the watchlist</Link></div>
      </div>}
    </section>
  </AgencyShell>;
}
