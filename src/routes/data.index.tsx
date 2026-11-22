import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataIndexQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { DataIndexBody, DataIndexHead } from "@/components/data/DataIndexView";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { Later } from "@/components/read/Later";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Studies — longer answers, built from five years of captures · ${BRAND_NAME}`;
const DESC = "Numbered studies: each one argument about how brands look on the web, with its evidence from stored captures, in three standing series.";
export const Route = createFileRoute("/data/")({
  // P2 · shell first: the title is fixed copy, so nothing is awaited; the stored study rows stream into the body slot.
  loader: ({ context }) => { void context.queryClient.prefetchQuery(dataIndexQuery()); },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: DataIndex,
  errorComponent: () => <DigestNotFound v="data.failed" />,
});
function DataIndex() {
  return <DigestShell label="Studies" section="signals">
    <DataIndexHead />
    <Later id="studies-later" reserve="100dvh" shapes={[{ kind: "picture", ratio: 16 / 9, maxWidth: 1200 }, { kind: "rows", n: 6, height: 76 }]} placeholderClassName="ed-wrap mt-[var(--sys-gap-section)]"><DataIndexLater /></Later>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
function DataIndexLater() {
  const { data } = useSuspenseQuery(dataIndexQuery());
  return <DataIndexBody home={data.home} />;
}
