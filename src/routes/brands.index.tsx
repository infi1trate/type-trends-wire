import { createFileRoute } from "@tanstack/react-router";
import { brandsQuery } from "@/lib/data";
import { BRANDS_FIRST_WAIT_MS, parseBrandsSearch, type BrandsSearch } from "@/lib/brands-index";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandsIndexView } from "@/components/read/BrandsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { sectorName } from "@/lib/labels";
import { resolveSector } from "@/lib/sector-lens";
import { brandsPicture, linkHeader } from "@/lib/first-paint";
import { AnnounceFirst } from "@/components/read/FirstPicture";


const TITLE = `Brands — who is doing it · ${BRAND_NAME}`;
const DESC = "Every tracked brand: identity, confirmed moves and rebrands, searchable by name and filtered by sector.";
export const Route = createFileRoute("/brands/")({
  validateSearch: (s: Record<string, unknown>): BrandsSearch & { all?: string } => Object.fromEntries((["tab", "q", "sector", "sort", "dir", "all"] as const).flatMap(k => (typeof s[k] === "string" ? [[k, (s[k] as string).slice(0, 80)]] : []))) as BrandsSearch & { all?: string },
  // P2c · the directory comes from a stored record (about a second on a fresh instance), so the first response waits for it, up to
  // BRANDS_FIRST_WAIT_MS, and carries the whole page: no placeholder to swap. Slower than that (the record too old, a live build), the
  // title goes out first and the directory streams in as before.
  loaderDeps: ({ search }) => { const v = parseBrandsSearch(search); return { tab: v.tab, sector: resolveSector(v.sector) }; },
  loader: async ({ context, deps }) => {
    const d = await Promise.race([context.queryClient.ensureQueryData(brandsQuery()).catch(() => null), new Promise<null>(r => setTimeout(() => r(null), BRANDS_FIRST_WAIT_MS))]);
    // W3d Part 5 · on a phone the "Moved this week" band's first crop is the largest picture: announced when the directory came in time.
    return { first: brandsPicture(d as Parameters<typeof brandsPicture>[0], deps) };
  },
  headers: ({ loaderData }) => { const link = linkHeader(loaderData?.first); return link ? { Link: link } : undefined; },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/brands` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/brands` }, ...fontLinks()] }),
  component: Brands,
  errorComponent: () => <DigestNotFound v="brands.failed" />,
});
function Brands() {
  const search = Route.useSearch();
  const v = parseBrandsSearch(search), { first } = Route.useLoaderData();
  return <DigestShell label="Brands" section="brands" lens>
    <AnnounceFirst p={first} />
    <Later id="brands-later" reserve="100dvh" before={<TitleBlock kicker={`Brands · ${sectorName(resolveSector(v.sector))}`} title="Who is doing it" deck={null} />} shapes={[{ kind: "block", height: 96 }, { kind: "rows", n: 12, height: ROW.compact }]}>
      <BrandsIndexView v={v} all={search.all === "1"} />
    </Later>
  </DigestShell>;
}
