import { say as sayState } from "@/lib/voice";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { chartCardQuery } from "@/lib/data";
import { ChartOfWeek } from "@/components/terminal/ChartCard";
import { SITE_URL } from "@/lib/site";
import { cardText } from "@/lib/chart/card";
import { oembedLink } from "@/lib/embed/oembed-link";
import { EmbedPanel } from "@/components/embed/EmbedPanel";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/chart/$week")({
  staticData: { mode: "dark" },
  loader: async ({ context, params }) => {
    if (!/^\d{4}-W\d{2}$/.test(params.week)) throw notFound();
    const card = await context.queryClient.ensureQueryData(chartCardQuery(params.week));
    if (!card) throw notFound();
    // C1 · loaded here, not at the top of the route file: card.ts carries the 390 KB glyph table, and a static import put it in
    // front of every page's first byte on a cold server (route files load with the route tree). The component's own use is split.
    const t = (await import("@/lib/chart/card")).cardText(card.model);
    return { name: `${t.name} [${t.dimension}]`, call: t.call };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Chart unavailable — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.name} · Chart of the Week ${params.week} — ${BRAND_NAME}`, url = `${SITE_URL}/chart/${params.week}`, img = `${SITE_URL}/chart/${params.week}.png`;
    return {
      meta: [{ title }, { name: "description", content: loaderData.call }, { property: "og:title", content: title }, { property: "og:description", content: loaderData.call }, { property: "og:type", content: "article" }, { property: "og:url", content: url },
        { property: "og:image", content: img }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "675" }, { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: img }],
      links: [{ rel: "canonical", href: url }, oembedLink(url, loaderData.name)],
    };
  },
  component: WeekChart,
  notFoundComponent: () => <main className="p-3"><h1 className="text-hero">{sayState("chart.notFound").title}</h1><p className="t-say mt-2">{sayState("chart.notFound").text}</p><Link className="label mt-3 inline-block" to="/chart">← LATEST CHART</Link></main>,
  errorComponent: () => <main className="p-3" role="alert"><h1 className="text-hero">{sayState("chart.failed").title}</h1><p className="t-say mt-2">{sayState("chart.failed").text}</p><Link to="/chart">← LATEST CHART</Link></main>,
});
function WeekChart() {
  const { week } = Route.useParams();
  const { data } = useSuspenseQuery(chartCardQuery(week));
  return <main className="min-h-dvh bg-void">
    <header className="flex h-8 items-center justify-between border-b border-rule bg-g900 px-3"><h1 className="label font-semibold">CHART OF THE WEEK · {week}</h1><Link to="/terminal" search={{ panel: "brief" }} className="label text-ink hover:underline">← F10 FORECAST</Link></header>
    <ChartOfWeek card={data} />
    {data && <div className="border-t border-rule p-3"><EmbedPanel variant="terminal" target={{ kind: "chart", week }} title={`${cardText(data.model).name} [${cardText(data.model).dimension}]`} /></div>}
  </main>;
}
