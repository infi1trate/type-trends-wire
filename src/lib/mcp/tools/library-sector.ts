import { defineTool } from "@lovable.dev/mcp-js";
import { librarySector as schema } from "@/lib/library-payload";
import { librarySector } from "@/lib/library-store.server";
import { json, READ } from "./shared";
import { BRAND_NAME } from "@/lib/brand";
export default defineTool({ name: "library_sector", title: "Library sector statistics", description: "Sector statistics, top headline and body fonts with site counts, and theme split from latest desktop home captures. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).", inputSchema: { sector: schema }, annotations: READ,
  handler: async ({ sector }) => json({ ...await librarySector(sector), receipts: { source: `${BRAND_NAME} library crawler`, method: "trend://methodology" } }) });