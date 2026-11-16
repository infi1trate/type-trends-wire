import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { StatusView } from "@/components/read/ToolsViews";

const TITLE = "Status — jobs and model card · DSGN/TERMINAL";
const DESC = "Scheduled job health, the forecast model card and data coverage for DSGN/TERMINAL operators.";
export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: StatusView,
});
