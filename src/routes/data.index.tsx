import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataIndexQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { DataIndexView } from "@/components/data/DataIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Data stories — questions the data can answer · ${BRAND_NAME}`;
const DESC = "Numbered data stories: one question about how brands look on the web, answered by a picture you step through, built from stored captures with receipts.";
export const Route = createFileRoute("/data/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dataIndexQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: DataIndex,
  errorComponent: () => <DigestNotFound title="Data stories didn't load" body="The stored data behind them couldn't be read just now. Try again in a minute." />,
});
function DataIndex() {
  const { data } = useSuspenseQuery(dataIndexQuery());
  return <DataIndexView rows={data.rows} />;
}
