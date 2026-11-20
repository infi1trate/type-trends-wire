import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { frontRestQuery, frontTopQuery } from "@/lib/data";
import { legacyTerminalSearch } from "@/lib/ia";
import { resolveSector } from "@/lib/sector-lens";
import { resolveFormat, type Format } from "@/lib/front/formats";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { FrontPageView } from "@/components/read/FrontView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME, BRAND_LINE } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

const TITLE = `${BRAND_NAME} — ${BRAND_LINE}`;
const DESC = "What is changing in how brands look and sound on the web, as it is detected: the lead story, the live column, what is moving, the chart of the day and the editions, every number with receipts.";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; format?: Format | undefined } => ({
    ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
    ...(resolveFormat(s["format"]) !== "all" ? { format: resolveFormat(s["format"]) as Format } : {}),
  }),
  // `/` is always Read. Old terminal links (/?panel=…, ?trait=…, ?cmd=…) go to the same view at /terminal.
  beforeLoad: ({ location }) => {
    const legacy = legacyTerminalSearch(location.search as Record<string, unknown>);
    if (legacy) throw redirect({ to: "/terminal", search: legacy, statusCode: 301 });
  },
  loaderDeps: ({ search }) => ({ sector: resolveSector(search.sector), format: resolveFormat(search.format) }),
  // P1: only the lead and live column are awaited; the side column and lower lists start now and stream into their slots.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(frontRestQuery(deps.sector, deps.format));
    return context.queryClient.ensureQueryData(frontTopQuery(deps.sector, deps.format)).then(() => undefined);
  },
  head: () => ({
    meta: withShare(shareImageFor("front", "today"), [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: SITE_URL }, { name: "twitter:card", content: "summary_large_image" }]),
    links: [{ rel: "canonical", href: SITE_URL }, ...fontLinks()],
  }),
  component: Front,
  errorComponent: () => <DigestNotFound v="front.failed" />,
  notFoundComponent: () => <DigestNotFound v="front.notFound" />,
});
function Front() {
  const { sector, format } = Route.useSearch();
  const { data } = useSuspenseQuery(frontTopQuery(resolveSector(sector), resolveFormat(format)));
  return <FrontPageView m={data} />;
}
