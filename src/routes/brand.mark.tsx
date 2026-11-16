import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { BrandMark } from "@/components/brand/pages/BrandPages";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Gated like every page (BRAND_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `The mark — the slug brand · ${BRAND_NAME}`;
const DESC = "The drawn slug mark: construction, clear space, the three cuts, the s, tiles and app icon, grounds and what not to do.";
export const Route = createFileRoute("/brand/mark")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: BrandMark,
  errorComponent: () => <DigestNotFound title="This page didn't load" body="The brand page couldn't be built just now. Try again in a minute." />,
});
