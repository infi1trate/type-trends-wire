import { useCallback, useState } from "react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataStoryQuery, studyRelatedQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { entryOf, studyLabel, withheld } from "@/lib/data-stories/registry";
import { paramOfScene, sceneFromParam } from "@/lib/data-stories/scenes";
import { DataStoryView, StudyRelated } from "@/components/data/DataStoryView";
import { DraftView } from "@/components/data/DataIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { Later, ROW } from "@/components/read/Later";
import { BRAND_NAME } from "@/lib/brand";
import { withShare } from "@/lib/share/meta";
import { viewSearch, type ViewSearch } from "@/lib/views/search";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
import { studyDataQuery } from "@/lib/data";
import { DataShell } from "@/components/dataview/DataShell";
import { StudyData } from "@/components/dataview/Views";

export const Route = createFileRoute("/data/$slug")({
  // ?figures=all draws every scene's figure in the first response (the no-script path). ?step= is the old step number: it opens the scene
  // that holds that step (embeds and old links keep working).
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): { step?: number | undefined; figures?: "all" | undefined } & ViewSearch => { const n = typeof s["step"] === "number" ? s["step"] : typeof s["step"] === "string" ? Number.parseInt(s["step"], 10) : NaN; return { ...(Number.isFinite(n) ? { step: n } : {}), ...(s["figures"] === "all" ? { figures: "all" as const } : {}), ...viewSearch(s) }; },
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  // W3b · a study withheld by the editor answers 404 like an unknown address.
  beforeLoad: ({ params }) => { const e = entryOf(params.slug); if (!e || withheld(e)) throw notFound(); },
  // The page awaits only its stored record, as before; the related stories start now and stream into their slot.
  loader: async ({ context, params, deps }) => {
    if (deps.data) void context.queryClient.prefetchQuery(studyDataQuery(params.slug)); else void context.queryClient.prefetchQuery(studyRelatedQuery(params.slug));
    const d = await context.queryClient.ensureQueryData(dataStoryQuery(params.slug));
    // W3d-c · "being prepared" is never kept as a page copy, so the study shows as soon as its stored copy is written.
    return d.kind === "live" ? { headline: d.story.text.headline, deck: d.story.text.deck, data: deps.data } : d.kind === "preparing" ? { preparing: true as const } : null;
  },
  head: ({ params, loaderData }) => {
    if (loaderData && "data" in loaderData && loaderData.data) return dataViewHead({ type: "study", id: params.slug }, `${studyLabel(entryOf(params.slug)?.number ?? 0)}: ${loaderData.headline}`);
    const live = loaderData && "headline" in loaderData ? loaderData : null;
    const e = entryOf(params.slug), title = e ? `${studyLabel(e.number)}: ${live?.headline ?? e.question} · ${BRAND_NAME}` : `Study unavailable · ${BRAND_NAME}`, desc = live?.deck ?? e?.deck ?? "This study does not exist.";
    return { meta: withShare(`/data/${encodeURIComponent(params.slug)}.png`, [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" }]), links: fontLinks() };
  },
  headers: ({ loaderData }) => (loaderData && "preparing" in loaderData ? { "Cache-Control": "no-store" } : loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  component: DataStory,
  notFoundComponent: () => <DigestNotFound v="dataStory.notFound" />,
  errorComponent: () => <DigestNotFound v="dataStory.failed" />,
});
function DataStory() {
  const { slug } = Route.useParams(), { step, figures } = Route.useSearch(), { data } = useSuspenseQuery(dataStoryQuery(slug)), nav = useNavigate({ from: "/data/$slug" });
  const head = Route.useLoaderData();
  const [k, setK] = useState(() => (data.kind === "live" ? sceneFromParam(data.story, step) : 0));
  const onScene = useCallback((j: number) => { setK(j); if (data.kind === "live") void nav({ search: prev => ({ ...prev, step: paramOfScene(data.story, j) }), replace: true, resetScroll: false }); }, [nav, data]);
  if (data.kind === "missing") return <DigestNotFound v="dataStory.notFound" />;
  if (data.kind === "preparing") return <DigestNotFound v="dataStory.preparing" kicker={studyLabel(data.number)} />;
  if (head && "data" in head && head.data && data.kind === "live") return <DataShell object={{ type: "study", id: slug }} name={data.story.text.headline} number={data.story.number} kicker={studyLabel(data.story.number)}><StudyData slug={slug} /></DataShell>;
  if (data.kind === "draft") return <DraftView d={data} />;
  return <DataStoryView s={data.story} scene={k} onScene={onScene} allFigures={figures === "all"}
    related={<Later id="study-related-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.ledger }, { kind: "text", lines: 2 }]}><Related slug={slug} /></Later>} />;
}
function Related({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(studyRelatedQuery(slug));
  return <StudyRelated r={data} />;
}
