import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DigestShell } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";

import { sectorHeadQuery, sectorReportQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { LENS_SECTORS } from "@/lib/sector-lens";
import { SectorReportView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

export const Route = createFileRoute("/sectors/$sector")({
  loader: async ({ context, params }) => {
    if (params.sector === "all" || !LENS_SECTORS.includes(params.sector)) throw notFound();
    // P1 · shell first: title and basis come from two small reads; the report itself streams in.
    void context.queryClient.prefetchQuery(sectorReportQuery(params.sector));
    const r = await context.queryClient.ensureQueryData(sectorHeadQuery(params.sector));
    if (!r) throw notFound();
    return { title: r.title, basis: r.basis, name: r.name };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Sector not found — Sector reports" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.title} · ${BRAND_NAME}`;
    return { meta: withShare(shareImageFor("sector", params.sector), [{ title }, { name: "description", content: loaderData.basis }, { property: "og:title", content: title }, { property: "og:description", content: loaderData.basis }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }]), links: fontLinks() };
  },
  component: Report,
  notFoundComponent: () => <DigestNotFound v="sector.notFound" />,
  errorComponent: () => <DigestNotFound v="sector.failed" />,
});
function Report() {
  const { sector } = Route.useParams(), h = Route.useLoaderData(), nav = useNavigate();
  const onChange = (s: string) => { if (s === "all") void nav({ to: "/sectors" }); else void nav({ to: "/sectors/$sector", params: { sector: s } }); };
  return <DigestShell label={h.title} edition="sectors" fixedSector={{ value: sector, onChange }}>
    <Later id="sector-later" before={<TitleBlock kicker="Sector report" title={h.title} deck={<p className="ed-caption mt-5 max-w-[62ch]">{h.basis}</p>} />}
      shapes={[{ kind: "rows", n: 5, height: ROW.ledger }, { kind: "block", height: 320 }, { kind: "rows", n: 5, height: ROW.ledger }]}>
      <Full sector={sector} />
    </Later>
  </DigestShell>;
}
function Full({ sector }: { sector: string }) {
  const { data } = useSuspenseQuery(sectorReportQuery(sector));
  return data ? <SectorReportView r={data} /> : null;
}
