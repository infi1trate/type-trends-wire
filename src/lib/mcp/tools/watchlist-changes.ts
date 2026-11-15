import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { TOKEN_RE } from "@/lib/agency/watch";
import { SITE_URL } from "@/lib/site";
import { json, READ } from "./shared";
export default defineTool({
  name: "watchlist_changes", title: "Watchlist changes",
  description: "The same items as a watchlist's RSS feed: the last 30 days of confirmed site changes, rebrands, stage changes and alerts for its sites and signals (newest first, at most 50), plus weekly summaries. Needs the feed token from the feed URL (/api/public/watch-feed/<feed_token>.xml); rotated or unknown tokens return an error. Traits keep their stable key and add label, dimension and explainer_url.",
  inputSchema: { feed_token: z.string().regex(TOKEN_RE, "22-character feed token").describe("The token in the watchlist's feed URL.") },
  annotations: READ,
  handler: async ({ feed_token }) => {
    const { feedItems, prodDeps } = await import("@/lib/agency/watch.server");
    const r = await feedItems(feed_token, await prodDeps("check"));
    if (!r) throw new ToolError("Unknown feed token");
    return json({ watchlist: r.name, page_url: r.page_url, items: r.items.map(i => ({ guid: i.guid, kind: i.kind, at: i.at, title: i.title, detail: i.detail, link: `${r.page_url}#c-${i.guid}`, receipt: i.href.startsWith("http") ? i.href : `${SITE_URL}${i.href}`, ...(i.domain ? { domain: i.domain } : {}), ...(i.trait ? { trait: i.trait } : {}) })), receipts: { method: "trend://methodology#WATCHLISTS" } });
  },
});
