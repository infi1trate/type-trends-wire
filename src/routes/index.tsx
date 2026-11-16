import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { liveQuery } from "@/lib/data";
import { resolveTypeFilter, type TypeFilter } from "@/lib/stories/view";
import { legacyTerminalSearch } from "@/lib/ia";
import { resolveSector } from "@/lib/sector-lens";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { LiveView } from "@/components/read/LiveView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `${BRAND_NAME} — the live newsroom for how brands look and sound`;
const DESC = "What is changing in how brands look and sound on the web, who is doing it and where the opening is: stories, signals and brands, every number with receipts.";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; page?: number | undefined; type?: Exclude<TypeFilter, "all"> | undefined } => ({
    ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
    ...(resolveTypeFilter(s["type"]) !== "all" ? { type: resolveTypeFilter(s["type"]) as Exclude<TypeFilter, "all"> } : {}),
    ...(typeof s["page"] === "number" && s["page"] > 0 ? { page: Math.floor(s["page"]) } : {}),
  }),
  // `/` is always Read. Old terminal links (/?panel=…, ?trait=…, ?cmd=…) go to the same view at /terminal.
  beforeLoad: ({ location }) => {
    const legacy = legacyTerminalSearch(location.search as Record<string, unknown>);
    if (legacy) throw redirect({ to: "/terminal", search: legacy, statusCode: 301 });
  },
  loaderDeps: ({ search }) => ({ sector: resolveSector(search.sector), page: search.page ?? 0, type: (search.type ?? "all") as TypeFilter }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(liveQuery(deps.sector, deps.page, deps.type)).then(() => undefined),
  head: () => ({
    meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: SITE_URL }, { name: "twitter:card", content: "summary_large_image" }],
    links: [{ rel: "canonical", href: SITE_URL }, ...fontLinks()],
  }),
  component: Live,
  errorComponent: () => <DigestNotFound title="The front page didn't load" body="The stories behind it couldn't be read just now. Try again in a minute, or open the terminal." />,
});
function Live() {
  const { sector, page, type } = Route.useSearch();
  const { data } = useSuspenseQuery(liveQuery(resolveSector(sector), page ?? 0, type ?? "all"));
  return <LiveView d={data} />;
}
