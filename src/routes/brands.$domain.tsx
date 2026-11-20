import { DigestNotFound } from "@/components/digest/NotFound";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandCardQuery, brandMovesQuery, brandSectionsQuery, brandSectorQuery, brandSimilarQuery, brandStoriesQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandPageView } from "@/components/read/BrandView";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

export const Route = createFileRoute("/brands/$domain")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; section?: string | undefined } => ({ ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...(typeof s["section"] === "string" && s["section"].length <= 20 ? { section: s["section"] } : {}) }),
  // Shell first (P1): only the identity card is awaited (it also decides the 404); every section below starts here and streams in.
  loader: async ({ context, params }) => {
    const d = params.domain.toLowerCase(), q = context.queryClient;
    const b = await q.ensureQueryData(brandCardQuery(d));
    if (!b) throw notFound();
    void q.prefetchQuery(brandMovesQuery(d)); void q.prefetchQuery(brandSectionsQuery(d)); void q.prefetchQuery(brandSectorQuery(d));
    void q.prefetchQuery(brandSimilarQuery(d)); void q.prefetchQuery(brandStoriesQuery(d));
    return { name: b.name, sector: b.sectorName, soWhat: b.soWhat };
  },
  head: ({ params, loaderData }) => {
    const title = `${loaderData?.name ?? params.domain} — brand · ${BRAND_NAME}`, desc = loaderData ? `${loaderData.name} (${loaderData.sector}): identity, every confirmed move and how it sits against its sector. ${loaderData.soWhat}` : `Brand record for ${params.domain}.`;
    return { meta: withShare(shareImageFor("brand", params.domain), [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/brands/${params.domain}` }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: `${SITE_URL}/brands/${params.domain}` }, ...fontLinks()] };
  },
  component: Brand,
  notFoundComponent: () => <DigestNotFound v="brand.notFound" section="brands" kicker="Brands" />,
  errorComponent: () => <DigestNotFound v="brand.failed" section="brands" kicker="Brands" />,
});
function Brand() {
  const { domain } = Route.useParams(), { section } = Route.useSearch();
  const { data } = useSuspenseQuery(brandCardQuery(domain.toLowerCase()));
  return data ? <BrandPageView card={data} section={section ?? null} /> : null;
}
