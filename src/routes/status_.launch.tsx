import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { launchQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { LaunchView } from "@/components/read/LaunchView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Launch readiness · ${BRAND_NAME}`;
const DESC = `What each ${BRAND_NAME} launch switch is set to, what turning it on would expose, and live pre-flight checks. Read-only.`;
export const Route = createFileRoute("/status_/launch")({
  loader: ({ context }) => context.queryClient.ensureQueryData(launchQuery()),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: Launch,
  errorComponent: () => <DigestNotFound v="launch.failed" section="tools" kicker="Status" />,
});
function Launch() {
  const { data } = useSuspenseQuery(launchQuery());
  return <LaunchView p={data} />;
}
