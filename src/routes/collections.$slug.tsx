import { createFileRoute, notFound } from "@tanstack/react-router";
import { collectionQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { CollectionView } from "@/components/read/CollectionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { GalleryUnavailable } from "@/components/read/Unavailable";
import { retryHeaders } from "@/lib/unavailable";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";
import { linkHeader, wallPicture } from "@/lib/first-paint";
import { AnnounceFirst } from "@/components/read/FirstPicture";

export const Route = createFileRoute("/collections/$slug")({
  validateSearch: (s: Record<string, unknown>): { page?: number | undefined } => { const p = Math.floor(Number(s["page"])); return p > 1 && p < 1000 ? { page: p } : {}; },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, params, deps }) => {
    const c = await context.queryClient.ensureQueryData(collectionQuery(params.slug, deps.page));
    if (c.kind === "missing") throw notFound();
    // W3d Part 5 · on a phone the wall's first crop is the largest picture: announced from the data the loader already waited for.
    return { title: c.title, deck: c.deck, number: c.number, first: c.kind === "live" ? wallPicture(c.gallery.tiles) : null };
  },
  head: ({ params, loaderData }) => {
    const title = loaderData ? `${loaderData.title} — collection No. ${loaderData.number} · ${BRAND_NAME}` : `Collection · ${BRAND_NAME}`, desc = loaderData?.deck ?? "A saved wall of stored homepage captures.";
    return { meta: withShare(shareImageFor("collection", params.slug), [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/collections/${params.slug}` }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: `${SITE_URL}/collections/${params.slug}` }, ...fontLinks()] };
  },
  headers: ctx => { const link = linkHeader(ctx.loaderData?.first), base = retryHeaders(ctx as never); return link ? { ...(base ?? {}), Link: link } : base; },
  component: Collection,
  errorComponent: () => <GalleryUnavailable v="collection.failed" />,
  notFoundComponent: () => <DigestNotFound v="collection.notFound" />,
});
function Collection() {
  const { slug } = Route.useParams(), { page } = Route.useSearch();
  const { first } = Route.useLoaderData();
  return <><AnnounceFirst p={first} /><CollectionView slug={slug} page={page ?? 1} /></>;
}
