import { defineTool } from "@lovable.dev/mcp-js";
import { librarySector as schema } from "@/lib/library-payload";
import { librarySector } from "@/lib/library-store.server";
import { json, READ } from "./shared";
export default defineTool({ name: "library_sector", title: "Library sector statistics", description: "Sector statistics, top headline and body fonts with site counts, and theme split from latest desktop home captures. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).", inputSchema: { sector: schema }, annotations: READ,
  handler: async ({ sector }) => json({ ...await librarySector(sector), receipts: { source: "DSGN Library crawler", method: "trend://methodology" } }) });