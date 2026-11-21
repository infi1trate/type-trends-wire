import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { BrandSystem } from "@/components/brand/pages/SystemPage";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Gated like every brand page (BRAND_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `The system — the slug brand · ${BRAND_NAME}`;
const DESC = "Every design value by name with its Read and Data value, every chart in both looks, and the key map.";
export const Route = createFileRoute("/brand/system")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: BrandSystem,
  errorComponent: () => <DigestNotFound v="brandBook.failed" />,
});
