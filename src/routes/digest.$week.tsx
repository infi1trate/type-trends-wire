import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { issueQuery } from "@/lib/data";
import { issueHead } from "@/lib/digest/meta";
import { isIssueWeek } from "@/lib/digest/week";
import { EditionView } from "@/components/digest/EditionView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { DIGEST_NAME, DIGEST_FIRST_WEEK } from "@/lib/site";
import { viewSearch, type ViewSearch } from "@/lib/views/search";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
import { weekDataQuery } from "@/lib/data";
import { DataShell } from "@/components/dataview/DataShell";
import { WeekData } from "@/components/dataview/Views";

export const Route = createFileRoute("/digest/$week")({
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): ViewSearch => viewSearch(s),
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  loader: async ({ context, params, deps }) => {
    if (!isIssueWeek(params.week)) throw notFound();
    if (deps.data) void context.queryClient.prefetchQuery(weekDataQuery(params.week));
    const issue = await context.queryClient.ensureQueryData(issueQuery(params.week));
    if (!issue) throw notFound();
    return { issue, data: deps.data };
  },
  head: ({ params, loaderData }) => loaderData?.issue && loaderData.data ? dataViewHead({ type: "week", id: params.week }, `${DIGEST_NAME} No. ${loaderData.issue.number}: ${loaderData.issue.text.headline}`) : loaderData?.issue ? issueHead(loaderData.issue, `/digest/${params.week}`)
    : { meta: [{ title: `Issue not found — ${DIGEST_NAME}` }, { name: "robots", content: "noindex" }] },
  headers: ({ loaderData }) => (loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  component: Week,
  notFoundComponent: () => { const { week } = Route.useParams(); return <DigestNotFound v="digest.notFound" vars={{ digest: DIGEST_NAME, week, first: DIGEST_FIRST_WEEK }} />; },
  errorComponent: () => <DigestNotFound v="digest.failed" />,
});
function Week() {
  const { week } = Route.useParams();
  const { data } = useSuspenseQuery(issueQuery(week)), head = Route.useLoaderData();
  if (data && head.data) return <DataShell object={{ type: "week", id: week }} name={data.text.headline} number={data.number} kicker={data.dates.label}><WeekData issue={data} /></DataShell>;
  return data ? <EditionView issue={data} /> : null;
}
