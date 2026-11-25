import { createFileRoute } from "@tanstack/react-router";
import { navPatternsQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { DigestNotFound } from "@/components/digest/NotFound";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { NavPatternsView } from "@/components/read/Structure";
import { viewSearch, type ViewSearch } from "@/lib/views/search";
import { DataShell } from "@/components/dataview/DataShell";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";

// J1 · the one new page: the words in top navigation over five years and the sign-in split, read from stored counts only.
const TITLE = `The words in top navigation — patterns · ${BRAND_NAME}`;
const DESC = "Which words lead the top navigation of the homepages slug reads, now against five years ago, and how the sign-in item is worded.";
export const Route = createFileRoute("/patterns/navigation")({
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): ViewSearch => viewSearch(s),
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  loader: ({ context, deps }) => { void context.queryClient.prefetchQuery(navPatternsQuery()); return { data: deps.data }; },
  headers: ({ loaderData }) => (loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  head: ({ loaderData }) => loaderData?.data ? dataViewHead({ type: "pattern", id: "navigation" }, "Navigation words") : ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/patterns/navigation` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/patterns/navigation` }, ...fontLinks()] }),
  component: NavPage,
  errorComponent: () => <DigestNotFound v="patterns.failed" />,
});
function NavPage() {
  const { view } = Route.useSearch();
  if (view === "data") return <DataShell object={{ type: "pattern", id: "navigation" }} name="Navigation words"><Later shapes={[{ kind: "rows", n: 22, height: ROW.terminal }]}><NavPatternsView look="data" /></Later></DataShell>;
  return <DigestShell label="Navigation words" section="patterns">
    <Later id="nav-later" before={<TitleBlock kicker="Patterns · Navigation" title="The words in top navigation" deck={<p className="ed-standfirst mt-5 max-w-[62ch]">{DESC}</p>} />}
      shapes={[{ kind: "rows", n: 22, height: ROW.compact }, { kind: "rows", n: 8, height: ROW.tile }]}>
      <div className="ed-wrap mt-10"><NavPatternsView /></div>
    </Later>
  </DigestShell>;
}
