import { line as voiced } from "@/lib/voice";
// WATCH panel (key W), the console's `watch …` / `audit …` commands, and the +WATCH action on site pages and trait rows.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PanelHeader, Seg } from "./primitives";
import { watchViewQuery } from "@/lib/data";
import { createWatchlist, editWatchlist } from "@/lib/agency.functions";
import { localWatches, type LocalWatch } from "@/lib/agency/watch-local";
import { feedPath, isTraitInput, type ConsoleCmd } from "@/lib/agency/watch";
import { AUDIT_MAX } from "@/lib/agency/audit";
import type { WatchRange } from "@/lib/agency/watch-feed";
import { label } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";

const KIND: Record<string, string> = { site: "SITE", rebrand: "REBRAND", stage: "STAGE", alert: "ALERT", summary: "WEEK" };
function useLocalList() {
  const qc = useQueryClient();
  const [list, setList] = useState<LocalWatch[]>([]), [current, setCurrent] = useState<string | null>(null);
  const refresh = () => { const s = localWatches(); const l = s.list(); setList(l); setCurrent(s.current() ?? l[0]?.id ?? null); };
  useEffect(() => { refresh(); const on = () => { refresh(); void qc.invalidateQueries({ queryKey: ["watch-view"] }); }; window.addEventListener("dsgn-watch", on); window.addEventListener("storage", on); return () => { window.removeEventListener("dsgn-watch", on); window.removeEventListener("storage", on); }; }, []);
  return { list, current, select: (id: string) => { localWatches().setCurrent(id); setCurrent(id); }, refresh };
}
export const notifyWatch = () => { try { window.dispatchEvent(new Event("dsgn-watch")); } catch { /* SSR */ } };

