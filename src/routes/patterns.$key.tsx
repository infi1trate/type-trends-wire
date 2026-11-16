import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { patternQuery } from "@/lib/data";
import { resolveSector } from "@/lib/sector-lens";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { PatternView } from "@/components/read/PatternViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/patterns/$key")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined } => (typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
  loaderDeps: ({ search }) => ({ sector: resolveSector(search.sector) }),
  loader: async ({ context, params, deps }) => { const p = await context.queryClient.ensureQueryData(patternQuery(params.key, deps.sector)); if (!p) throw notFound(); return { name: p.name, total: p.total }; },
  head: ({ params, loaderData }) => {
    const title = `${loaderData?.name ?? "Pattern"} — pattern · ${BRAND_NAME}`, desc = loaderData ? `${loaderData.total} tracked brands showing ${loaderData.name}, by sector and capture date.` : "Pattern not found.";
    const url = `${SITE_URL}/patterns/${encodeURIComponent(params.key)}`;
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])], links: [{ rel: "canonical", href: url }, ...fontLinks()] };
  },
  component: Pattern,
  notFoundComponent: () => <DigestNotFound title="Not a pattern right now" body="Patterns are headline layout or composite signals with at least three example brands. This one isn't, or the key is misspelled." />,
  errorComponent: () => <DigestNotFound title="This pattern didn't load" body="The examples couldn't be read just now. Try again in a minute." />,
});
function Pattern() {
  const { key } = Route.useParams(), { sector } = Route.useSearch();
  const { data } = useSuspenseQuery(patternQuery(key, resolveSector(sector)));
  return data ? <PatternView p={data} /> : null;
}
