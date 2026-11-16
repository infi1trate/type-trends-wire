import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { auditQuery } from "@/lib/data";
import { fontLinks, specimenLink } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { AuditView } from "@/components/agency/AuditView";
import { AgencyShell } from "@/components/agency/Shell";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/audit/")({
  validateSearch: (s: Record<string, unknown>): { sites: string; sector?: string | undefined } => ({ sites: typeof s["sites"] === "string" ? s["sites"].slice(0, 800) : "", sector: typeof s["sector"] === "string" ? s["sector"].slice(0, 40) : undefined }),
  loaderDeps: ({ search }) => ({ sites: search.sites, sector: search.sector ?? null }),
  loader: async ({ context, deps }) => {
    const r = await context.queryClient.ensureQueryData(auditQuery(deps.sites, deps.sector));
    if (!r.ok) return { domains: r.domains, faces: [] as string[] };
    const faces = [...new Set((r.audit.type?.sites ?? []).flatMap(s => [s.h1, s.body]).filter(f => f?.google).map(f => f!.family))];
    return { domains: r.audit.domains, faces };
  },
  head: ({ loaderData }) => {
    const d = loaderData?.domains ?? [], title = d.length ? `Competitive audit: ${d.join(", ")} — ${BRAND_NAME}` : `Competitive audit — ${BRAND_NAME}`;
    const img = d.length >= 2 ? `${SITE_URL}/audit.png?sites=${d.join(",")}` : null;
    return {
      meta: [{ title }, { name: "description", content: `Side-by-side type, color, layout and voice${d.length ? ` for ${d.join(", ")}` : ""}, against the design market.` },
        { property: "og:title", content: d.length ? `Competitive audit: ${d.join(", ")}` : "Competitive audit" }, { property: "og:description", content: `Type, color, layout, voice and open territory, from ${BRAND_NAME}.` },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: img ? "summary_large_image" : "summary" }, { name: "robots", content: "noindex" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }] : [])],
      links: [...fontLinks(), ...(loaderData?.faces ?? []).map(f => specimenLink(f, f))],
    };
  },
  component: Page,
  errorComponent: () => <AgencyShell label="Audit unavailable" crumb="Competitive audit"><div className="ed-wrap py-16"><h1 className="ed-h1">This audit didn't load</h1><p className="ed-body mt-4">The data behind it couldn't be read just now. Try again in a minute.</p></div></AgencyShell>,
});
function Page() {
  const { sites, sector } = Route.useSearch();
  const { data } = useSuspenseQuery(auditQuery(sites, sector ?? null));
  if (!data.ok) return <AgencyShell label="Competitive audit" crumb="Competitive audit"><div className="ed-wrap py-16"><h1 className="ed-h1">{sites ? "This audit needs a different set of sites" : "Start a competitive audit"}</h1><p className="ed-body mt-4">{sites ? data.error : "Choose 2–6 sites to compare."}</p><p className="ed-data mt-6"><Link to="/audit/new" search={{ sites: data.domains.join(",") || undefined }}>Choose sites →</Link></p></div></AgencyShell>;
  return <AuditView a={data.audit} field={data.field} />;
}
