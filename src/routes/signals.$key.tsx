import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { traitHeadQuery, traitPageQuery } from "@/lib/data";
import { traitHead } from "@/lib/digest/meta";
import { resolveSector } from "@/lib/sector-lens";
import { SignalView } from "@/components/read/SignalView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell, BasisWord } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { viewSearch, type ViewSearch } from "@/lib/views/search";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
import { forecastDetailQuery } from "@/lib/data";
import { DataShell } from "@/components/dataview/DataShell";
import { SignalData } from "@/components/dataview/Views";
import { structureSignalQuery } from "@/lib/data";
import { STRUCTURE_BY_KEY, isStructureKey } from "@/lib/structure";
import { StructureSignalView } from "@/components/read/Structure";
import { SITE_URL } from "@/lib/site";
import { fontLinks } from "@/lib/digest/meta";

/** J1 · a structure signal's head (no forecast row and no share picture yet). */
function structureHead(key: string) {
  const s = STRUCTURE_BY_KEY.get(key)!, url = `${SITE_URL}/signals/${encodeURIComponent(key)}`, title = `${s.name} [Structure] — signal · ${BRAND_NAME}`, desc = `${s.meaning} Measured on the homepages ${BRAND_NAME} reads, desktop and phone.`;
  return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: url }, ...fontLinks()] };
}

export const Route = createFileRoute("/signals/$key")({
  staticData: { views: true },
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined } & ViewSearch => ({ ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}), ...viewSearch(s) }),
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  loader: async ({ context, params, deps }) => {
    if (!/^[a-z0-9_]+:[^\s]{1,80}$/i.test(params.key)) throw notFound();
    if (isStructureKey(params.key)) { void context.queryClient.prefetchQuery(structureSignalQuery(params.key)); return { head: null, data: false, structure: true }; }
    // P1 · shell first: the key's own forecast rows decide the head and the 404; the full page streams in after the shell.
    if (deps.data) { const i = params.key.indexOf(":"); void context.queryClient.prefetchQuery(forecastDetailQuery(params.key.slice(0, i), params.key.slice(i + 1))); }
    else void context.queryClient.prefetchQuery(traitPageQuery(params.key));
    const head = await context.queryClient.ensureQueryData(traitHeadQuery(params.key));
    if (!head) throw notFound();
    return { head, data: deps.data, structure: false };
  },
  head: ({ params, loaderData }) => loaderData?.structure ? structureHead(params.key) : loaderData?.head && loaderData.data ? dataViewHead({ type: "signal", id: params.key }, loaderData.head.name) : loaderData?.head ? traitHead(loaderData.head) : { meta: [{ title: `Signal not found — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] },
  headers: ({ loaderData }) => (loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  component: Signal,
  notFoundComponent: () => <DigestNotFound v="signal.notFound" />,
  errorComponent: () => <DigestNotFound v="signal.failed" />,
});
function Signal() {
  const { key } = Route.useParams();
  const { sector } = Route.useSearch();
  const { head, data, structure } = Route.useLoaderData();
  if (structure || !head) { const s = STRUCTURE_BY_KEY.get(key)!;
    return <DigestShell label={`${s.name} signal`} section="signals">
      <Later id="signal-later" before={<TitleBlock wrap="ed-wrap d-air" kicker={<span className="flex flex-wrap items-center gap-x-3 gap-y-2">Signal · Structure<BasisWord b="measured" /></span>} title={s.name} deck={<p className="ed-standfirst mt-5 max-w-[62ch]">{s.meaning}</p>} />}
        shapes={[{ kind: "block", height: 120 }, { kind: "picture", ratio: 16 / 9, maxWidth: 1064 }, { kind: "rows", n: 5, height: ROW.ledger }]}><StructureSignalView k={key} /></Later>
    </DigestShell>; }
  if (data) return <DataShell object={{ type: "signal", id: key }} name={head.name} kicker={head.dimension}><SignalData k={key} /></DataShell>;
  return <DigestShell label={`${head.name} signal`} section="signals" lens>
    <Later id="signal-later" before={<TitleBlock wrap="ed-wrap d-air" kicker={<span className="flex flex-wrap items-center gap-x-3 gap-y-2">Signal · {head.dimension}<BasisWord b={head.basis} /></span>} title={head.name} deck={<p className="ed-standfirst mt-5 max-w-[62ch]">{head.definition}</p>} />}
      shapes={[{ kind: "picture", ratio: 16 / 9, maxWidth: 1064 }, { kind: "rows", n: 5, height: ROW.ledger }]}>
      <Full k={key} sector={resolveSector(sector)} />
    </Later>
  </DigestShell>;
}
function Full({ k, sector }: { k: string; sector: string }) {
  const { data } = useSuspenseQuery(traitPageQuery(k));
  return data ? <div data-receipts="" className="contents"><SignalView page={data} sector={sector} /></div> : null;
}
