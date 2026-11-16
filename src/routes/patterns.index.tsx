import { createFileRoute } from "@tanstack/react-router";
import { galleryQuery } from "@/lib/data";
import { gallerySearch, parseGallerySearch, type GallerySearch } from "@/lib/gallery";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { GalleryView } from "@/components/read/GalleryView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Patterns — the gallery · ${BRAND_NAME}`;
const DESC = "A wall of stored homepage captures showing each headline layout pattern, filterable by sector, pattern, period and how it was read.";
export const Route = createFileRoute("/patterns/")({
  validateSearch: (s: Record<string, unknown>): GallerySearch => gallerySearch(parseGallerySearch(s)),
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(galleryQuery(deps.search)).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/patterns` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/patterns` }, ...fontLinks()] }),
  component: Patterns,
  errorComponent: () => <DigestNotFound title="The gallery didn't load" body="The stored captures couldn't be read just now. Try again in a minute." />,
  notFoundComponent: () => <DigestNotFound title="No such view" body="That gallery view doesn't exist. Start from all patterns." />,
});
function Patterns() {
  return <GalleryView search={Route.useSearch()} />;
}
