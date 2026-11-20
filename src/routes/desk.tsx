import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { line as voiced } from "@/lib/voice";
import { fontLinks } from "@/lib/digest/meta";
import { DeskView, type DeskQueue } from "@/components/read/DeskView";
import { StaffGate } from "@/components/read/StaffGate";
import { DigestNotFound } from "@/components/digest/NotFound";
import { staffJson } from "@/lib/staff-key";
import { BRAND_NAME } from "@/lib/brand";

// Staff only: no loader. The queue loads from the editor endpoint only after the key is accepted for this tab (StaffGate).
const TITLE = `Editor's desk — the story queue · ${BRAND_NAME}`;
const DESC = "What the story engine ran, what it held and why, with score components and the editor's log.";
export const Route = createFileRoute("/desk")({
  validateSearch: (s: Record<string, unknown>): { day?: string | undefined } => (typeof s["day"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["day"]) ? { day: s["day"] } : {}),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: Desk,
  errorComponent: () => <DigestNotFound v="desk.failed" />,
});
export const deskQueueQuery = (day: string | null) => ({ queryKey: ["desk-queue", day ?? "recent"], staleTime: 0, queryFn: () => staffJson<DeskQueue>({ action: "queue", ...(day ? { day } : {}) }) });
function Desk() { return <StaffGate page="Editor's desk">{() => <DeskLoaded />}</StaffGate>; }
function DeskLoaded() {
  const { day } = Route.useSearch(), navigate = Route.useNavigate();
  const { data, isError } = useQuery(deskQueueQuery(day ?? null));
  if (isError) return <DigestNotFound v="desk.failed" />;
  if (!data) return <p className="ed-wrap ed-small pt-12" aria-busy="true">{voiced("staff.loading")}</p>;
  return <DeskView q={data} onDay={d => void navigate({ search: d ? { day: d } : {} })} />;
}
