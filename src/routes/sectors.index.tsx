import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { sectorIndexQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SectorsIndexView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Sector reports — the state of each sector · ${BRAND_NAME}`;
const DESC = "A quarterly report for each tracked sector: its signals against all sectors, white space, counter-moves, leading brands and patterns.";
export const Route = createFileRoute("/sectors/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sectorIndexQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }], links: fontLinks() }),
  component: Sectors,
  errorComponent: () => <DigestNotFound title="Sector reports didn't load" body="The data behind them couldn't be read just now. Try again in a minute." />,
});
function Sectors() {
  const { data } = useSuspenseQuery(sectorIndexQuery());
  return <SectorsIndexView d={data} />;
}
