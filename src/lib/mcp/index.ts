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
export default defineMcp({name:'type-trends-wire',title:'Type Trends Wire',version:'0.1.0',allowedOrigins:'any',
  instructions:'Design trend data from DSGN/TERMINAL. Use get_trend before recommending a typeface, search_trends to find what is moving, and wire for recent design news. Every answer includes receipts; cite them. Bands are provisional (BASELINE) until 42 days of history exist. Read trend://methodology for scoring rules.',
   tools:[getTrend,searchTrends,wire,librarySite,libraryEvents,librarySector,crawlSpread,libraryTrends,libraryHistory]});
