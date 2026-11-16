import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { BrandColour } from "@/components/brand/pages/BrandPages";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Gated like every page (BRAND_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `Colour — the slug brand · ${BRAND_NAME}`;
const DESC = "Paper and ink carry the brand; four inks do one job each. Roles, proportions, live contrast, stages and the three modes.";
export const Route = createFileRoute("/brand/colour")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: BrandColour,
  errorComponent: () => <DigestNotFound v="brandBook.failed" />,
});
