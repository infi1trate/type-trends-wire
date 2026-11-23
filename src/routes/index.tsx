import { createFileRoute, redirect } from "@tanstack/react-router";
import { frontAlsoQuery, frontRestQuery, frontTapeQuery, frontWireQuery, frontTopQuery } from "@/lib/data";
import { legacyTerminalSearch, terminalObjectHref } from "@/lib/ia";
import { resolveSector } from "@/lib/sector-lens";
import { resolveFormat, type Format } from "@/lib/front/formats";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { FrontPageView } from "@/components/read/FrontView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME, BRAND_LINE } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";
import { AnnounceFirst } from "@/components/read/FirstPicture";
import { firstPaint } from "@/lib/first-paint.iso";
import { linkHeader } from "@/lib/first-paint";

const TITLE = `${BRAND_NAME} — ${BRAND_LINE}`;
const DESC = `Today on ${BRAND_NAME}: what is changing in how brands look and sound on the web: the lead story, the day's other stories, the tape of every confirmed change, the chart of the day and the editions, every number with receipts.`;

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; format?: Format | undefined } => ({
    ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
    ...(resolveFormat(s["format"]) !== "all" ? { format: resolveFormat(s["format"]) as Format } : {}),
  }),
  // `/` is always Read. Old terminal links (/?panel=…, ?trait=…, ?cmd=…) go to the same view at /terminal.
  beforeLoad: ({ location }) => {
    const legacy = legacyTerminalSearch(location.search as Record<string, unknown>);
    // U1: an old link to an object's terminal view goes straight to that object's one address, in its Data view.
    const obj = legacy ? terminalObjectHref(legacy as Record<string, unknown>) : null;
    if (obj) throw redirect({ href: obj, statusCode: 301 });
    if (legacy) throw redirect({ to: "/terminal", search: legacy, statusCode: 301 });
  },
  loaderDeps: ({ search }) => ({ sector: resolveSector(search.sector), format: resolveFormat(search.format) }),
  // E3b · nothing is awaited: the frame goes out first and every read (the lead and live column, the side column and lower lists,
  // Also today's pictures, the tape) starts now and streams into its sized slot.
  // C1b · the one exception: the lead's stored picture address (one small read, started when the request arrived, waited for at most
  // FIRST_PAINT_DEADLINE_MS after arrival), so the first flush announces the picture Today paints largest and its request leaves with the first byte.
  loader: async ({ context, deps }) => {
    void context.queryClient.prefetchQuery(frontTopQuery(deps.sector, deps.format));
    void context.queryClient.prefetchQuery(frontRestQuery(deps.sector, deps.format));
    void context.queryClient.prefetchQuery(frontAlsoQuery(deps.sector, deps.format));
    void context.queryClient.prefetchQuery(frontTapeQuery());
    void context.queryClient.prefetchQuery(frontWireQuery());
    const lens = deps.sector === "all" && deps.format === "all";
    return { first: lens ? (await firstPaint("front", "today")).picture : null };
  },
  headers: ({ loaderData }) => { const link = linkHeader(loaderData?.first); return link ? { Link: link } : undefined; },
  head: () => ({
    meta: withShare(shareImageFor("front", "today"), [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: SITE_URL }, { name: "twitter:card", content: "summary_large_image" }]),
    links: [{ rel: "canonical", href: SITE_URL }, ...fontLinks()],
  }),
  component: Front,
  errorComponent: () => <DigestNotFound v="front.failed" />,
  notFoundComponent: () => <DigestNotFound v="front.notFound" />,
});
function Front() {
  const { sector, format } = Route.useSearch(), { first } = Route.useLoaderData();
  return <><AnnounceFirst p={first} /><FrontPageView sector={resolveSector(sector)} format={resolveFormat(format)} /></>;
}
