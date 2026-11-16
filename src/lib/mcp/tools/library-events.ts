import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { librarySector } from "@/lib/library-payload";
import { EVENT_TYPES } from "@/lib/library";
import { libraryEvents } from "@/lib/library-store.server";
import { json, READ } from "./shared";
export default defineTool({ name: "library_events", title: "Library change events", description: "Recent derived design changes across tracked sites, filtered by sector or event type. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).", inputSchema: { sector: librarySector.optional(), type: z.enum(EVENT_TYPES).optional(), since_days: z.number().int().min(1).max(36500).default(30), limit: z.number().int().min(1).max(100).default(50) }, annotations: READ,
  handler: async opts => json({ events: await libraryEvents(opts), receipts: { source: "DSGN Library crawler", method: "trend://methodology", since_days: opts.since_days } }) });