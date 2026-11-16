// The single source for the product's name and how it introduces itself. Pure, dependency-free.
// Machine names (tool names, URLs, feed paths, the gate cookie, console commands, storage keys, the crawler API and
// MCP key prefixes) are deliberately NOT derived from here: renaming the product must never break a stored link or client.
export const BRAND_NAME = "slug";
/** The product line, used under the name in mastheads, meta descriptions and share cards. */
export const BRAND_LINE = "the live newsroom for how brands look and sound on the web";
/** Canonical origin for absolute URLs (canonical links, feeds, oEmbed, share images, MCP receipts). */
export const SITE_ORIGIN = "https://slug.global";
export const SITE_HOST = new URL(SITE_ORIGIN).host;
export const BRAND_DESCRIPTION = "slug is the live newsroom for how brands look and sound on the web: it measures brand homepages, writes up what changed as stories with receipts, and forecasts which design signals are coming next.";
/** How the product's own crawler and reader are named in user-facing text (not the HTTP user-agent string). */
export const BOT_NAME = "slugbot";
/** Names the product used before. Only brand.ts may spell them; legacy-name.test.ts enforces it. */
export const LEGACY_NAMES = ["DSGN/TERMINAL", "DSGN TERMINAL", "type-trends-wire"] as const;
/** Origins earlier links and stored rows may still carry; they keep working and are rewritten to relative paths on display. */
export const LEGACY_ORIGINS = ["https://type-trends-wire.lovable.app"] as const;
/** HTTP user-agent token of the app's own page reader (LITE). Kept as published: site owners may match it in robots.txt. */
export const LEGACY_UA_TOKEN = "DSGNTerminalBot";
/** The MCP server's earlier machine name; clients that stored it keep working (see mcp/server.server.ts). */
export const LEGACY_MCP_NAME = "type-trends-wire";
/** "<page> · slug" — the one title suffix. */
export const titled = (page: string) => `${page} · ${BRAND_NAME}`;
/** Display name for a stored `source` value written under an earlier name (e.g. alert rows). Stored rows are never rewritten. */
export const sourceName = (source: string) => ((LEGACY_NAMES as readonly string[]).includes(source) ? BRAND_NAME : source);
/** Turns an absolute link on this site (current or legacy origin) into a relative path; other links pass through. */
export const sitePath = (url: string) => { for (const o of [SITE_ORIGIN, ...LEGACY_ORIGINS]) if (url.startsWith(`${o}/`) || url === o) return url.slice(o.length) || "/"; return url; };
/** Stored copy written under an earlier name ("WIRE · DSGN/TERMINAL" in a Digest receipt) reads with today's name. Applied at render
 * time by the view models; stored rows are never rewritten. Machine names (URLs, keys, the UA token) are not touched. */
export function deLegacy(text: string): string;
export function deLegacy(text: string | null): string | null;
export function deLegacy(text: string | undefined): string | undefined;
export function deLegacy(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  let out = text;
  for (const n of LEGACY_NAMES) out = out.split(n).join(BRAND_NAME);
  return out;
}
