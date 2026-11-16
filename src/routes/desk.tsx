import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storyQueueQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { DeskView } from "@/components/read/DeskView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Editor's desk — the story queue · ${BRAND_NAME}`;
const DESC = "What the story engine ran, what it held and why, with score components and the editor's log.";
export const Route = createFileRoute("/desk")({
  validateSearch: (s: Record<string, unknown>): { day?: string | undefined } => (typeof s["day"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["day"]) ? { day: s["day"] } : {}),
  loaderDeps: ({ search }) => ({ day: search.day ?? null }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(storyQueueQuery(deps.day, true)).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: Desk,
  errorComponent: () => <DigestNotFound v="desk.failed" />,
});
function Desk() {
  const { day } = Route.useSearch(), navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(storyQueueQuery(day ?? null, true));
  return <DeskView q={data} onDay={d => void navigate({ search: d ? { day: d } : {} })} />;
}
