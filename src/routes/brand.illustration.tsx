import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { BrandIllustration } from "@/components/brand/pages/BrandPages";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Gated like every page (BRAND_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `Illustration — the slug brand · ${BRAND_NAME}`;
const DESC = "The rules, the three illustration styles and their filters.";
export const Route = createFileRoute("/brand/illustration")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: BrandIllustration,
  errorComponent: () => <DigestNotFound v="brandBook.failed" />,
});
