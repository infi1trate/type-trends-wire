// Terminal › Live › Today: the story queue as dense rows (type, score, time). HELD shows what didn't run and why.
import { useEffect, useRef, useState } from "react";
import { FORMAT_LABEL, shows, storyFormat, type FormatFilter } from "@/lib/front/formats";
import { useQuery } from "@tanstack/react-query";
import { storyQueueQuery } from "@/lib/data";
import { AppLink } from "./AppLink";

const hm = (iso: string) => `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
const TABS: FormatFilter[] = ["all", "live", "updating", "explore", "read"];

/** The front page's format filter as terminal tabs (arrow keys move between them; the panel below is the tab panel). */
function FormatTabs({ value, onChange, counts }: { value: FormatFilter; onChange: (f: FormatFilter) => void; counts: Record<FormatFilter, number> | null }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const j = (n + TABS.length) % TABS.length;
    onChange(TABS[j]!); refs.current[j]?.focus();
  };
  return <div role="tablist" aria-label="Story format" className="flex flex-wrap border-b border-rule">
    {TABS.map((f, i) => <button key={f} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`sq-tab-${f}`} aria-controls="sq-panel" aria-selected={value === f} tabIndex={value === f ? 0 : -1}
      onClick={() => onChange(f)} onKeyDown={e => key(e, i)}
      className={`label min-h-11 border-r border-rule px-3 ${value === f ? "bg-g900 text-signal" : "text-g500 hover:text-ink"}`}>
      {FORMAT_LABEL[f].toUpperCase()}{counts ? <span className="num"> {counts[f]}</span> : null}
    </button>)}
  </div>;
}
export function StoryQueue({ focus }: { focus?: string | undefined }) {
  const { data, isPending, isError } = useQuery(storyQueueQuery(null));
  const [held, setHeld] = useState(false);
  const [format, setFormat] = useState<FormatFilter>("all");
  const focusHeld = !!focus && !!data?.held.some(s => s.id === focus);
  useEffect(() => { if (focusHeld) setHeld(true); }, [focusHeld]);
  useEffect(() => { if (focus && data) document.getElementById(`story-${focus}`)?.scrollIntoView({ block: "center" }); }, [focus, data, held]);
  const all = data ? (held ? [...data.published, ...data.held, ...data.killed].sort((a, b) => b.at.localeCompare(a.at) || (b.score ?? 0) - (a.score ?? 0)) : data.published) : [];
  const rows = all.filter(s => shows(format, storyFormat(s.type)));
  const counts = data ? Object.fromEntries(TABS.map(f => [f, all.filter(s => shows(f, storyFormat(s.type))).length])) as Record<FormatFilter, number> : null;
  return <section aria-label="Stories" className="border-b border-rule">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule p-3">
      <h2 className="label font-semibold text-ink">STORIES · LAST 7 DAYS{data ? <span className="num text-g500"> · {data.published.length} RAN · {data.held.length} HELD</span> : null}</h2>
      <span className="flex items-center gap-3">
        <button type="button" aria-pressed={held} onClick={() => setHeld(h => !h)} className={`label min-h-11 border px-3 ${held ? "border-signal text-signal" : "border-rule text-g500"}`}>HELD {held ? "ON" : "OFF"}</button>
        <AppLink href="/desk" className="label text-g500 underline underline-offset-2">DESK →</AppLink>
      </span>
    </div>
    <FormatTabs value={format} onChange={setFormat} counts={counts} />
    <div role="tabpanel" id="sq-panel" aria-labelledby={`sq-tab-${format}`}>
    {isPending ? <p className="p-3 text-g500">LOADING STORIES…</p> : isError ? <p className="p-3 text-g500">STORIES UNAVAILABLE</p>
      : !rows.length ? <p className="p-3 text-g500">{format === "all" ? "NO STORY HAS RUN IN THE LAST 7 DAYS." : format === "explore" ? "EXPLORE IS FOR PATTERN AND BRAND PAGES; NO STORY TYPE IS IN THIS FORMAT. SEE F4 PATTERNS AND F3 BRANDS." : `NO ${FORMAT_LABEL[format].toUpperCase()} STORY IN THE LAST 7 DAYS.`}</p>
      : <ol className="flex flex-col">{rows.map(s => <li key={s.id} id={`story-${s.id}`} className={`border-b border-rule last:border-b-0 ${s.id === focus ? "border-l-2 border-l-signal bg-g900" : ""}`}>
        <AppLink href={s.evidence} className="group grid min-h-11 grid-cols-[4ch_1fr] gap-x-2 gap-y-1 p-3 hover:bg-g900 md:grid-cols-[4ch_8ch_14ch_1fr_auto]">
          <span className="num label text-g500" title="Newsworthiness score">{s.score}</span>
          <span className="num label text-ink max-md:hidden" data-story-number="">{s.number != null ? `NO. ${s.number}` : "—"}</span>
          <span className="label text-g500 max-md:hidden">{s.type.replace("_", " ").toUpperCase()}</span>
          <span className="min-w-0 text-ink"><span className="label text-g500 md:hidden">{s.number != null ? <span className="text-ink">NO. {s.number} · </span> : null}{s.type.replace("_", " ").toUpperCase()} · </span><span className="group-hover:underline">{s.headline}</span>
            {s.state !== "published" && <span className="label mt-1 block text-g500">{s.state === "killed" ? "KILLED" : "HELD"} · {s.state === "killed" ? s.killReason ?? "by the editor" : s.reason}</span>}</span>
          <span className="label col-start-2 text-g500 md:col-start-5"><time dateTime={s.at}>{hm(s.at)} UTC</time></span>
        </AppLink>
      </li>)}</ol>}
    </div>
  </section>;
}
