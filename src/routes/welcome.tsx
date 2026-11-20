import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { staffJson, staffKey } from "@/lib/staff-key";
import type { loadWelcome } from "@/lib/editions/welcome.server";
import { fontLinks } from "@/lib/digest/meta";
import { WelcomeView } from "@/components/read/EditionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Staff only: 404 to the public (the server never holds the key, so every server render is a 404). With the editor key
// accepted in this tab, client navigation loads it from the editor endpoint. Kept out of search results.
const welcomeQuery = () => ({ queryKey: ["staff", "welcome"], staleTime: 60_000, queryFn: () => staffJson<Awaited<ReturnType<typeof loadWelcome>>>({ action: "staff", page: "welcome" }) });
const TITLE = `Welcome — the live newsroom for how brands look and sound · ${BRAND_NAME}`;
const DESC = "Spot, prove and act on how brands look and sound on the web: stories with receipts, daily and weekly editions, sector reports and tools.";
export const Route = createFileRoute("/welcome")({
  beforeLoad: () => { if (!staffKey()) throw notFound(); },
  loader: ({ context }) => context.queryClient.ensureQueryData(welcomeQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: Welcome,
  errorComponent: () => <DigestNotFound v="welcome.failed" />,
});
function Welcome() {
  const { data } = useSuspenseQuery(welcomeQuery());
  return <WelcomeView d={data} />;
}