export function WatchPanel() {
  const { list, current, select, refresh } = useLocalList();
  const [range, setRange] = useState<WatchRange>("week");
  const sel = list.find(x => x.id === current) ?? null;
  const q = useQuery({ ...watchViewQuery(sel?.id ?? "", range), enabled: !!sel });
  const v = q.data;
  return <section aria-label="Watchlists" className="flex min-h-0 flex-1 flex-col md:flex-row">
    <div className="shrink-0 border-b border-rule md:w-72 md:border-b-0 md:border-r">
      <PanelHeader title="WATCHLISTS" g="p-watch" meta={<span>ON THIS DEVICE</span>} />
      {list.length === 0 ? <p className="p-3 text-g500">{voiced("terminal.watch.1")} <span className="text-ink">watch new &lt;name&gt;</span> in the console (/) or <Link to="/watch/new" search={{ add: undefined, name: undefined }} className="text-ink underline">make one</Link>.</p> :
        <ul>{list.map(w => <li key={w.id} className="border-b border-rule"><button type="button" aria-pressed={w.id === sel?.id} onClick={() => select(w.id)} className={`flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left md:min-h-8 ${w.id === sel?.id ? "bg-ink text-void" : "hover:bg-g900"}`}><span className="truncate">{w.name}</span><span className="label shrink-0">{w.token ? "EDIT" : "VIEW"}</span></button></li>)}</ul>}
      <div className="flex flex-wrap gap-x-3 p-3"><Link to="/watch/new" search={{ add: undefined, name: undefined }} className="label inline-flex min-h-11 items-center text-ink hover:underline md:min-h-6">+ NEW WATCHLIST</Link>
        {sel && <button type="button" className="label min-h-11 text-g500 hover:text-ink md:min-h-6" onClick={() => { if (window.confirm(`Forget “${sel.name}” on this device? The list itself is not deleted.`)) { localWatches().remove(sel.id); refresh(); } }}>FORGET ON DEVICE</button>}</div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader title={sel ? sel.name.toUpperCase() : "CHANGES"} meta={v ? <span>{v.sites.length + v.pending.length} SITES · {v.traits.length} SIGNALS</span> : undefined} />
      {sel && <div className="flex flex-wrap items-center gap-3 border-b border-rule p-3">
        <Seg label="Range" options={["SINCE LAST WEEK", "LAST 30 DAYS"] as const} value={range === "week" ? "SINCE LAST WEEK" : "LAST 30 DAYS"} onChange={o => setRange(o === "SINCE LAST WEEK" ? "week" : "30d")} />
        <Link to="/watch/$id" params={{ id: sel.id }} search={{ k: sel.token, range }} className="label inline-flex min-h-11 items-center text-ink hover:underline md:min-h-6">OPEN PAGE →</Link>
        {v && v.sites.length >= 2 && <Link to="/audit" search={{ sites: v.sites.map(s => s.domain).slice(0, AUDIT_MAX).join(","), sector: undefined }} className="label inline-flex min-h-11 items-center text-ink hover:underline md:min-h-6">AUDIT THESE SITES →</Link>}
        {v && <a href={v.feedUrl} className="label inline-flex min-h-11 items-center text-g500 hover:text-ink md:min-h-6">RSS</a>}
      </div>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!sel ? <p className="p-3 text-g500">Pick or make a watchlist to see what changed on its sites and signals.</p>
          : q.isPending ? <p className="p-3">{voiced("busy.terminal")} <span aria-hidden="true">▍</span></p>
          : q.isError ? <p className="p-3 text-g500">Couldn't load this watchlist just now.</p>
          : !v ? <p className="p-3 text-g500">This watchlist no longer exists. Forget it on this device.</p>
          : v.empty ? <p className="p-3 text-g500">{v.empty}</p>
          : <table className="w-full table-fixed text-left"><caption className="sr-only">Changes</caption>
              <thead className="label text-g500"><tr className="border-b border-rule"><th scope="col" className="w-24 px-3 py-2 font-normal">DATE</th><th scope="col" className="w-20 py-2 font-normal max-md:hidden">KIND</th><th scope="col" className="py-2 pr-3 font-normal">CHANGE</th></tr></thead>
              <tbody>{v.items.map(i => <tr key={i.guid} className="border-b border-rule align-top"><td className="px-3 py-2 tabular-nums text-g500">{i.at.slice(5, 10)}</td><td className="label py-2 max-md:hidden">{KIND[i.kind]}</td><td className="break-words py-2 pr-3"><a href={i.href} className="hover:underline">{i.title}</a>{i.detail && <span className="block text-g500">{i.detail}</span>}</td></tr>)}</tbody></table>}
      </div>
    </div>
  </section>;
}

