import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { currentSpread } from "@/lib/library-store.server";
import { json, READ, TIER_INPUT } from "./shared";
import { byTier } from "../signal-index";
import { BRAND_NAME } from "@/lib/brand";
export default defineTool({ name: "crawl_spread", title: "Vanguard versus mainstream spread", description: "Current crawler signal shares and spread points for English-language or all successful sites. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).", inputSchema: { scope: z.enum(["en", "all"]), tier: TIER_INPUT }, annotations: READ,
  handler: async ({ scope, tier }) => json({ scope, rows: byTier(await currentSpread(scope), tier, r => (r.signal ? `spread:${r.signal}` : null)), receipts: { source: `${BRAND_NAME} weekly crawler`, method: "trend://methodology" } }) });