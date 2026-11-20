import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { line as voiced } from "@/lib/voice";
import { staffJson } from "@/lib/staff-key";
import { StaffGate } from "@/components/read/StaffGate";
import type { loadLaunch } from "@/lib/launch/launch.server";
import { fontLinks } from "@/lib/digest/meta";
import { LaunchView } from "@/components/read/LaunchView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Launch readiness · ${BRAND_NAME}`;
const DESC = `What each ${BRAND_NAME} launch switch is set to, what turning it on would expose, and live pre-flight checks. Read-only.`;
export const Route = createFileRoute("/status_/launch")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: Launch,
  errorComponent: () => <DigestNotFound v="launch.failed" section="tools" kicker="Status" />,
});
// Staff only: the readiness checks load from the editor endpoint after the key is accepted; nothing is in the page's HTML.
function Launch() { return <StaffGate page="Launch readiness">{() => <LaunchLoaded />}</StaffGate>; }
function LaunchLoaded() {
  const { data, isError } = useQuery({ queryKey: ["staff", "launch"], staleTime: 60_000, queryFn: () => staffJson<Awaited<ReturnType<typeof loadLaunch>>>({ action: "staff", page: "launch" }) });
  if (isError) return <DigestNotFound v="launch.failed" section="tools" kicker="Status" />;
  if (!data) return <p className="ed-wrap ed-small pt-12" aria-busy="true">{voiced("staff.loading")}</p>;
  return <LaunchView p={data} />;
}
