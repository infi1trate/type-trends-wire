import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storyQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { StoryView } from "@/components/read/StoryView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/stories/$id")({
  loader: async ({ context, params }) => {
    if (params.id.length < 3 || params.id.length > 200) throw notFound();
    const s = await context.queryClient.ensureQueryData(storyQuery(params.id));
    if (!s) throw notFound();
    return { headline: s.headline, deck: s.deck, kicker: s.kicker, ran: s.state === "published" };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Story unavailable — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.headline} — ${BRAND_NAME}`, desc = loaderData.deck ?? `${loaderData.kicker}: a story from ${BRAND_NAME}, every number with receipts.`, url = `${SITE_URL}/stories/${encodeURIComponent(params.id)}`;
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: loaderData.headline }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }, ...(loaderData.ran ? [] : [{ name: "robots", content: "noindex" }])], links: [{ rel: "canonical", href: url }, ...fontLinks()] };
  },
  component: StoryPage,
  notFoundComponent: () => <DigestNotFound title="No such story" body="The link may be mistyped, or the story is older than the stored record." />,
  errorComponent: () => <DigestNotFound title="This story didn't load" body="The data behind it couldn't be read just now. Try again in a minute." />,
});
function StoryPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(storyQuery(id));
  return data ? <StoryView s={data} /> : null;
}
