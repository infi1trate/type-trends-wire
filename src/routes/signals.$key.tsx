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

export const Route = createFileRoute("/signals/$key")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined } => (typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
  loader: async ({ context, params }) => {
    if (!/^[a-z0-9_]+:[^\s]{1,80}$/i.test(params.key)) throw notFound();
    // P1 · shell first: the key's own forecast rows decide the head and the 404; the full page streams in after the shell.
    void context.queryClient.prefetchQuery(traitPageQuery(params.key));
    const head = await context.queryClient.ensureQueryData(traitHeadQuery(params.key));
    if (!head) throw notFound();
    return { head };
  },
  head: ({ loaderData }) => loaderData?.head ? traitHead(loaderData.head) : { meta: [{ title: `Signal not found — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] },
  component: Signal,
  notFoundComponent: () => <DigestNotFound v="signal.notFound" />,
  errorComponent: () => <DigestNotFound v="signal.failed" />,
});
function Signal() {
  const { key } = Route.useParams();
  const { sector } = Route.useSearch();
  const { head } = Route.useLoaderData();
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
