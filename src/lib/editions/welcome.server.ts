// /welcome (private landing): the three jobs, each with a live example read from stored data. No AI per view.
import { loadBrand, loadLive } from "../read.server";
import { storyIndex } from "../stories/read.server";
import { streamOf, storyPath } from "../stories/view";
import { loadEditions } from "./editions.server";

export async function loadWelcome() {
  const [live, all, editions] = await Promise.all([loadLive("all", 0, "all"), storyIndex().catch(() => []), loadEditions(null)]);
  const lead = live.lead;
  // ACT: the newest white-space story that is not already the SPOT example.
  const ws = streamOf(all).filter(s => s.type === "white_space" && s.id !== lead?.id).sort((a, b) => b.happened_at.localeCompare(a.happened_at) || b.score - a.score)[0] ?? null;
  // PROVE: the lead story's brand when it names one, else the brand with the newest published move.
  const move = streamOf(all).find(s => ["move", "rebrand", "counter_move"].includes(s.type) && s.domains.length);
  const domain = lead?.domains[0] ?? move?.domains[0] ?? null;
  const b = domain ? await loadBrand(domain).catch(() => null) : null;
  return {
    spot: lead ? { headline: lead.headline, kicker: lead.kicker, deck: lead.deck ?? null, at: lead.at, href: lead.evidence } : null,
    prove: b ? { domain: b.domain, name: b.name, sectorName: b.sectorName, lastMove: b.lastMove, soWhat: b.soWhat, shows: b.shows.filter(s => s.tier === "headline").slice(0, 4).map(s => ({ name: s.name, stage: s.stage, href: s.href })), timeline: b.timeline.slice(0, 3).map(t => ({ at: t.at, kind: t.kind, text: t.text })), href: `/brands/${encodeURIComponent(b.domain)}` } : null,
    act: ws ? { headline: ws.headline, kicker: ws.kicker, deck: ws.deck, at: ws.happened_at, href: storyPath(ws.id) } : null,
    editions: { morning: editions.morning ? { title: editions.morning.title, href: editions.morning.href, count: editions.morning.count } : null, digest: editions.digest, sectors: editions.sectors.filter(s => s.enough).length },
  };
}
