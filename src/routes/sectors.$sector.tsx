import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { sectorReportQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { LENS_SECTORS } from "@/lib/sector-lens";
import { SectorReportView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";

export const Route = createFileRoute("/sectors/$sector")({
  loader: async ({ context, params }) => {
    if (params.sector === "all" || !LENS_SECTORS.includes(params.sector)) throw notFound();
    const r = await context.queryClient.ensureQueryData(sectorReportQuery(params.sector));
    if (!r) throw notFound();
    return { title: r.title, basis: r.basis };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Sector not found — Sector reports" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.title} · DSGN/TERMINAL`;
    return { meta: [{ title }, { name: "description", content: loaderData.basis }, { property: "og:title", content: title }, { property: "og:description", content: loaderData.basis }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }], links: fontLinks() };
  },
  component: Report,
  notFoundComponent: () => <DigestNotFound title="No report for this sector" body="Sector reports exist for each tracked sector; pick one from the sector reports page." />,
  errorComponent: () => <DigestNotFound title="This report didn't load" body="The data behind it couldn't be read just now. Try again in a minute." />,
});
function Report() {
  const { sector } = Route.useParams();
  const { data } = useSuspenseQuery(sectorReportQuery(sector));
  return data ? <SectorReportView r={data} /> : null;
}
