import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { GLOSSARY, searchGlossary, type GlossaryKind } from "@/lib/glossary";
import { QueryBar } from "./primitives";
import { methodLink } from "./Info";
import { KEY_MAP, SECTIONS } from "@/lib/ia";

const GROUPS: [GlossaryKind, string][] = [["stage", "STAGES"], ["dimension", "DIMENSIONS"], ["metric", "MEASURES"], ["panel", "PANELS"], ["column", "COLUMNS"]];
/** Keys come from the one IA registry (src/lib/ia.ts): F1–F7 sections, old keys as aliases. */
export const KEYS: [string, string][] = [["F1–F7", "Sections: " + SECTIONS.map(s => `${s.key} ${s.label}`).join(" · ") + " (also 1–6)"], ...KEY_MAP.filter(k => k.alias).map(k => [k.key, `${k.label} (old key)`] as [string, string]), ...KEY_MAP.filter(k => !k.alias && "action" in k.target).map(k => [k.key, k.label] as [string, string]), ["ENTER", "Open the focused row"]];

/** Searchable glossary: side panel on desktop, full-screen sheet on mobile. Entries deep-link as #g-<id>. */
export function Glossary({ onClose, onTour, focus }: { onClose: () => void; onTour: () => void; focus?: string | null }) {
  const [q, setQ] = useState(""), input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchGlossary(q), [q]);
  useEffect(() => {
    const el = focus ? document.getElementById(focus) : null;
    if (el) el.scrollIntoView({ block: "start" }); else input.current?.focus();
  }, [focus]);
  return (
    <aside role="dialog" aria-modal="false" aria-label="Glossary" className="fixed inset-0 z-50 flex flex-col border-l border-rule bg-void md:left-auto md:w-[440px]">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-rule bg-g900 px-3">
        <h2 className="label font-semibold text-ink">GLOSSARY · {GLOSSARY.length} TERMS</h2>
        <button type="button" onClick={onClose} className="label h-8 px-2 text-g500 hover:text-ink max-md:h-11">ESC ✕</button>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-b border-rule p-3">
        <QueryBar ref={input} label="Search the glossary" placeholder="SEARCH TERMS" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={onTour} className="label self-start text-ink underline underline-offset-2 max-md:min-h-11">REPLAY THE TOUR →</button>
          <Link to="/what-we-show" className="label inline-flex items-center self-start text-ink underline underline-offset-2 max-md:min-h-11">WHAT WE SHOW AND WHY →</Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!q && <section className="border-b border-rule p-3"><h3 className="label mb-2 text-g500">KEYS</h3><dl className="grid grid-cols-[8ch_1fr] gap-y-1">{KEYS.map(([k, v]) => <Fragment key={k}><dt className="font-semibold text-ink">{k}</dt><dd className="text-g500">{v}</dd></Fragment>)}</dl></section>}
        {hits.length === 0 && <p className="t-say p-3 text-g500">No term matches “{q}”. Try a shorter word, like “share” or “stage”.</p>}
        {GROUPS.map(([kind, title]) => {
          const list = hits.filter(e => e.kind === kind);
          return list.length ? <section key={kind} className="border-b border-rule"><h3 className="label sticky top-0 border-b border-rule bg-g900 px-3 py-1 text-g500">{title}</h3>
            {list.map(e => <article key={e.id} id={`g-${e.id}`} className="scroll-mt-8 border-b border-rule p-3 last:border-b-0 target:outline target:outline-1 target:outline-ink">
              <h4 className="label font-semibold text-ink"><a href={`#g-${e.id}`} className="hover:underline">{e.term}</a></h4>
              <p className="t-say mt-1 text-ink">{e.measures}</p>
              <p className="t-say mt-1 text-g500">{e.howToRead}</p>
              <a {...methodLink(e.methodologyAnchor)} className="label mt-1 inline-block text-ink underline underline-offset-2 max-md:min-h-11">Methodology →</a>
            </article>)}</section> : null;
        })}
      </div>
    </aside>
  );
}
