import { DigestNotFound } from "@/components/digest/NotFound";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandCardQuery, brandMovesQuery, brandSectionsQuery, brandSurfacesQuery, brandSectorQuery, brandSimilarQuery, brandStoriesQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BrandFrame, BrandPageView, BrandPageWithoutCard } from "@/components/read/BrandView";
import { BRAND_CARD_FIRST_MS, firstWithin } from "@/lib/first-within";
import { Later, ROW } from "@/components/read/Later";
import { seededName } from "@/lib/brand-names";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";
import { viewSearch, brandDataSearch, type ViewSearch, type BrandDataSearch } from "@/lib/views/search";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
import { librarySiteQuery, siteCropsQuery, siteThumbQuery } from "@/lib/data";
import { DataShell } from "@/components/dataview/DataShell";
import { BrandData } from "@/components/dataview/Views";

export const Route = createFileRoute("/brands/$domain")({
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined; section?: string | undefined } & ViewSearch & BrandDataSearch => ({ ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...(typeof s["section"] === "string" && s["section"].length <= 20 ? { section: s["section"] } : {}), ...viewSearch(s), ...(s["view"] === "data" ? brandDataSearch(s) : {}) }),
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  // E3b · shell first with no read in front of the first byte: a seeded brand's name gives the head and the frame, and every part of
  // the page (the identity card first) starts here and streams into its slot. A domain outside the seed is not a tracked brand unless
  // the library says so: only then is the card awaited, to answer 404.
  loader: async ({ context, params, deps }) => {
    const d = params.domain.toLowerCase(), q = context.queryClient, name = seededName(d);
    // U1: the Data view (the old /library record) has the same frame-first head; the record streams in after it.
    if (deps.data) {
      if (!name) { const b = await q.ensureQueryData(brandCardQuery(d)); if (!b) throw notFound(); } else void q.prefetchQuery(brandCardQuery(d));
      void q.prefetchQuery(librarySiteQuery(d)); void q.prefetchQuery(siteCropsQuery(d)); void q.prefetchQuery(siteThumbQuery(d)); void q.prefetchQuery(brandSurfacesQuery(d));
      return { name: name ?? q.getQueryData(brandCardQuery(d).queryKey)?.name ?? d, data: true };
    }
    // C1 · every part starts first; then a seeded brand's card (one stored row, the site row and its pictures) is waited for up to
    // BRAND_CARD_FIRST_MS, so it is in the first HTML with the header facts instead of arriving late; past that it streams as before.
    void q.prefetchQuery(brandMovesQuery(d)); void q.prefetchQuery(brandSectionsQuery(d)); void q.prefetchQuery(brandSurfacesQuery(d)); void q.prefetchQuery(brandSectorQuery(d));
    void q.prefetchQuery(brandSimilarQuery(d)); void q.prefetchQuery(brandStoriesQuery(d));
    if (!name) {
      const b = await q.ensureQueryData(brandCardQuery(d));
      if (!b) throw notFound();
    } else await firstWithin(q.prefetchQuery(brandCardQuery(d)), BRAND_CARD_FIRST_MS);
    return { name: name ?? q.getQueryData(brandCardQuery(d).queryKey)?.name ?? d, data: false };
  },
  head: ({ params, loaderData }) => {
    if (loaderData?.data) return dataViewHead({ type: "brand", id: params.domain }, loaderData.name);
    const title = `${loaderData?.name ?? params.domain} — brand · ${BRAND_NAME}`, desc = loaderData ? `${loaderData.name}: identity, every confirmed move and how it sits against its sector, on ${BRAND_NAME}.` : `Brand record for ${params.domain}.`;
    return { meta: withShare(shareImageFor("brand", params.domain), [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/brands/${params.domain}` }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: `${SITE_URL}/brands/${params.domain}` }, ...fontLinks()] };
  },
  headers: ({ loaderData }) => (loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  component: Brand,
  notFoundComponent: () => <DigestNotFound v="brand.notFound" section="brands" kicker="Brands" />,
  errorComponent: () => <DigestNotFound v="brand.failed" section="brands" kicker="Brands" />,
});
function Brand() {
  const { domain } = Route.useParams(), { name, data } = Route.useLoaderData(), d = domain.toLowerCase();
  if (data) return <DataShell object={{ type: "brand", id: d }} name={name}><BrandData domain={d} /></DataShell>;
  return <BrandFrame name={name} domain={d}>
    {/* C1 · a card that fails twice leaves one line in its place and the parts that don't need it (never just the frame). */}
    <Later id="brand-card-later" reserve="100dvh" shapes={[{ kind: "block", height: 40 }, { kind: "block", height: 96 }, { kind: "rows", n: 3, height: ROW.compact }, { kind: "block", height: 260 }]}
      failedAs={line => <BrandPageWithoutCard domain={d} name={name} line={line} />}><CardLater domain={d} /></Later>
  </BrandFrame>;
}
function CardLater({ domain }: { domain: string }) {
  const { section } = Route.useSearch();
  const { data } = useSuspenseQuery(brandCardQuery(domain));
  // A seeded brand the library no longer tracks (opted out): the page says so in place.
  return data ? <BrandPageView card={data} section={section ?? null} bare /> : <DigestNotFound v="brand.notFound" section="brands" kicker="Brands" bare />;
}
