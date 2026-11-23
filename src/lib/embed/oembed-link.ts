// C1 · the oEmbed discovery link on its own, so page heads (signal and chart pages) can add it without loading embed.ts, which
// carries the chart renderer and its 390 KB glyph table into every page's first byte on a cold server. Pure.
import { SITE_URL } from "../site";

export const oembedLink = (pageUrl: string, title: string) => ({ rel: "alternate", type: "application/json+oembed", href: `${SITE_URL}/api/public/oembed?url=${encodeURIComponent(pageUrl)}&format=json`, title });
