import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { librarySiteQuery } from "@/lib/data";
import { LibrarySite } from "@/components/terminal/LibrarySite";
export const Route = createFileRoute("/library/$domain")({
  validateSearch: (s: Record<string, unknown>): { viewport?: string; page_type?: string; a?: string; b?: string } => ({ viewport: typeof s["viewport"] === "string" ? s["viewport"] : "desktop", page_type: typeof s["page_type"] === "string" ? s["page_type"] : "home", a: typeof s["a"] === "string" ? s["a"] : "", b: typeof s["b"] === "string" ? s["b"] : "" }),
  loader: async ({ context, params }) => { const site = await context.queryClient.ensureQueryData(librarySiteQuery(params.domain)); if (!site) throw notFound(); },
  head: ({ params }) => ({ meta: [{ title: `${params.domain} — DSGN/TERMINAL` }, { name: "description", content: `Design fingerprint and change history for ${params.domain} in the DSGN/TERMINAL library.` }, { property: "og:title", content: `${params.domain} — DSGN/TERMINAL` }, { property: "og:description", content: `Measured typography, palette, layout and design changes for ${params.domain}.` }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => { const { domain } = Route.useParams(); return <LibrarySite domain={domain}/>; },
  notFoundComponent: () => <main className="p-3"><h1 className="text-hero">404 · DOMAIN NOT IN LIBRARY</h1><Link className="label mt-3 inline-block" to="/terminal" search={{ panel: "library" }}>← F11 LIBRARY</Link></main>,
  errorComponent: () => <main className="p-3" role="alert"><h1 className="text-hero">LIBRARY UNAVAILABLE</h1><Link to="/terminal" search={{ panel: "library" }}>← F11 LIBRARY</Link></main>,
});