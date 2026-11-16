import { useCallback, useState } from "react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataStoryQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { entryOf } from "@/lib/data-stories/registry";
import { parseStep, stepParam } from "@/lib/data-stories/stepper";
import { DataStoryView } from "@/components/data/DataStoryView";
import { DraftView } from "@/components/data/DataIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/data/$slug")({
  validateSearch: (s: Record<string, unknown>): { step?: number | undefined } => { const n = typeof s["step"] === "number" ? s["step"] : typeof s["step"] === "string" ? Number.parseInt(s["step"], 10) : NaN; return Number.isFinite(n) ? { step: n } : {}; },
  beforeLoad: ({ params }) => { if (!entryOf(params.slug)) throw notFound(); },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(dataStoryQuery(params.slug)).then(() => undefined),
  head: ({ params }) => {
    const e = entryOf(params.slug), title = e ? `Data story ${e.number}: ${e.question} · ${BRAND_NAME}` : `Data story unavailable · ${BRAND_NAME}`, desc = e?.deck ?? "This data story does not exist.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" }], links: fontLinks() };
  },
  component: DataStory,
  notFoundComponent: () => <DigestNotFound title="No such data story" body="That data story doesn't exist. The list of data stories is at /data." />,
  errorComponent: () => <DigestNotFound title="This data story didn't load" body="The stored data behind it couldn't be read just now. Try again in a minute." />,
});
function DataStory() {
  const { slug } = Route.useParams(), { step } = Route.useSearch(), { data } = useSuspenseQuery(dataStoryQuery(slug)), nav = useNavigate({ from: "/data/$slug" });
  const n = data.kind === "live" ? data.story.steps.length : 0, [k, setK] = useState(() => parseStep(step, n));
  const onStep = useCallback((j: number) => { setK(j); void nav({ search: { step: stepParam(j) }, replace: true, resetScroll: false }); }, [nav]);
  if (data.kind === "missing") return <DigestNotFound title="No such data story" body="That data story doesn't exist." />;
  if (data.kind === "draft") return <DraftView d={data} />;
  return <DataStoryView s={data.story} step={k} onStep={onStep} />;
}
