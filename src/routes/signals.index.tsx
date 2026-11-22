import { createFileRoute } from "@tanstack/react-router";
import { signalsIndexQuery } from "@/lib/data";
import { parseSignalsSearch, type SignalsSearch } from "@/lib/signals-index";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { SignalsIndexView } from "@/components/read/SignalsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { sectorName } from "@/lib/labels";
import { resolveSector } from "@/lib/sector-lens";


const TITLE = `Signals — what deserves your attention · ${BRAND_NAME}`;
const DESC = "Every design signal ranked within its tier by Momentum, share or change, filterable by dimension and sector, each with stage, share and its quarterly trail.";
export const Route = createFileRoute("/signals/")({
  validateSearch: (s: Record<string, unknown>): SignalsSearch => Object.fromEntries((["tab", "sort", "sector", "tier"] as const).flatMap(k => (typeof s[k] === "string" ? [[k, (s[k] as string).slice(0, 40)]] : []))) as SignalsSearch,
  loaderDeps: ({ search }) => ({ v: parseSignalsSearch(search) }),
  // P1 · shell first: the title draws at once; the table streams in.
  loader: ({ context, deps }) => { void context.queryClient.prefetchQuery(signalsIndexQuery(deps.v)); },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/signals` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/signals` }, ...fontLinks()] }),
  component: Signals,
  errorComponent: () => <DigestNotFound v="signals.failed" />,
  notFoundComponent: () => <DigestNotFound v="signals.notFound" />,
});
function Signals() {
  const v = parseSignalsSearch(Route.useSearch());
  return <DigestShell label="Signals" section="signals" lens>
    <Later id="signals-later" before={<TitleBlock kicker={`Signals · ${sectorName(resolveSector(v.sector))}`} title="What deserves your attention" h1="ed-cover hold-signals-title" deck={null} />} shapes={[{ kind: "block", height: 96 }, { kind: "rows", n: 12, height: ROW.ledger }]}>
      <SignalsIndexView v={v} />
    </Later>
  </DigestShell>;
}
