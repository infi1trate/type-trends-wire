import { createFileRoute } from "@tanstack/react-router";
import { kitQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { BrandType } from "@/components/brand/pages/BrandPages";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Gated like every page (BRAND_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `Type — the slug brand · ${BRAND_NAME}`;
const DESC = "Big Shoulders and Newsreader, with IBM Plex Mono as the utility face: the role ladder set in real story copy.";
export const Route = createFileRoute("/brand/type")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kitQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: BrandType,
  errorComponent: () => <DigestNotFound v="brandBook.failed" />,
});
