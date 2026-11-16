import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { morningQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { DAY_RE, MORNING_FIRST_DAY, titleOf } from "@/lib/editions/morning";
import { MorningView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/morning/$date")({
  loader: async ({ context, params }) => {
    if (!DAY_RE.test(params.date)) throw notFound();
    const d = await context.queryClient.ensureQueryData(morningQuery(params.date));
    if (!d) throw notFound();
    return { title: d.edition.title, lead: d.edition.lead?.headline ?? null };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Edition not found — The Morning Line" }, { name: "robots", content: "noindex" }] };
    const title = `${titleOf(params.date)} · ${BRAND_NAME}`, desc = loaderData.lead ? `Lead: ${loaderData.lead}` : "The daily edition of stories, ranked by score.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }], links: fontLinks() };
  },
  component: Edition,
  notFoundComponent: () => { const { date } = Route.useParams(); return <DigestNotFound title="No edition for this day" body={`The Morning Line has no edition for “${date}”. Editions run daily (UTC) from ${MORNING_FIRST_DAY} to today, written as YYYY-MM-DD.`} />; },
  errorComponent: () => <DigestNotFound title="This edition didn't load" body="The stories behind it couldn't be read just now. Try again in a minute." />,
});
function Edition() {
  const { date } = Route.useParams();
  const { data } = useSuspenseQuery(morningQuery(date));
  return data ? <MorningView d={data} /> : null;
}
