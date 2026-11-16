import { MCP_TOOL_NAMES } from "./mcp/tool-names";
import { SITE_ORIGIN } from "./brand";
/** Absolute URLs use the brand origin (src/lib/brand.ts). */
export const SITE_URL = SITE_ORIGIN;
/** The consumer edition's name. Rename here only. */
export const DIGEST_NAME = "The Digest";
/** Corrections address shown in the Digest footer; the line is hidden while empty. */
export const CONTACT_EMAIL = "";
/** Issue No. 1. Weeks before this have no issue. */
export const DIGEST_FIRST_WEEK = "2026-W46";
/** Tools the MCP server exposes, counted from the registry's name list; pages quote it and mcp/server.test.ts checks the list. */
export const MCP_TOOL_COUNT = MCP_TOOL_NAMES.length;
/** The landing page (/welcome) stays private: it is gated like every other page and is not in OPEN_PATHS. Only the owner flips this. */
export const LANDING_PUBLIC = false;
/** Data stories (/data, /data/<slug>, their share images and embeds) stay private: gated like every other page, nothing in OPEN_PATHS. Only the owner flips this. */
export const DATA_STORIES_PUBLIC = false;
/** The brand pages (/brand, /brand/<page>, /brand/files/<name>) stay private: gated like every other page, nothing in OPEN_PATHS. Only the owner flips this. */
export const BRAND_PUBLIC = false;
