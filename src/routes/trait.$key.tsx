import { createFileRoute, redirect } from "@tanstack/react-router";
import { BRAND_NAME } from "@/lib/brand";
// Old trait explainer URLs: the signal page moved to /signals/<key>. Permanent redirect, search kept (share images stay at /trait/<key>.png).
export const Route = createFileRoute("/trait/$key")({
  beforeLoad: ({ params, location }) => {
    const raw = location.search as Record<string, unknown>;
    throw redirect({ to: "/signals/$key", params: { key: params.key }, search: { sector: typeof raw["sector"] === "string" ? raw["sector"] : undefined }, statusCode: 301 });
  },
  head: () => ({ meta: [{ title: `Moved — ${BRAND_NAME}` }, { name: "description", content: "This signal page moved to /signals." }, { property: "og:title", content: `Moved — ${BRAND_NAME}` }, { property: "og:description", content: "This signal page moved to /signals." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => null,
});
