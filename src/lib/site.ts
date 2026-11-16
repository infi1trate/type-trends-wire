import { SITE_ORIGIN } from "./brand";
/** Absolute URLs use the brand origin (src/lib/brand.ts). */
export const SITE_URL = SITE_ORIGIN;
/** The consumer edition's name. Rename here only. */
export const DIGEST_NAME = "The Digest";
/** Corrections address shown in the Digest footer; the line is hidden while empty. */
export const CONTACT_EMAIL = "";
/** Issue No. 1. Weeks before this have no issue. */
export const DIGEST_FIRST_WEEK = "2026-W46";
/** Tools the MCP server exposes (src/lib/mcp/index.ts); pages quote it and mcp/server.test.ts checks it. */
export const MCP_TOOL_COUNT = 26;
/** The landing page (/welcome) stays private: it is gated like every other page and is not in OPEN_PATHS. Only the owner flips this. */
export const LANDING_PUBLIC = false;
