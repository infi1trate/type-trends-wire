import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { librarySector } from "@/lib/library-payload";
import { AUDIT_MAX, AUDIT_MIN, parseAuditSites, type Audit } from "@/lib/agency/audit";
import { SITE_URL } from "@/lib/site";
import { json, READ } from "./shared";
const abs = (p: string) => (p.startsWith("http") ? p : `${SITE_URL}${p}`);
/** Structured audit sections with absolute receipt links; thumbnails reduced to their credited URL + caption. */
export function auditJson(a: Audit) {
  const refs = <T extends { explainer: string; receipt: string }>(xs: T[]) => xs.map(({ explainer: _e, receipt, ...x }) => ({ ...x, receipt: abs(receipt) }));
  return {
    audit_url: a.url, note: "audit_url opens the printable audit page; the site is password-protected while in private preview.",
    domains: a.domains, sector: a.sector, sector_source: a.sectorSource, data_through: a.dataThrough, sections: a.sections, pending: a.pending,
    glance: a.glance.map(g => ({ domain: g.domain, name: g.name, sector: g.sector, status: g.status, captured_at: g.captured, latest_change: g.latest, thumbnail: g.thumb ? { url: abs(g.thumb.src), caption: g.thumb.caption, live: g.thumb.live } : null, terminal: abs(g.terminal) })),
    type: a.type, color: a.color,
    layout: a.layout ? { sites: a.layout.sites, components: a.layout.components, css_features: a.layout.css } : null,
    vibe: a.vibe ? { ...a.vibe, ai_estimate: true } : null,
    market: a.market ? { sites: a.market.sites.map(s => ({ domain: s.domain, scope: s.scope, sentence: s.sentence, ahead: refs(s.ahead), behind: refs(s.behind) })) } : null,
    recent_moves: a.moves ? { sites: a.moves.sites.map(s => ({ domain: s.domain, items: s.items.map(i => ({ ...i, href: abs(i.href) })) })) } : null,
    white_space: a.whitespace ? { ...a.whitespace, traits: refs(a.whitespace.traits) } : null,
    receipts: { method: "trend://methodology#COMPETITIVE AUDIT", captures: a.method.captures, notes: a.method.notes },
  };
}
export default defineTool({
  name: "audit_sites", title: "Competitive audit",
  description: `Compare ${AUDIT_MIN}–${AUDIT_MAX} sites side by side: at a glance, type (faces, sizes, shared faces), color (palettes with readable names, overlap), layout and components (sites × components matrix, CSS features, stack), vibe and voice (AI-tagged estimates), versus the market (rising/emerging traits each site already shows and fading ones it still uses, read in its own sector), recent moves (90 days) and white space (traits rising in the set's main sector that none of them use). Untracked domains are listed as pending. Each trait keeps its stable key and adds label, dimension and explainer_url; audit_url opens the printable page.`,
  inputSchema: { domains: z.array(z.string().min(3).max(253)).min(AUDIT_MIN).max(AUDIT_MAX).describe("Domains such as linear.app; protocol and www. are ignored."), sector: librarySector.optional().describe("Read open territory in this sector instead of the set's most common one.") },
  annotations: READ,
  handler: async ({ domains, sector }) => {
    const p = parseAuditSites(domains);
    if (!p.ok) throw new ToolError(p.error);
    const { loadAudit } = await import("@/lib/agency/audit.server");
    return json(auditJson(await loadAudit(p.domains, sector ?? null)));
  },
});
