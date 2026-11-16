import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { patternsQuery } from "@/lib/data";
import { resolveSector } from "@/lib/sector-lens";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { PatternsIndexView } from "@/components/read/PatternViews";
import { DigestNotFound } from "@/components/digest/NotFound";

const TITLE = "Patterns — signals seen as examples · DSGN/TERMINAL";
const DESC = "Headline layout and composite design signals, each with the tracked brands that show it.";
export const Route = createFileRoute("/patterns/")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined } => (typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
  loaderDeps: ({ search }) => ({ sector: resolveSector(search.sector) }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(patternsQuery(deps.sector)).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/patterns` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/patterns` }, ...fontLinks()] }),
  component: Patterns,
  errorComponent: () => <DigestNotFound title="Patterns didn't load" body="The examples couldn't be read just now. Try again in a minute." />,
});
function Patterns() {
  const { sector } = Route.useSearch();
  const { data } = useSuspenseQuery(patternsQuery(resolveSector(sector)));
  return <PatternsIndexView patterns={data.patterns} sector={data.sector} />;
}
