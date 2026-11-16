import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { ToolsView } from "@/components/read/ToolsViews";

const TITLE = "Tools — audits, watchlists, ledger and agent access · DSGN/TERMINAL";
const DESC = "Act on design signals: competitive audits, watchlists with RSS, the forecast ledger, embeds and MCP agent access.";
export const Route = createFileRoute("/tools")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/tools` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/tools` }, ...fontLinks()] }),
  component: ToolsView,
});
