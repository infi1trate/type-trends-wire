import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getStoryByNumber } from "@/lib/read.functions";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// /stories/no/<n>: a story's permanent number redirects to its permanent URL. A retired story keeps its number and its page (E2d).
export const Route = createFileRoute("/stories/no/$number")({
  loader: async ({ params }) => {
    const n = Number(params.number);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) throw notFound();
    const id = await getStoryByNumber({ data: { number: n } });
    if (!id) throw notFound();
    throw redirect({ to: "/stories/$id", params: { id }, statusCode: 301 });
  },
  head: () => ({ meta: [{ title: `Story number · ${BRAND_NAME}` }, { name: "description", content: "A story's permanent number, redirecting to the story." }, { property: "og:title", content: `Story number · ${BRAND_NAME}` }, { property: "og:description", content: "A story's permanent number, redirecting to the story." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => null,
  notFoundComponent: () => <DigestNotFound v="storyNo.notFound" />,
  errorComponent: () => <DigestNotFound v="storyNo.failed" />,
});
