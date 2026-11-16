import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { librarySector } from "@/lib/library-payload";
import { MAX_REBRAND_LIMIT } from "@/lib/rebrands";
import { json, READ } from "./shared";
import { BRAND_NAME, SITE_ORIGIN } from "@/lib/brand";
export default defineTool({ name: "rebrands", title: "Rebrand desk", description: "Confirmed identity changes (fonts, accent/palette hue, theme, redesigns) across library sites, newest first, with before/after fields and the forecast stage of each new trait. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).",
  inputSchema: { sector: librarySector.optional(), since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO date; only rebrands confirmed on or after it."), limit: z.number().int().min(1).max(MAX_REBRAND_LIMIT).default(10) }, annotations: READ,
  handler: async ({ sector, since, limit }) => {
    const { rebrands } = await import("@/lib/rebrands.server");
    const r = await rebrands({ sector, since: since ? `${since}T00:00:00Z` : undefined, limit }, MAX_REBRAND_LIMIT);
    return json({ counts: r.counts, matched: r.filtered.total, rows: r.rows.map(x => ({ domain: x.domain, sector: x.sector, source: x.source, confirmed_at: x.confirmed_at, first_seen: x.effective_at, reasons: x.reasons, fields: x.fields, before: x.before, after: x.after, read: x.read, new_traits: x.new_traits, links: { library: `${SITE_ORIGIN}${x.links.library}`, archive_before: x.links.archive_before, archive_after: x.links.archive }, covered_by: x.wire, receipts: { event_ids: x.event_ids, snapshots: [x.before.snapshot_id, x.after.snapshot_id] } })),
      receipts: { source: `${BRAND_NAME} library confirmed changes (live crawler + Wayback quarterly archive)`, data_through: r.data_through, method: "trend://methodology#REBRAND DESK" } });
  } });
