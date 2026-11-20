import { useCallback, useState } from "react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataStoryQuery, studyRelatedQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { entryOf, studyLabel } from "@/lib/data-stories/registry";
import { paramOfScene, sceneFromParam } from "@/lib/data-stories/scenes";
import { DataStoryView, StudyRelated } from "@/components/data/DataStoryView";
import { DraftView } from "@/components/data/DataIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { Later, ROW } from "@/components/read/Later";
import { BRAND_NAME } from "@/lib/brand";
import { withShare } from "@/lib/share/meta";

export const Route = createFileRoute("/data/$slug")({
  // ?figures=all draws every scene's figure in the first response (the no-script path). ?step= is the old step number: it opens the scene
  // that holds that step (embeds and old links keep working).
  validateSearch: (s: Record<string, unknown>): { step?: number | undefined; figures?: "all" | undefined } => { const n = typeof s["step"] === "number" ? s["step"] : typeof s["step"] === "string" ? Number.parseInt(s["step"], 10) : NaN; return { ...(Number.isFinite(n) ? { step: n } : {}), ...(s["figures"] === "all" ? { figures: "all" as const } : {}) }; },
  beforeLoad: ({ params }) => { if (!entryOf(params.slug)) throw notFound(); },
  // The page awaits only its stored record, as before; the related stories start now and stream into their slot.
  loader: async ({ context, params }) => {
    void context.queryClient.prefetchQuery(studyRelatedQuery(params.slug));
    const d = await context.queryClient.ensureQueryData(dataStoryQuery(params.slug));
    return d.kind === "live" ? { headline: d.story.text.headline, deck: d.story.text.deck } : null;
  },
  head: ({ params, loaderData }) => {
    const e = entryOf(params.slug), title = e ? `${studyLabel(e.number)}: ${loaderData?.headline ?? e.question} · ${BRAND_NAME}` : `Study unavailable · ${BRAND_NAME}`, desc = loaderData?.deck ?? e?.deck ?? "This study does not exist.";
    return { meta: withShare(`/data/${encodeURIComponent(params.slug)}.png`, [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" }]), links: fontLinks() };
  },
  component: DataStory,
  notFoundComponent: () => <DigestNotFound v="dataStory.notFound" />,
  errorComponent: () => <DigestNotFound v="dataStory.failed" />,
});
function DataStory() {
  const { slug } = Route.useParams(), { step, figures } = Route.useSearch(), { data } = useSuspenseQuery(dataStoryQuery(slug)), nav = useNavigate({ from: "/data/$slug" });
  const [k, setK] = useState(() => (data.kind === "live" ? sceneFromParam(data.story, step) : 0));
  const onScene = useCallback((j: number) => { setK(j); if (data.kind === "live") void nav({ search: prev => ({ ...prev, step: paramOfScene(data.story, j) }), replace: true, resetScroll: false }); }, [nav, data]);
  if (data.kind === "missing") return <DigestNotFound v="dataStory.notFound" />;
  if (data.kind === "draft") return <DraftView d={data} />;
  return <DataStoryView s={data.story} scene={k} onScene={onScene} allFigures={figures === "all"}
    related={<Later id="study-related-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.ledger }, { kind: "text", lines: 2 }]}><Related slug={slug} /></Later>} />;
}
function Related({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(studyRelatedQuery(slug));
  return <StudyRelated r={data} />;
}
