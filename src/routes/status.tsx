import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { StatusView } from "@/components/read/ToolsViews";
import { StaffGate } from "@/components/read/StaffGate";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Status — jobs and model card · ${BRAND_NAME}`;
const DESC = `Scheduled job health, the forecast model card and data coverage for ${BRAND_NAME} operators.`;
export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  // Staff only: the job table, model card and coverage mount (and fetch) only after the editor key is accepted.
  component: () => <StaffGate page="System status">{() => <StatusView />}</StaffGate>,
});
