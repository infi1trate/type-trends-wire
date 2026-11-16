import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { watchViewQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { WatchPage } from "@/components/agency/WatchPage";
import { AgencyShell } from "@/components/agency/Shell";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (s: Record<string, unknown>): { k?: string | undefined; range: "week" | "30d" } => ({ k: typeof s["k"] === "string" ? s["k"].slice(0, 40) : undefined, range: s["range"] === "30d" ? "30d" : "week" }),
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: async ({ context, params, deps }) => {
    const v = await context.queryClient.ensureQueryData(watchViewQuery(params.id, deps.range));
    if (!v) throw notFound();
    return { name: v.name, n: v.sites.length + v.pending.length };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} — watchlist — ${BRAND_NAME}` : `Watchlist — ${BRAND_NAME}` }, { name: "description", content: loaderData ? `Design changes on the ${loaderData.n} sites in “${loaderData.name}”.` : `A ${BRAND_NAME} watchlist.` },
      { property: "og:title", content: loaderData ? `${loaderData.name} — watchlist` : "Watchlist" }, { property: "og:description", content: `Confirmed design changes on a competitive set, from ${BRAND_NAME}.` },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }, { name: "referrer", content: "no-referrer" }],
    links: fontLinks(),
  }),
  component: Page,
  notFoundComponent: Missing,
  errorComponent: () => <AgencyShell label="Watchlist unavailable" crumb="Watchlist"><div className="ed-wrap py-16"><h1 className="ed-h1">This watchlist didn't load</h1><p className="ed-body mt-4">The data behind it couldn't be read just now. Try again in a minute.</p></div></AgencyShell>,
});
function Missing() {
  return <AgencyShell label="Watchlist not found" crumb="Watchlist"><div className="ed-wrap py-16"><h1 className="ed-h1">No watchlist here</h1><p className="ed-body mt-4">The link may be mistyped, or the list was deleted.</p><p className="ed-data mt-6"><Link to="/watch/new" search={{ add: undefined, name: undefined }}>Make a new watchlist →</Link></p></div></AgencyShell>;
}
function Page() {
  const { id } = Route.useParams(), { k, range } = Route.useSearch();
  const { data } = useSuspenseQuery(watchViewQuery(id, range));
  if (!data) return <Missing />;
  return <WatchPage v={data} k={k} />;
}
