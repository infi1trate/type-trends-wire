import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { WatchNew } from "@/components/agency/WatchNew";

export const Route = createFileRoute("/watch/new")({
  validateSearch: (s: Record<string, unknown>): { add?: string | undefined; name?: string | undefined } => ({ add: typeof s["add"] === "string" ? s["add"].slice(0, 2000) : undefined, name: typeof s["name"] === "string" ? s["name"].slice(0, 80) : undefined }),
  head: () => ({
    meta: [{ title: "New watchlist — DSGN/TERMINAL" }, { name: "description", content: "Watch a client's competitive set: confirmed design changes on up to 25 sites and 25 signals, with an RSS feed." },
      { property: "og:title", content: "New watchlist — DSGN/TERMINAL" }, { property: "og:description", content: "Watch a competitive set's design changes, with an RSS feed. No account needed." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }],
    links: fontLinks(),
  }),
  component: Page,
});
function Page() { const s = Route.useSearch(); return <WatchNew add={s.add} name={s.name} />; }
