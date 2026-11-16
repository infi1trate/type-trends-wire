import { createFileRoute, notFound } from "@tanstack/react-router";
import { collectionQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { CollectionView } from "@/components/read/CollectionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { GalleryUnavailable } from "@/components/read/Unavailable";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/collections/$slug")({
  validateSearch: (s: Record<string, unknown>): { page?: number | undefined } => { const p = Math.floor(Number(s["page"])); return p > 1 && p < 1000 ? { page: p } : {}; },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, params, deps }) => {
    const c = await context.queryClient.ensureQueryData(collectionQuery(params.slug, deps.page));
    if (c.kind === "missing") throw notFound();
    return { title: c.title, deck: c.deck, number: c.number };
  },
  head: ({ params, loaderData }) => {
    const title = loaderData ? `${loaderData.title} — collection No. ${loaderData.number} · ${BRAND_NAME}` : `Collection · ${BRAND_NAME}`, desc = loaderData?.deck ?? "A saved wall of stored homepage captures.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/collections/${params.slug}` }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])], links: [{ rel: "canonical", href: `${SITE_URL}/collections/${params.slug}` }, ...fontLinks()] };
  },
  component: Collection,
  errorComponent: () => <GalleryUnavailable title="This collection didn't load" />,
  notFoundComponent: () => <DigestNotFound title="No such collection" body="There's no collection at this address. Every collection is listed on /collections." />,
});
function Collection() {
  const { slug } = Route.useParams(), { page } = Route.useSearch();
  return <CollectionView slug={slug} page={page ?? 1} />;
}
