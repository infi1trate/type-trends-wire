// U1 · a week's Data view: every item the stored weekly brief cites, one row each, in the brief's own order (section, kind, what, where
// it leads). Pure over the stored brief; the stored text is never rewritten.
import type { BriefDoc } from "../data";
import { label } from "../labels";
import { brandDataPath, dataHref } from "../ia";

export type Mover = { section: string; kind: string; what: string; href: string | null };
const KIND: Record<string, string> = { forecast: "Signal", event: "Brand change", wire: "Wire item", spread: "Spread" };
export function briefMovers(b: BriefDoc): Mover[] {
  return (b.sections ?? []).flatMap(s => (s.citations ?? []).map(c => {
    const ref = b.refs?.[`${c.kind}:${c.id}`], key = c.id.replace(/:all$/, "");
    const what = c.kind === "forecast" ? label(key).name : ref?.label ?? c.id;
    const href = c.kind === "forecast" ? dataHref({ type: "signal", id: key }) : c.kind === "event" && ref?.domain ? brandDataPath(ref.domain) : c.kind === "wire" && ref?.url ? ref.url : null;
    return { section: s.title, kind: KIND[c.kind] ?? c.kind, what, href };
  }));
}
