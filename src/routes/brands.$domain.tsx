import { DigestNotFound } from "@/components/digest/NotFound";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandView } from "@/components/read/BrandView";
import { DigestShell } from "@/components/digest/Editorial";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

export const Route = createFileRoute("/brands/$domain")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; section?: string | undefined } => ({ ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...(typeof s["section"] === "string" && s["section"].length <= 20 ? { section: s["section"] } : {}) }),
  loader: async ({ context, params }) => { const b = await context.queryClient.ensureQueryData(brandQuery(params.domain.toLowerCase())); if (!b) throw notFound(); return { name: b.name, sector: b.sectorName, soWhat: b.soWhat }; },
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
  const { data } = useSuspenseQuery(brandQuery(domain.toLowerCase()));
  return data ? <BrandView b={data} section={section ?? null} /> : null;
}
