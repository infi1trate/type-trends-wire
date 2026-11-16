// Loads the words for one share card from memoised loaders the pages already use (anonymous SELECT only; no AI). Null → 404.
import { resolveLabel, sectorName } from "../labels";
import { pct } from "../digest/copy";
import { dayText } from "../data-stories/text";
import type { ShareCard, ShareKind } from "./scene";
import { sharePath } from "./scene";

export async function shareCard(kind: ShareKind, id: string): Promise<ShareCard | null> {
  switch (kind) {
    case "front": {
      const { loadFront } = await import("../front/front.server");
      const m = await loadFront("all", "all"), l = m.lead;
      return { kicker: `The live front page · ${dayText(m.now)}`, title: l ? l.story.headline : "The live newsroom for how brands look and sound on the web", deck: l?.why?.text ?? null, path: "" };
    }
    case "story": {
      const [{ storyIndex }, { streamOf }] = await Promise.all([import("../stories/read.server"), import("../stories/view")]);
      const s = streamOf(await storyIndex()).find(x => x.id === id);
      return s ? { kicker: `${s.kicker || "Story"}${s.sector && !(s.kicker || "").includes(sectorName(s.sector)) ? ` · ${sectorName(s.sector)}` : ""} · ${dayText(s.happened_at)}`, title: s.headline, deck: s.deck, path: `/stories/${s.id}` } : null;
    }
    case "brand": {
      const { loadBrand } = await import("../read.server");
      const b = await loadBrand(id);
      if (!b) return null;
      const moves = b.timeline.length;
      return { kicker: `Brand · ${b.sectorName}`, title: b.name || b.domain, figure: { value: String(moves), label: `${moves === 1 ? "confirmed move" : "confirmed moves"} on record for ${b.domain}` }, deck: b.lastMove ? `Latest: ${b.lastMove.text}` : null, path: `/brands/${b.domain}` };
    }
    case "pattern": {
      const [{ latestSignals }, { traitDefinition }, { rowKey }] = await Promise.all([import("../signals.server"), import("../digest/copy"), import("../signals")]);
      const l = resolveLabel(id);
      if (!l.known) return null;
      const { snap } = await latestSignals("all"), row = snap.rows.find(r => r.scope === "all" && rowKey(r) === l.key), v = row?.current_share != null ? pct(row.current_share, 0) : null;
      return { kicker: `Pattern · ${l.dimension}`, title: l.name, figure: v ? { value: v, label: "of tracked homepages show it, all sectors, latest forecast" } : null, deck: traitDefinition(l.key), path: `/patterns/${l.key}` };
    }
    case "collection": {
      const { COLLECTIONS } = await import("../collections/registry");
      const c = COLLECTIONS.find(x => x.slug === id && x.status === "live");
      return c ? { kicker: `Collection No. ${c.number}`, title: c.title, deck: c.deck, path: `/collections/${c.slug}` } : null;
    }
    case "morning": {
      const { loadMorning } = await import("../editions/editions.server");
      const m = await loadMorning(id === "today" ? null : id);
      if (!m) return null;
      const e = m.edition;
      return { kicker: `The Morning Line · ${e.title}`, title: e.lead?.headline ?? "A quiet morning: no new story since yesterday", deck: e.lead ? `${e.count} ${e.count === 1 ? "story" : "stories"} in this edition.` : null, path: e.href };
    }
    case "sector": {
      const { loadSectorReport } = await import("../editions/editions.server");
      const r = await loadSectorReport(id);
      return r ? { kicker: `Sector report · ${r.quarter.label}`, title: r.title, figure: { value: String(r.brands), label: `${r.brands === 1 ? "brand" : "brands"} tracked in ${r.name}` }, deck: r.note ?? `Rising here, rising elsewhere, white space and the brands that lead in ${r.name}.`, path: r.href } : null;
    }
  }
}
/** The absolute share image URL for a page's head(). */
export { sharePath };
export async function shareImage(kind: ShareKind, id: string, format: "png" | "svg") {
  const [{ shareScene }, { respond }] = await Promise.all([import("./scene"), import("../digest/og.server")]);
  const c = await shareCard(kind, id).catch(() => null);
  if (!c) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return respond(shareScene(c), format, `${c.kicker}: ${c.title}`);
}