/** Console `watch new|add|rm` → lines + links shown in the console's result block. */
export type WatchOut = { lines: string[]; links: { label: string; href: string }[]; error?: boolean };
export function useWatchCommands() {
  const create = useServerFn(createWatchlist), edit = useServerFn(editWatchlist);
  return async (c: Extract<ConsoleCmd, { cmd: "new" | "add" | "rm" }>): Promise<WatchOut> => {
    const store = localWatches();
    if (c.cmd === "new") {
      if (!c.name) return { lines: ["Give the watchlist a name: watch new <name>"], links: [], error: true };
      const r = await create({ data: { name: c.name, sites: [], traits: [], request_render: false } });
      if (!r.ok) return { lines: [r.message], links: [], error: true };
      store.save({ id: r.id, name: r.watch.name, token: r.edit_token }); store.setCurrent(r.id); notifyWatch();
      return { lines: [`Made “${r.watch.name}”. Its edit link is remembered on this device; copy it now if you need it elsewhere (it can't be shown again):`, r.edit_url ?? "", "Add sites or signals: watch add linear.app css:subgrid"], links: [{ label: "OPEN PAGE", href: `/watch/${r.id}` }, { label: "RSS FEED", href: r.feed_url }] };
    }
    const id = store.current(), w = (id && store.get(id)?.token ? store.get(id) : store.list().find(x => x.token)) ?? null;
    if (!w?.token) return { lines: [voiced("terminal.watch.cli")], links: [], error: true };
    const sites = c.targets.filter(x => !isTraitInput(x)), traits = c.targets.filter(isTraitInput);
    const r = await edit({ data: { id: w.id, token: w.token, op: c.cmd === "add" ? { op: "add", sites, traits, request_render: true } : { op: "remove", sites, traits } } });
    if (!r.ok) return { lines: [r.message], links: [], error: true };
    if ("deleted" in r) return { lines: ["Deleted."], links: [] };
    notifyWatch();
    const cl = r.classified;
    return { lines: [
      `${c.cmd === "add" ? "Added to" : "Removed from"} “${r.watch.name}”: ${[...(cl?.sites ?? []), ...(cl?.traits ?? []).map(t => label(t).name)].join(", ") || "nothing"}.`,
      ...(r.queued.length ? [`Not tracked yet — render requested: ${r.queued.join(", ")} (joins once tracked).`] : []),
      ...(cl?.unknownTraits.length ? [`Not in the latest forecast: ${cl.unknownTraits.join(", ")}.`] : []),
      ...(cl?.invalid.length ? [`Not a domain or signal: ${cl.invalid.join(", ")}.`] : []),
      `${r.watch.sites.length} sites · ${r.watch.traits.length} signals${r.watch.pending_sites.length ? ` · ${r.watch.pending_sites.length} pending` : ""}.`,
    ], links: [{ label: "OPEN PAGE", href: `/watch/${w.id}` }] };
  };
}
export function WatchOutput({ out }: { out: WatchOut }) {
  return <div className="space-y-1">{out.lines.filter(Boolean).map((l, i) => <p key={i} className={`break-words ${out.error ? "text-g500" : ""}`}>{l}</p>)}
    {out.links.length > 0 && <p className="label flex flex-wrap gap-x-4">{out.links.map(l => <a key={l.href} href={l.href} className="text-ink hover:underline">{l.label} →</a>)}</p>}</div>;
}

/** +WATCH: add a site or trait to an editable watchlist on this device, or start a new one with it. */
export function AddToWatch({ target, name }: { target: string; name?: string }) {
  const edit = useServerFn(editWatchlist);
  const [open, setOpen] = useState(false), [lists, setLists] = useState<LocalWatch[]>([]), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setLists(localWatches().list().filter(w => w.token)); }, [open]);
  const add = async (w: LocalWatch) => {
    setBusy(true); setMsg(null);
    try {
      const trait = isTraitInput(target);
      const r = await edit({ data: { id: w.id, token: w.token!, op: { op: "add", ...(trait ? { traits: [target] } : { sites: [target] }), request_render: true } } });
      setMsg(r.ok ? `ADDED TO ${w.name.toUpperCase()}` : r.message.toUpperCase()); if (r.ok) notifyWatch();
    } catch { setMsg("COULDN'T ADD. TRY AGAIN."); } finally { setBusy(false); }
  };
  return <span className="relative inline-flex">
    <Button variant="link" aria-expanded={open} aria-label={`Add ${name ?? target} to a watchlist`} onClick={() => { setOpen(o => !o); setMsg(null); }} className="label h-6 px-1 text-g500 hover:text-ink max-md:h-11">+WATCH</Button>
    {open && <span role="dialog" aria-label="Add to watchlist" className="absolute right-0 top-full z-40 flex w-64 flex-col border border-rule bg-void p-2 text-left normal-case">
      {lists.map(w => <button key={w.id} type="button" disabled={busy} onClick={() => add(w)} className="flex min-h-11 items-center truncate px-2 text-left hover:bg-g900 md:min-h-8">{w.name}</button>)}
      {lists.length === 0 && <span className="px-2 py-1 text-g500">{voiced("terminal.watch.3")}</span>}
      <Link to="/watch/new" search={{ add: target, name: undefined }} className="label flex min-h-11 items-center px-2 text-ink hover:underline md:min-h-8">+ NEW WATCHLIST WITH THIS</Link>
      {msg && <span role="status" className="label px-2 py-1 text-g500">{msg}</span>}
    </span>}
  </span>;
}
export const feedUrlOf = (token: string) => `${SITE_URL}${feedPath(token)}`;
