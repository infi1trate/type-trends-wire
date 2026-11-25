import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { librarySector } from "@/lib/library-payload";
import { EVENT_TYPES } from "@/lib/library";
import { libraryEvents } from "@/lib/library-store.server";
import { json, READ } from "./shared";
import { BRAND_NAME } from "@/lib/brand";
import { brandName } from "@/lib/brand-names";
import { tapeLine } from "@/lib/tape";
import { latestChecks } from "@/lib/integrity.server";
import { supabaseAnon } from "@/lib/mcp/supabase";
export default defineTool({ name: "library_events", title: "Library change events", description: "Recent derived design changes across tracked sites, filtered by sector or event type. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).", inputSchema: { sector: librarySector.optional(), type: z.enum(EVENT_TYPES).optional(), since_days: z.number().int().min(1).max(36500).default(30), limit: z.number().int().min(1).max(100).default(50) }, annotations: READ,
  handler: async opts => { const evs = await libraryEvents(opts), checks = await latestChecks(supabaseAnon(), evs.map(e => e.id).filter((x): x is number => x != null)).catch(() => null);
    // E2e: each live change carries its integrity verdict; only a confirmed one (pass) has a line in the latest changes.
    const verdict = (e: { id: number | null; source: string | null }) => (e.source && e.source !== "live" ? "archive" : e.id == null || !checks ? "unknown" : checks.get(e.id)?.verdict ?? "unchecked");
    return json({ events: evs.map(e => ({ ...e, check: verdict(e), ...(e.domain ? { name: brandName(e.domain) } : {}), ...(e.domain && e.type && e.detected_at && ["pass", "archive"].includes(verdict(e)) ? { tape: tapeLine({ domain: e.domain, type: e.type, before: e.before, after: e.after, page_type: e.page_type ?? null, summary: e.summary ?? null, detected_at: e.detected_at }) } : {}) })), receipts: { source: `${BRAND_NAME} library crawler`, method: "trend://methodology", since_days: opts.since_days } }); } });