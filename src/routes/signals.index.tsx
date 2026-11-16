import { createFileRoute } from "@tanstack/react-router";
import { signalsIndexQuery } from "@/lib/data";
import { parseSignalsSearch, type SignalsSearch } from "@/lib/signals-index";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { SignalsIndexView } from "@/components/read/SignalsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Signals — what deserves your attention · ${BRAND_NAME}`;
const DESC = "Every design signal ranked within its tier by Momentum, share or change, filterable by dimension and sector, each with stage, share and its quarterly trail.";
export const Route = createFileRoute("/signals/")({
  validateSearch: (s: Record<string, unknown>): SignalsSearch => Object.fromEntries((["tab", "sort", "sector", "tier"] as const).flatMap(k => (typeof s[k] === "string" ? [[k, (s[k] as string).slice(0, 40)]] : []))) as SignalsSearch,
  loaderDeps: ({ search }) => ({ v: parseSignalsSearch(search) }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(signalsIndexQuery(deps.v)).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/signals` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/signals` }, ...fontLinks()] }),
  component: Signals,
  errorComponent: () => <DigestNotFound title="Signals didn't load" body="The latest forecast couldn't be read just now. Try again in a minute." />,
  notFoundComponent: () => <DigestNotFound title="No such view" body="That signals view doesn't exist. Start from all signals." />,
});
function Signals() {
  const v = parseSignalsSearch(Route.useSearch());
  return <SignalsIndexView v={v} />;
}
