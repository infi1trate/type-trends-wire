import { createFileRoute } from "@tanstack/react-router";
import { brandsQuery } from "@/lib/data";
import { parseBrandsSearch, type BrandsSearch } from "@/lib/brands-index";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandsIndexView } from "@/components/read/BrandsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { sectorName } from "@/lib/labels";
import { resolveSector } from "@/lib/sector-lens";


const TITLE = `Brands — who is doing it · ${BRAND_NAME}`;
const DESC = "Every tracked brand: identity, confirmed moves and rebrands, searchable by name and filtered by sector.";
export const Route = createFileRoute("/brands/")({
  validateSearch: (s: Record<string, unknown>): BrandsSearch & { all?: string } => Object.fromEntries((["tab", "q", "sector", "sort", "dir", "all"] as const).flatMap(k => (typeof s[k] === "string" ? [[k, (s[k] as string).slice(0, 80)]] : []))) as BrandsSearch & { all?: string },
  // P1 · shell first: the title draws at once; the directory (a precomputed record) streams in.
  loader: ({ context }) => { void context.queryClient.prefetchQuery(brandsQuery()); },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/brands` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/brands` }, ...fontLinks()] }),
  component: Brands,
  errorComponent: () => <DigestNotFound v="brands.failed" />,
});
function Brands() {
  const search = Route.useSearch();
  const v = parseBrandsSearch(search);
  return <DigestShell label="Brands" section="brands" lens>
    <Later id="brands-later" before={<TitleBlock kicker={`Brands · ${sectorName(resolveSector(v.sector))}`} title="Who is doing it" deck={null} />} shapes={[{ kind: "block", height: 96 }, { kind: "rows", n: 12, height: ROW.compact }]}>
      <BrandsIndexView v={v} all={search.all === "1"} />
    </Later>
  </DigestShell>;
}
