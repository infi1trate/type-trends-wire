// Plain-words report of what an add/create did with each input.
import type { Classified } from "@/lib/agency/watch";
import { label } from "@/lib/labels";
export function ClassifiedReport({ c, queued }: { c: Classified | null | undefined; queued?: string[] | undefined }) {
  if (!c) return null;
  const lines = [
    c.sites.length ? `Sites: ${c.sites.join(", ")}.` : null,
    c.traits.length ? `Signals: ${c.traits.map(t => label(t).name).join(", ")}.` : null,
    queued?.length ? `Not tracked yet — render requested for ${queued.join(", ")}; they join the list once tracked.` : c.untracked.length ? `Not tracked yet: ${c.untracked.join(", ")}. Tick “request a render” to queue them.` : null,
    c.unknownTraits.length ? `Not in the latest forecast: ${c.unknownTraits.join(", ")}.` : null,
    c.invalid.length ? `Not a domain or signal: ${c.invalid.join(", ")}.` : null,
  ].filter(Boolean);
  return lines.length ? <ul className="ed-small flex flex-col gap-1" aria-live="polite">{lines.map(l => <li key={l}>{l}</li>)}</ul> : null;
}
