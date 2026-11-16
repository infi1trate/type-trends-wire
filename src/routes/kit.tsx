import { createFileRoute } from "@tanstack/react-router";
import { kitQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { KitView } from "@/components/kit/KitView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

// Internal: gated like every page (not in OPEN_PATHS), linked from /tools only and kept out of search results.
const TITLE = `Kit — every shared component in the current theme · ${BRAND_NAME}`;
const DESC = "The design kit: type roles, colour and stage tokens, controls, story cards, containers, image treatments, charts, spacing and motion on live data.";
export const Route = createFileRoute("/kit")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kitQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }], links: fontLinks() }),
  component: KitView,
  errorComponent: () => <DigestNotFound v="kit.failed" />,
});
