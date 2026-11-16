import { createFileRoute } from "@tanstack/react-router";
import { brandsQuery } from "@/lib/data";
import { resolveSector } from "@/lib/sector-lens";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandsIndexView } from "@/components/read/BrandsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";

const TITLE = "Brands — who is doing it · DSGN/TERMINAL";
const DESC = "Every tracked brand: identity, confirmed moves and rebrands, searchable by name and filtered by sector.";
export const Route = createFileRoute("/brands/")({
  validateSearch: (s: Record<string, unknown>): { tab?: string | undefined; sector?: string | undefined; sort?: string | undefined } => ({
    ...(typeof s["tab"] === "string" ? { tab: s["tab"] } : {}), ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...(typeof s["sort"] === "string" ? { sort: s["sort"] } : {}),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(brandsQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/brands` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/brands` }, ...fontLinks()] }),
  component: Brands,
  errorComponent: () => <DigestNotFound title="Brands didn't load" body="The library couldn't be read just now. Try again in a minute." />,
});
function Brands() {
  const { tab, sector, sort } = Route.useSearch();
  return <BrandsIndexView tab={tab === "moves" ? "moves" : "directory"} sector={resolveSector(sector)} sort={sort === "name" ? "name" : "recent"} />;
}
