import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { welcomeQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { WelcomeView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Private: gated like every page (LANDING_PUBLIC = false, not in OPEN_PATHS) and kept out of search results.
const TITLE = `Welcome — the live newsroom for how brands look and sound · ${BRAND_NAME}`;
const DESC = "Spot, prove and act on how brands look and sound on the web: stories with receipts, daily and weekly editions, sector reports and tools.";
export const Route = createFileRoute("/welcome")({
  loader: ({ context }) => context.queryClient.ensureQueryData(welcomeQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: Welcome,
  errorComponent: () => <DigestNotFound v="welcome.failed" />,
});
function Welcome() {
  const { data } = useSuspenseQuery(welcomeQuery());
  return <WelcomeView d={data} />;
}
