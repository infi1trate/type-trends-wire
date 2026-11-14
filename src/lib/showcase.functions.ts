import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Showcase reads (F9 Rebrand Desk, F7 Vibe Map, Chart of the Week): anonymous SELECT-only stores shared with MCP.
export const rebrandInput = z.object({ sector: z.string().max(40).optional(), source: z.enum(["live", "archive"]).optional(), year: z.number().int().min(2021).max(2100).optional(), offset: z.number().int().min(0).max(5000).default(0), limit: z.number().int().min(1).max(500).default(20) });
export const getRebrands = createServerFn({ method: "GET" }).inputValidator(rebrandInput).handler(async ({ data }) => {
  const { rebrands } = await import("./rebrands.server");
  return rebrands(data, 500);
});
export const getVibeMap = createServerFn({ method: "GET" }).handler(async () => {
  const { vibeMap } = await import("./vibe.server");
  return vibeMap();
});
export const getChartCard = createServerFn({ method: "GET" }).inputValidator(z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/).nullable() })).handler(async ({ data }) => {
  const { chartCard } = await import("./chart/chart.server");
  return chartCard(data.week);
});
