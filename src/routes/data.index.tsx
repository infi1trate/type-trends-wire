import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataIndexQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { DataIndexView } from "@/components/data/DataIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Studies — longer answers, built from five years of captures · ${BRAND_NAME}`;
const DESC = "Numbered studies: each one argument about how brands look on the web, with its evidence from stored captures, in three standing series.";
export const Route = createFileRoute("/data/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dataIndexQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: DataIndex,
  errorComponent: () => <DigestNotFound v="data.failed" />,
});
function DataIndex() {
  const { data } = useSuspenseQuery(dataIndexQuery());
  return <DataIndexView home={data.home} />;
}
