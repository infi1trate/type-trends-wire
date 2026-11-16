import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandView } from "@/components/read/BrandView";
import { DigestShell } from "@/components/digest/Editorial";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

const Missing = ({ title, body }: { title: string; body: string }) => <DigestShell label="Brand not found" section="brands"><section className="ed-wrap py-20"><p className="ed-kicker">Brands</p><h1 className="ed-cover mt-3">{title}</h1><p className="ed-standfirst mt-5">{body}</p><p className="ed-data mt-8 flex flex-wrap gap-x-6"><Link to="/brands" className="ed-tap">Every tracked brand →</Link><Link to="/audit/new" search={{ sites: undefined }} className="ed-tap">Audit any site</Link></p></section></DigestShell>;
export const Route = createFileRoute("/brands/$domain")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; section?: string | undefined } => ({ ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...(typeof s["section"] === "string" && s["section"].length <= 20 ? { section: s["section"] } : {}) }),
  loader: async ({ context, params }) => { const b = await context.queryClient.ensureQueryData(brandQuery(params.domain.toLowerCase())); if (!b) throw notFound(); return { name: b.name, sector: b.sectorName, soWhat: b.soWhat }; },
  head: ({ params, loaderData }) => {
    const title = `${loaderData?.name ?? params.domain} — brand · ${BRAND_NAME}`, desc = loaderData ? `${loaderData.name} (${loaderData.sector}): identity, every confirmed move and how it sits against its sector. ${loaderData.soWhat}` : `Brand record for ${params.domain}.`;
    return { meta: withShare(shareImageFor("brand", params.domain), [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/brands/${params.domain}` }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: `${SITE_URL}/brands/${params.domain}` }, ...fontLinks()] };
  },
  component: Brand,
  notFoundComponent: () => <Missing title="We don't track this brand" body="Only brands in the library get a brand page. You can still audit any public site against tracked ones." />,
  errorComponent: () => <Missing title="This brand page didn't load" body="The data behind it couldn't be read just now. Try again in a minute." />,
});
function Brand() {
  const { domain } = Route.useParams(), { section } = Route.useSearch();
  const { data } = useSuspenseQuery(brandQuery(domain.toLowerCase()));
  return data ? <BrandView b={data} section={section ?? null} /> : null;
}
