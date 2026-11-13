import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { forecasts, modelCard, nextWave, trendsetters, weeklyBrief } from "@/lib/forecast-store.server";
import { json, READ } from "./shared";
const receipts = { source: "DSGN/TERMINAL forecast run (library history + crawler spread + wire + Google Fonts)", method: "trend://methodology#FORECAST" };
const scope = z.string().min(1).max(40).describe("'all' or a library sector slug.");
export const forecastTool = defineTool({ name: "forecast", title: "Trait forecast", description: "Fitted adoption curve, +1/+2/+4 quarter projections with 80% intervals, stage, momentum, evidence and backtest for design traits.", inputSchema: { dimension: z.string().max(40).optional(), value: z.string().max(80).optional(), scope: scope.optional() }, annotations: READ,
  handler: async input => json({ model_card: await modelCard(), rows: await forecasts(input), receipts }) });
export const nextWaveTool = defineTool({ name: "next_wave", title: "Next-wave traits", description: "Traits ranked by the next-wave score with each component (trendsetter gap, vanguard spread, momentum, corroboration).", inputSchema: { scope: scope.optional(), limit: z.number().int().min(1).max(50).optional() }, annotations: READ,
  handler: async ({ scope: s, limit }) => json({ model_card: await modelCard(), rows: await nextWave(s ?? "all", limit ?? 15), receipts }) });
export const trendsettersTool = defineTool({ name: "trendsetters", title: "Trendsetter sites", description: "Library sites that adopted traits earliest before they crossed 20% library-wide share.", inputSchema: { limit: z.number().int().min(1).max(50).optional() }, annotations: READ,
  handler: async ({ limit }) => json({ model_card: await modelCard(), rows: await trendsetters(limit ?? 20), receipts }) });
export const weeklyBriefTool = defineTool({ name: "weekly_brief", title: "Weekly brief", description: "The AI-written weekly brief with citations to forecasts, events, wire items and spread signals.", inputSchema: { week: z.string().regex(/^\d{4}-W\d{2}$/).optional() }, annotations: READ,
  handler: async ({ week }) => json({ model_card: await modelCard(), brief: await weeklyBrief(week), receipts: { ...receipts, note: "AI-written from computed evidence only; verify cited items." } }) });
