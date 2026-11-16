import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { editionsQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { EditionsView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Editions — daily, weekly, quarterly · ${BRAND_NAME}`;
const DESC = "The Morning Line every day, the Digest every week and a report on each sector every quarter, all built from stored stories and signals.";
export const Route = createFileRoute("/editions")({
  loader: ({ context }) => context.queryClient.ensureQueryData(editionsQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }], links: fontLinks() }),
  component: Editions,
  errorComponent: () => <DigestNotFound v="editions.failed" />,
});
function Editions() {
  const { data } = useSuspenseQuery(editionsQuery());
  return <EditionsView d={data} />;
}
