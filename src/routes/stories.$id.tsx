import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storyLeadQuery, storyRelatedQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { StoryView, StoryRelated, RetiredStoryView, type StoryPageData } from "@/components/read/StoryView";
import { Later, ROW } from "@/components/read/Later";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

export const Route = createFileRoute("/stories/$id")({
  loader: async ({ context, params }) => {
    if (params.id.length < 3 || params.id.length > 200) throw notFound();
    // P1: the story and its cover evidence are awaited; earlier stories (the story index) start now and stream in.
    void context.queryClient.prefetchQuery(storyRelatedQuery(params.id));
    const s = await context.queryClient.ensureQueryData(storyLeadQuery(params.id));
    if (!s) throw notFound();
    return { headline: s.headline, deck: s.deck, kicker: s.kicker, ran: s.state === "published" };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Story unavailable — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.headline} — ${BRAND_NAME}`, desc = loaderData.deck ?? `${loaderData.kicker}: a story from ${BRAND_NAME}, every number with receipts.`, url = `${SITE_URL}/stories/${encodeURIComponent(params.id)}`;
    return { meta: withShare(shareImageFor("story", params.id), [{ title }, { name: "description", content: desc }, { property: "og:title", content: loaderData.headline }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }, ...(loaderData.ran ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: url }, ...fontLinks()] };
  },
  // A story that did not run (held) or was retired is sent with a do-not-index header as well as the robots meta.
  headers: ({ loaderData }) => (loaderData && !loaderData.ran ? { "X-Robots-Tag": "noindex" } : undefined),
  component: StoryPage,
  notFoundComponent: () => <DigestNotFound v="story.notFound" />,
  errorComponent: () => <DigestNotFound v="story.failed" />,
});
function StoryPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(storyLeadQuery(id));
  if (data?.retired) return <RetiredStoryView s={data} tape={data.retired.tape} note={data.retired.note} />;
  return data ? <div data-receipts="" className="contents"><StoryView s={data} related={<Later id="story-related-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.ledger }]}><Related s={data} /></Later>} /></div> : null;
}
function Related({ s }: { s: StoryPageData }) {
  const { data } = useSuspenseQuery(storyRelatedQuery(s.id));
  return <StoryRelated s={{ ...s, ...data }} />;
}
