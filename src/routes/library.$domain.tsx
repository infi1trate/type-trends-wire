import { createFileRoute, redirect } from "@tanstack/react-router";
import { BRAND_NAME } from "@/lib/brand";
import { dataHref } from "@/lib/ia";
// U1 · one address per brand: the dense record moved to the brand's own address, in its Data view. Permanent redirect, every other
// parameter kept (viewport, page type, the compared captures, the sector lens).
export const Route = createFileRoute("/library/$domain")({
  beforeLoad: ({ params, location }) => {
    throw redirect({ href: dataHref({ type: "brand", id: params.domain.toLowerCase() }, location.search as Record<string, unknown>), statusCode: 301 });
  },
  head: () => ({ meta: [{ title: `Moved — ${BRAND_NAME}` }, { name: "description", content: "This brand record moved to the brand's page, in its Data view." }, { property: "og:title", content: `Moved — ${BRAND_NAME}` }, { property: "og:description", content: "This brand record moved to the brand's page, in its Data view." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => null,
});
