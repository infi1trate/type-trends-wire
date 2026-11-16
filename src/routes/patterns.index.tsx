import { createFileRoute } from "@tanstack/react-router";
import { galleryQuery } from "@/lib/data";
import { gallerySearch, parseGallerySearch, type GallerySearch } from "@/lib/gallery";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { GalleryView } from "@/components/read/GalleryView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { GalleryUnavailable } from "@/components/read/Unavailable";
import { retryHeaders } from "@/lib/unavailable";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Patterns — the gallery · ${BRAND_NAME}`;
const DESC = "A wall of stored homepage captures showing each headline layout pattern, filterable by sector, pattern, period and how it was read.";
export const Route = createFileRoute("/patterns/")({
  validateSearch: (s: Record<string, unknown>): GallerySearch => gallerySearch(parseGallerySearch(s)),
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(galleryQuery(deps.search)).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/patterns` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/patterns` }, ...fontLinks()] }),
  headers: retryHeaders,
  component: Patterns,
  errorComponent: () => <GalleryUnavailable v="patterns.failed" />,
  notFoundComponent: () => <DigestNotFound v="patterns.notFound" />,
});
function Patterns() {
  return <GalleryView search={Route.useSearch()} />;
}
