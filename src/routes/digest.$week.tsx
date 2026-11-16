import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { issueQuery } from "@/lib/data";
import { issueHead } from "@/lib/digest/meta";
import { specimenLinks } from "@/lib/digest/head";
import { isIssueWeek } from "@/lib/digest/week";
import { IssueView } from "@/components/digest/IssueView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { DIGEST_NAME, DIGEST_FIRST_WEEK } from "@/lib/site";

export const Route = createFileRoute("/digest/$week")({
  loader: async ({ context, params }) => {
    if (!isIssueWeek(params.week)) throw notFound();
    const issue = await context.queryClient.ensureQueryData(issueQuery(params.week));
    if (!issue) throw notFound();
    return { issue };
  },
  head: ({ params, loaderData }) => loaderData?.issue ? issueHead(loaderData.issue, `/digest/${params.week}`, specimenLinks(loaderData.issue))
    : { meta: [{ title: `Issue not found — ${DIGEST_NAME}` }, { name: "robots", content: "noindex" }] },
  component: Week,
  notFoundComponent: () => { const { week } = Route.useParams(); return <DigestNotFound v="digest.notFound" vars={{ digest: DIGEST_NAME, week, first: DIGEST_FIRST_WEEK }} />; },
  errorComponent: () => <DigestNotFound v="digest.failed" />,
});
function Week() {
  const { week } = Route.useParams();
  const { data } = useSuspenseQuery(issueQuery(week));
  return data ? <IssueView issue={data} /> : null;
}
