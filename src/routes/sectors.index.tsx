import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DigestShell } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";

import { sectorIndexQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SectorsIndexView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Sector reports — the state of each sector · ${BRAND_NAME}`;
const DESC = "A quarterly report for each tracked sector: its signals against all sectors, white space, counter-moves, leading brands and patterns.";
export const Route = createFileRoute("/sectors/")({
  // P1 · shell first: the title draws at once; the coverage list streams in.
  loader: ({ context }) => { void context.queryClient.prefetchQuery(sectorIndexQuery()); },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }], links: fontLinks() }),
  component: Sectors,
  errorComponent: () => <DigestNotFound v="sectors.failed" />,
});
function Sectors() {
  return <DigestShell label="Sector reports" edition="sectors">
    <Later id="sectors-later" before={<TitleBlock kicker="Sector reports · quarterly" title="The state of each sector" />} shapes={[{ kind: "rows", n: 10, height: ROW.ledger }]}><Full /></Later>
  </DigestShell>;
}
function Full() {
  const { data } = useSuspenseQuery(sectorIndexQuery());
  return <SectorsIndexView d={data} />;
}
