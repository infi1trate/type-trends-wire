import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { AuditNew } from "@/components/agency/AuditNew";

export const Route = createFileRoute("/audit/new")({
  validateSearch: (s: Record<string, unknown>): { sites?: string | undefined } => ({ sites: typeof s["sites"] === "string" ? s["sites"].slice(0, 800) : undefined }),
  head: () => ({
    meta: [{ title: "New competitive audit — DSGN/TERMINAL" }, { name: "description", content: "Compare 2–6 sites on type, color, layout and voice, and find the open territory none of them use yet." },
      { property: "og:title", content: "New competitive audit — DSGN/TERMINAL" }, { property: "og:description", content: "A printable competitive audit for a pitch or kickoff." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }],
    links: fontLinks(),
  }),
  component: Page,
});
function Page() { const { sites } = Route.useSearch(); return <AuditNew sites={sites} />; }
