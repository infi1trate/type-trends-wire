import { createFileRoute } from "@tanstack/react-router";
import { kitFilesQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { BrandDownloads } from "@/components/brand/pages/BrandPages";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Gated like every page (BRAND_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `Downloads — the slug brand · ${BRAND_NAME}`;
const DESC = "The brand kit files: outlined logo SVG and PNG, tokens, motion CSS, filters and the guidelines.";
export const Route = createFileRoute("/brand/downloads")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kitFilesQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: BrandDownloads,
  errorComponent: () => <DigestNotFound v="brandBook.failed" />,
});
