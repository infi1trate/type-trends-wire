import {defineMcp} from '@lovable.dev/mcp-js';
import getTrend from './tools/get-trend';
import searchTrends from './tools/search-trends';
import wire from './tools/wire';
import librarySite from './tools/library-site';
import libraryEvents from './tools/library-events';
import librarySector from './tools/library-sector';
import crawlSpread from './tools/crawl-spread';
import libraryTrends from './tools/library-trends';
import libraryHistory from './tools/library-history';
import siteHistory from './tools/site-history';
import { forecastTool, nextWaveTool, trendsettersTool, weeklyBriefTool } from './tools/forecast';
import recommendType from './tools/recommend-type';
import recommendPalette from './tools/recommend-palette';
import differentiate from './tools/differentiate';
import critique from './tools/critique';
import rebrands from './tools/rebrands';
import stories from './tools/stories';
import dataStories from './tools/data-stories';
import collections from './tools/collections';
import vibeMap from './tools/vibe-map';
import auditSites from './tools/audit-sites';
import watchlistChanges from './tools/watchlist-changes';
import forecastLedger from './tools/forecast-ledger';
import morningLine from './tools/morning-line';
import sectorReport from './tools/sector-report';
import { BRAND_NAME } from "../brand";
// The server reports the brand name; it still answers to LEGACY_MCP_NAME (see server.server.ts) for clients that stored it.
export default defineMcp({name:BRAND_NAME,title:BRAND_NAME,version:'0.1.0',allowedOrigins:'any',
  instructions:`Signals carry tier (headline/supporting/archive), basis (measured/ai), momentum_index (0-100) and confidence beside label; lead with headline signals and say when a value is an AI estimate. Design trend data from ${BRAND_NAME}. Use get_trend before recommending a typeface, search_trends to find what is moving, and wire for recent design news. Every answer includes receipts; cite them. Bands are provisional (BASELINE) until 42 days of history exist. Use forecast/next_wave/trendsetters/weekly_brief for predictions; each includes the model card, so state its track record; forecast_ledger is the live record of every call and how it resolved (cite its hit rate with n, never the backtest as live). Use stories for what the product judged newsworthy (each with facts, receipts and score), morning_line for the daily edition and sector_report for the quarterly state of one sector, data_stories for step-by-step answers to one question from stored captures, collections for numbered walls of captures (library_site also lists similar brands), rebrands for confirmed identity changes and vibe_map for tag-space clusters. Use audit_sites to compare 2–6 sites for a pitch or kickoff, and watchlist_changes (with a watchlist feed token) for what changed on a client's competitive set. Each trait carries a stable key plus a plain-English label and dimension (FONT, COLOR, LAYOUT, VIBE); refer to signals by label, never as $ tickers. Without a key the endpoint allows 60 requests per minute per IP; an owner-issued key (Authorization: Bearer dsgn_…) raises that. Read trend://methodology for scoring rules.`,
   tools:[getTrend,searchTrends,wire,librarySite,libraryEvents,librarySector,crawlSpread,libraryTrends,libraryHistory,siteHistory,forecastTool,nextWaveTool,trendsettersTool,weeklyBriefTool,recommendType,recommendPalette,differentiate,critique,rebrands,vibeMap,auditSites,watchlistChanges,forecastLedger,stories,morningLine,sectorReport,dataStories,collections]});
