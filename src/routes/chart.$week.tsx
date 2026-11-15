import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { chartCardQuery } from "@/lib/data";
import { ChartOfWeek } from "@/components/terminal/ChartCard";
import { SITE_URL } from "@/lib/site";
import { cardText } from "@/lib/chart/card";

export const Route = createFileRoute("/chart/$week")({
  loader: async ({ context, params }) => {
    if (!/^\d{4}-W\d{2}$/.test(params.week)) throw notFound();
    const card = await context.queryClient.ensureQueryData(chartCardQuery(params.week));
    if (!card) throw notFound();
    const t = cardText(card.model);
    return { name: `${t.name} [${t.dimension}]`, call: t.call };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Chart unavailable — DSGN/TERMINAL" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.name} · Chart of the Week ${params.week} — DSGN/TERMINAL`, url = `${SITE_URL}/chart/${params.week}`, img = `${SITE_URL}/chart/${params.week}.png`;
    return {
      meta: [{ title }, { name: "description", content: loaderData.call }, { property: "og:title", content: title }, { property: "og:description", content: loaderData.call }, { property: "og:type", content: "article" }, { property: "og:url", content: url },
        { property: "og:image", content: img }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "675" }, { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: img }],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: WeekChart,
  notFoundComponent: () => <main className="p-3"><h1 className="text-hero">404 · NO CHART FOR THIS WEEK</h1><Link className="label mt-3 inline-block" to="/chart">← LATEST CHART</Link></main>,
  errorComponent: () => <main className="p-3" role="alert"><h1 className="text-hero">CHART UNAVAILABLE</h1><Link to="/chart">← LATEST CHART</Link></main>,
});
function WeekChart() {
  const { week } = Route.useParams();
  const { data } = useSuspenseQuery(chartCardQuery(week));
  return <main className="min-h-dvh bg-void">
    <header className="flex h-8 items-center justify-between border-b border-rule bg-g900 px-3"><h1 className="label font-semibold">CHART OF THE WEEK · {week}</h1><Link to="/" search={{ panel: "brief" }} className="label text-ink hover:underline">← F10 FORECAST</Link></header>
    <ChartOfWeek card={data} />
  </main>;
}
