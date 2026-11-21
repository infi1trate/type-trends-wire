import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storyHeadQuery, storyLeadQuery, storyRelatedQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { StoryFrame, StoryView, StoryRelated, RetiredStoryView, type StoryPageData } from "@/components/read/StoryView";
import { Later, ROW } from "@/components/read/Later";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";
import { viewSearch, type ViewSearch } from "@/lib/views/search";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
import { storyDataQuery } from "@/lib/data";
import { DataShell } from "@/components/dataview/DataShell";
import { StoryData } from "@/components/dataview/Views";

export const Route = createFileRoute("/stories/$id")({
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): ViewSearch => viewSearch(s),
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  loader: async ({ context, params, deps }) => {
    if (params.id.length < 3 || params.id.length > 200) throw notFound();
    // E3b: only the story's head (its own row by id: headline, deck, whether it ran) is awaited, because the answer's status, title and
    // do-not-index header must be known before the first byte. The body with its pictures and evidence, and earlier stories, start
    // now and stream into their slots.
    // U1: the Data view awaits the same head (it names the story exactly as the Read view does); its tables stream in after the frame.
    if (deps.data) void context.queryClient.prefetchQuery(storyDataQuery(params.id));
    else { void context.queryClient.prefetchQuery(storyLeadQuery(params.id)); void context.queryClient.prefetchQuery(storyRelatedQuery(params.id)); }
    const s = await context.queryClient.ensureQueryData(storyHeadQuery(params.id));
    if (!s) throw notFound();
    return { ...s, data: deps.data };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Story unavailable — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] };
    if (loaderData.data) return dataViewHead({ type: "story", id: params.id }, loaderData.headline);
    const title = `${loaderData.headline} — ${BRAND_NAME}`, desc = loaderData.deck ?? `${loaderData.kicker}: a story from ${BRAND_NAME}, every number with receipts.`, url = `${SITE_URL}/stories/${encodeURIComponent(params.id)}`;
    return { meta: withShare(shareImageFor("story", params.id), [{ title }, { name: "description", content: desc }, { property: "og:title", content: loaderData.headline }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }, ...(loaderData.ran ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: url }, ...fontLinks()] };
  },
  // A story that did not run (held) or was retired is sent with a do-not-index header as well as the robots meta.
  headers: ({ loaderData }) => (loaderData && (loaderData.data || !loaderData.ran) ? DATA_VIEW_HEADERS : undefined),
  component: StoryPage,
  notFoundComponent: () => <DigestNotFound v="story.notFound" />,
  errorComponent: () => <DigestNotFound v="story.failed" />,
});
function StoryPage() {
  const { id } = Route.useParams(), head = Route.useLoaderData();
  if (head.data) return <DataShell object={{ type: "story", id }} name={head.headline} number={head.number ?? null}><StoryData id={id} /></DataShell>;
  return <StoryFrame id={id} headline={head.headline}>
    <Later id="story-lead-later" shapes={[{ kind: "block", height: 28 }, { kind: "text", lines: 3 }, { kind: "text", lines: 2 }, { kind: "picture", ratio: 1280 / 800, maxWidth: 1064 }, { kind: "rows", n: 4, height: ROW.ledger }]}><Lead id={id} /></Later>
  </StoryFrame>;
}
function Lead({ id }: { id: string }) {
  const { data } = useSuspenseQuery(storyLeadQuery(id));
  if (!data) return <DigestNotFound v="story.notFound" bare />;
  if (data.retired) return <RetiredStoryView s={data} tape={data.retired.tape} note={data.retired.note} bare />;
  return <div data-receipts="" className="contents"><StoryView s={data} bare related={<Later id="story-related-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.ledger }]}><Related s={data} /></Later>} /></div>;
}
function Related({ s }: { s: StoryPageData }) {
  const { data } = useSuspenseQuery(storyRelatedQuery(s.id));
  return <StoryRelated s={{ ...s, ...data }} />;
}
