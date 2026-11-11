import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { currentSpread } from "@/lib/library-store.server";
import { json, READ } from "./shared";
export default defineTool({ name: "crawl_spread", title: "Vanguard versus mainstream spread", description: "Current crawler signal shares and spread points for English-language or all successful sites.", inputSchema: { scope: z.enum(["en", "all"]) }, annotations: READ,
  handler: async ({ scope }) => json({ scope, rows: await currentSpread(scope), receipts: { source: "DSGN weekly crawler", method: "trend://methodology" } }) });