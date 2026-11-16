import { createFileRoute } from "@tanstack/react-router";
import { signalsQuery } from "@/lib/data";
import { resolveSignalTab } from "@/lib/ia";
import { resolveSector } from "@/lib/sector-lens";
import { TIERS, type Tier } from "@/lib/tiers";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { SignalsIndexView } from "@/components/read/SignalsIndexView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Signals — what deserves your attention · ${BRAND_NAME}`;
const DESC = "Headline design signals ranked by Momentum, by dimension (type, color, layout, voice, vibe), each with stage, Confidence and a so-what line.";
export const Route = createFileRoute("/signals/")({
  validateSearch: (s: Record<string, unknown>): { tab?: string | undefined; tier?: string | undefined; sector?: string | undefined } => ({
    ...(typeof s["tab"] === "string" ? { tab: s["tab"] } : {}), ...(typeof s["tier"] === "string" ? { tier: s["tier"] } : {}), ...(typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(signalsQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/signals` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/signals` }, ...fontLinks()] }),
  component: Signals,
  errorComponent: () => <DigestNotFound title="Signals didn't load" body="The latest forecast couldn't be read just now. Try again in a minute." />,
});
function Signals() {
  const { tab, tier, sector } = Route.useSearch();
  const t: Tier = (TIERS as readonly string[]).includes(tier ?? "") ? (tier as Tier) : "headline";
  return <SignalsIndexView tab={resolveSignalTab(tab)} tier={t} sector={resolveSector(sector)} />;
}
