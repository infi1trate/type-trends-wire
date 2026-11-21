import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { patternHeadQuery, patternQuery } from "@/lib/data";
import { resolveSector } from "@/lib/sector-lens";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { PatternView } from "@/components/read/PatternViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { withShare, shareImageFor } from "@/lib/share/meta";
import { viewSearch, type ViewSearch } from "@/lib/views/search";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
import { patternsQuery } from "@/lib/data";
import { DataShell } from "@/components/dataview/DataShell";
import { PatternData } from "@/components/dataview/Views";

export const Route = createFileRoute("/patterns/$key")({
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined } & ViewSearch => ({ ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...viewSearch(s) }),
  loaderDeps: ({ search }) => ({ sector: resolveSector(search.sector), data: search.view === "data" }),
  // P1 · shell first: name and count (from the shared records) decide the head and the 404; examples and crops stream in.
  loader: async ({ context, params, deps }) => {
    if (deps.data) void context.queryClient.prefetchQuery(patternsQuery(deps.sector)); else void context.queryClient.prefetchQuery(patternQuery(params.key, deps.sector));
    const p = await context.queryClient.ensureQueryData(patternHeadQuery(params.key, deps.sector));
    if (!p) throw notFound();
    return { name: p.name, total: p.total, dimension: p.dimension, data: deps.data };
  },
  head: ({ params, loaderData }) => {
    if (loaderData?.data) return dataViewHead({ type: "pattern", id: params.key }, loaderData.name);
    const title = `${loaderData?.name ?? "Pattern"} — pattern · ${BRAND_NAME}`, desc = loaderData ? `${loaderData.total} tracked brands showing ${loaderData.name}, by sector and capture date.` : "Pattern not found.";
    const url = `${SITE_URL}/patterns/${encodeURIComponent(params.key)}`;
    return { meta: withShare(shareImageFor("pattern", params.key), [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }, ...(loaderData ? [] : [{ name: "robots", content: "noindex" }])]), links: [{ rel: "canonical", href: url }, ...fontLinks()] };
  },
  headers: ({ loaderData }) => (loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  component: Pattern,
  notFoundComponent: () => <DigestNotFound v="pattern.notFound" />,
  errorComponent: () => <DigestNotFound v="pattern.failed" />,
});
function Pattern() {
  const { key } = Route.useParams(), { sector } = Route.useSearch();
  const h = Route.useLoaderData();
  if (h.data) return <DataShell object={{ type: "pattern", id: key }} name={h.name} kicker={h.dimension}><PatternData k={key} sector={resolveSector(sector)} /></DataShell>;
  return <DigestShell label={`${h.name} pattern`} section="patterns" lens>
    <Later id="pattern-later" before={<TitleBlock h1="ed-h1" kicker={`Pattern · ${h.dimension}`} title={h.name} deck={null} />}
      shapes={[{ kind: "rows", n: 2, height: ROW.compact }, { kind: "picture", ratio: 1280 / 800, maxWidth: 1064 }, { kind: "rows", n: 6, height: ROW.ledger }]}>
      <Full k={key} sector={resolveSector(sector)} />
    </Later>
  </DigestShell>;
}
function Full({ k, sector }: { k: string; sector: string }) {
  const { data } = useSuspenseQuery(patternQuery(k, sector));
  return data ? <PatternView p={data} /> : null;
}
