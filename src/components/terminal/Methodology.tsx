import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { panelStepsQuery } from "@/lib/data";
import { howThePanelGrows } from "@/lib/panel";
import { methodologySections } from "@/lib/methodology";
import { Overlay } from "./primitives";

const SECTIONS = methodologySections();
/** Methodology with one anchored section per topic (#m-<slug>), the target of every "Methodology →" link. */
export function Methodology({ onClose, focus }: { onClose: () => void; focus?: string | null }) {
  const p = useQuery(panelStepsQuery());
  const sections = [...SECTIONS, { id: "m-how-the-panel-grows", title: "HOW THE PANEL GROWS", lines: howThePanelGrows(p.data?.steps ?? [], p.data?.panel ?? null) }];
  useEffect(() => { if (focus) document.getElementById(focus)?.scrollIntoView({ block: "start" }); }, [focus]);
  return (
    <Overlay title="METHODOLOGY" onClose={onClose}>
      <nav aria-label="Methodology sections" className="mb-3 flex flex-wrap gap-x-3 gap-y-1">{sections.map(s => <a key={s.id} href={`#${s.id}`} className="label text-g500 hover:text-ink">{s.title}</a>)}</nav>
      {sections.map(s => <section key={s.id} id={s.id} className={`scroll-mt-2 border-t border-rule pt-3 mt-3 ${focus === s.id ? "outline outline-1 outline-ink" : ""}`}><h3 className="label mb-2 text-ink">{s.title}</h3>{s.lines.map(l => <p key={l} className="t-say mb-2 break-words text-ink">{l}</p>)}</section>)}
    </Overlay>
  );
}
