import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { issueQuery } from "@/lib/data";
import { issueHead } from "@/lib/digest/meta";
import { specimenLinks } from "@/lib/digest/head";
import { IssueView } from "@/components/digest/IssueView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { DIGEST_NAME } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/digest/")({
  loader: async ({ context }) => ({ issue: await context.queryClient.ensureQueryData(issueQuery(null)) }),
  head: ({ loaderData }) => loaderData?.issue ? issueHead(loaderData.issue, "/digest", specimenLinks(loaderData.issue))
    : { meta: [{ title: `${DIGEST_NAME} — ${BRAND_NAME}` }, { name: "description", content: `${DIGEST_NAME}: the weekly edition of ${BRAND_NAME}.` }, { property: "og:title", content: DIGEST_NAME }, { property: "og:description", content: `The weekly edition of ${BRAND_NAME}.` }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] },
  component: Latest,
  errorComponent: () => <DigestNotFound v="digest.failed" />,
});
function Latest() {
  const { data } = useSuspenseQuery(issueQuery(null));
  if (!data) return <DigestNotFound v="digest.empty" />;
  return <IssueView issue={data} />;
}
