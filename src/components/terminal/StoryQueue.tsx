// Terminal › Live › Today: the story queue as dense rows (type, score, time). HELD shows what didn't run and why.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { storyQueueQuery } from "@/lib/data";
import { AppLink } from "./AppLink";

const hm = (iso: string) => `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
export function StoryQueue({ focus }: { focus?: string | undefined }) {
  const { data, isPending, isError } = useQuery(storyQueueQuery(null));
  const [held, setHeld] = useState(false);
  const focusHeld = !!focus && !!data?.held.some(s => s.id === focus);
  useEffect(() => { if (focusHeld) setHeld(true); }, [focusHeld]);
  useEffect(() => { if (focus && data) document.getElementById(`story-${focus}`)?.scrollIntoView({ block: "center" }); }, [focus, data, held]);
  const rows = data ? (held ? [...data.published, ...data.held, ...data.killed].sort((a, b) => b.at.localeCompare(a.at) || (b.score ?? 0) - (a.score ?? 0)) : data.published) : [];
  return <section aria-label="Stories" className="border-b border-rule">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule p-3">
      <h2 className="label font-semibold text-ink">STORIES · LAST 7 DAYS{data ? <span className="num text-g500"> · {data.published.length} RAN · {data.held.length} HELD</span> : null}</h2>
      <span className="flex items-center gap-3">
        <button type="button" aria-pressed={held} onClick={() => setHeld(h => !h)} className={`label min-h-11 border px-3 ${held ? "border-signal text-signal" : "border-rule text-g500"}`}>HELD {held ? "ON" : "OFF"}</button>
        <AppLink href="/desk" className="label text-g500 underline underline-offset-2">DESK →</AppLink>
      </span>
    </div>
    {isPending ? <p className="p-3 text-g500">LOADING STORIES…</p> : isError ? <p className="p-3 text-g500">STORIES UNAVAILABLE</p>
      : !rows.length ? <p className="p-3 text-g500">NO STORY HAS RUN IN THE LAST 7 DAYS.</p>
      : <ol className="flex flex-col">{rows.map(s => <li key={s.id} id={`story-${s.id}`} className={`border-b border-rule last:border-b-0 ${s.id === focus ? "border-l-2 border-l-signal bg-g900" : ""}`}>
        <AppLink href={s.evidence} className="group grid min-h-11 grid-cols-[4ch_1fr] gap-x-2 gap-y-1 p-3 hover:bg-g900 md:grid-cols-[4ch_14ch_1fr_auto]">
          <span className="num label text-g500" title="Newsworthiness score">{s.score}</span>
          <span className="label text-g500 max-md:hidden">{s.type.replace("_", " ").toUpperCase()}</span>
          <span className="min-w-0 text-ink"><span className="label text-g500 md:hidden">{s.type.replace("_", " ").toUpperCase()} · </span><span className="group-hover:underline">{s.headline}</span>
            {s.state !== "published" && <span className="label mt-1 block text-g500">{s.state === "killed" ? "KILLED" : "HELD"} · {s.state === "killed" ? s.killReason ?? "by the editor" : s.reason}</span>}</span>
          <span className="label col-start-2 text-g500 md:col-start-4"><time dateTime={s.at}>{hm(s.at)} UTC</time></span>
        </AppLink>
      </li>)}</ol>}
  </section>;
}
