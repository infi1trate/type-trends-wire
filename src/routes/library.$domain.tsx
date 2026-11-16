import { say as sayState } from "@/lib/voice";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { librarySiteQuery } from "@/lib/data";
import { LibrarySite } from "@/components/terminal/LibrarySite";
import { BRAND_NAME } from "@/lib/brand";
export const Route = createFileRoute("/library/$domain")({
  staticData: { mode: "dark" },
  validateSearch: (s: Record<string, unknown>): { viewport?: string; page_type?: string; a?: string; b?: string } => ({ viewport: typeof s["viewport"] === "string" ? s["viewport"] : "desktop", page_type: typeof s["page_type"] === "string" ? s["page_type"] : "home", a: typeof s["a"] === "string" ? s["a"] : "", b: typeof s["b"] === "string" ? s["b"] : "" }),
  loader: async ({ context, params }) => { const site = await context.queryClient.ensureQueryData(librarySiteQuery(params.domain)); if (!site) throw notFound(); },
  head: ({ params }) => ({ meta: [{ title: `${params.domain} — ${BRAND_NAME}` }, { name: "description", content: `Design fingerprint and change history for ${params.domain} in the ${BRAND_NAME} library.` }, { property: "og:title", content: `${params.domain} — ${BRAND_NAME}` }, { property: "og:description", content: `Measured typography, palette, layout and design changes for ${params.domain}.` }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => { const { domain } = Route.useParams(); return <LibrarySite domain={domain}/>; },
  notFoundComponent: () => <main className="p-3"><h1 className="text-hero">{sayState("library.notFound").title}</h1><p className="t-say mt-2">{sayState("library.notFound").text}</p><Link className="label mt-3 inline-block" to="/terminal" search={{ panel: "library" }}>← F11 LIBRARY</Link></main>,
  errorComponent: () => <main className="p-3" role="alert"><h1 className="text-hero">{sayState("library.failed").title}</h1><p className="t-say mt-2">{sayState("library.failed").text}</p><Link to="/terminal" search={{ panel: "library" }}>← F11 LIBRARY</Link></main>,
});