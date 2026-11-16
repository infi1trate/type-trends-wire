// The 404 page's two offers beyond the front page: look up a tracked brand or signal by name (a plain GET to /brands without
// JavaScript), and the newest published story (read after hydration; nothing shows until it arrives, so nothing spins).
import { useEffect, useId, useState } from "react";
import { getLookup, getNewestStory } from "@/lib/read.functions";
import type { LookupItem } from "@/lib/lookup";
import { line } from "@/lib/voice";

export function NotFoundLookup() {
  const id = useId(), [q, setQ] = useState(""), [res, setRes] = useState<{ q: string; items: LookupItem[] } | null>(null), [newest, setNewest] = useState<{ headline: string; href: string } | null>(null);
  useEffect(() => { let on = true; getNewestStory().then(s => { if (on) setNewest(s); }).catch(() => {}); return () => { on = false; }; }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const t = q.trim(); if (t.length < 2) return;
    try { setRes({ q: t, items: await getLookup({ data: { q: t } }) }); } catch { window.location.href = `/brands?q=${encodeURIComponent(t)}`; }
  };
  return <div className="mt-4 w-full max-w-[60ch] basis-full">
    <form action="/brands" method="get" role="search" aria-label="Brands and signals" onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label htmlFor={id} className="ed-kicker w-full">Look up a brand or signal</label>
      <input id={id} name="q" type="search" value={q} onChange={e => setQ(e.target.value)} maxLength={80} autoComplete="off" placeholder={line("site.notFound.search")} className="ed-data form-field min-h-11 min-w-0 flex-1 bg-transparent px-3" />
      <button type="submit" className="c-raised" data-container="raised">Look up</button>
    </form>
    <div aria-live="polite" className="mt-4">
      {res && (res.items.length
        ? <ul className="ed-data divide-y divide-ed-rule border-y border-ed-rule">{res.items.map(i => <li key={i.href}><a href={i.href} className="flex min-h-11 items-center justify-between gap-4 py-2"><span>{i.label}</span><span className="ed-small">{i.detail}</span></a></li>)}</ul>
        : <p className="ed-small">{line("site.notFound.noMatch", { q: res.q })} <a href="/brands" className="ed-tap">Every brand</a> · <a href="/signals" className="ed-tap">Every signal</a></p>)}
    </div>
    {newest && <p className="ed-data mt-8"><span className="ed-kicker mr-2">{line("site.notFound.newest")}</span><a href={newest.href} className="ed-tap">{newest.headline}</a></p>}
  </div>;
}
