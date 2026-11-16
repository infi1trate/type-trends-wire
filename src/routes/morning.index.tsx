import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { morningQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { MorningView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { withShare, shareImageFor } from "@/lib/share/meta";

const TITLE = `The Morning Line — today's edition · ${BRAND_NAME}`;
const DESC = "The daily edition: the day's lead, five more stories ranked by score, what is moving, one opening and what the desk held.";
export const Route = createFileRoute("/morning/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(morningQuery(null)).then(() => undefined),
  head: () => ({ meta: withShare(shareImageFor("morning", "today"), [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }]), links: [...fontLinks(), { rel: "alternate", type: "application/rss+xml", title: "The Morning Line", href: "/morning/rss.xml" }] }),
  component: Today,
  errorComponent: () => <DigestNotFound title="The Morning Line didn't load" body="The stories behind it couldn't be read just now. Try again in a minute." />,
});
function Today() {
  const { data } = useSuspenseQuery(morningQuery(null));
  return data ? <MorningView d={data} /> : <DigestNotFound title="No edition today" body="The Morning Line has no edition for today yet." />;
}
