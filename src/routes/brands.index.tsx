import { createFileRoute } from "@tanstack/react-router";
import { brandsQuery } from "@/lib/data";
import { parseBrandsSearch, type BrandsSearch } from "@/lib/brands-index";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandsIndexView } from "@/components/read/BrandsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Brands — who is doing it · ${BRAND_NAME}`;
const DESC = "Every tracked brand: identity, confirmed moves and rebrands, searchable by name and filtered by sector.";
export const Route = createFileRoute("/brands/")({
  validateSearch: (s: Record<string, unknown>): BrandsSearch => Object.fromEntries((["tab", "q", "sector", "sort", "dir"] as const).flatMap(k => (typeof s[k] === "string" ? [[k, (s[k] as string).slice(0, 80)]] : []))) as BrandsSearch,
  loader: ({ context }) => context.queryClient.ensureQueryData(brandsQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/brands` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/brands` }, ...fontLinks()] }),
  component: Brands,
  errorComponent: () => <DigestNotFound title="Brands didn't load" body="The library couldn't be read just now. Try again in a minute." />,
});
function Brands() {
  return <BrandsIndexView v={parseBrandsSearch(Route.useSearch())} />;
}
