import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { chartCardQuery } from "@/lib/data";
import { ChartOfWeek } from "@/components/terminal/ChartCard";
import { SITE_URL } from "@/lib/site";
import { cardText } from "@/lib/chart/card";
import { EmbedPanel } from "@/components/embed/EmbedPanel";

const TITLE = "Chart of the Week — DSGN/TERMINAL";
const DESC = "The weekly brief's one design trend to watch: quarterly library share, forecast band, stage and momentum.";
export const Route = createFileRoute("/chart/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(chartCardQuery(null)),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/chart` }, { name: "twitter:card", content: "summary_large_image" }], links: [{ rel: "canonical", href: `${SITE_URL}/chart` }] }),
  component: LatestChart,
  errorComponent: () => <main className="p-3" role="alert"><h1 className="text-hero">CHART UNAVAILABLE</h1><Link to="/" search={{ panel: "brief" }}>← F10 FORECAST</Link></main>,
});
function LatestChart() {
  const { data } = useSuspenseQuery(chartCardQuery(null));
  return <main className="min-h-dvh bg-void">
    <header className="flex h-8 items-center justify-between border-b border-rule bg-g900 px-3"><h1 className="label font-semibold">CHART OF THE WEEK · {data?.week ?? "PENDING"}</h1><Link to="/" search={{ panel: "brief" }} className="label text-ink hover:underline">← F10 FORECAST</Link></header>
    {data && <p className="px-3 pt-3"><Link to="/chart/$week" params={{ week: data.week }} className="label text-ink underline">PERMALINK /chart/{data.week}</Link></p>}
    <ChartOfWeek card={data} />
    {data && <div className="border-t border-rule p-3"><EmbedPanel variant="terminal" target={{ kind: "chart", week: data.week }} title={`${cardText(data.model).name} [${cardText(data.model).dimension}]`} /></div>}
  </main>;
}
