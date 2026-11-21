import { createFileRoute } from "@tanstack/react-router";
import { colophonQuery } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { DigestNotFound } from "@/components/digest/NotFound";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { ColophonData, ColophonRead } from "@/components/read/ColophonView";
import { COLOPHON_DECK, COLOPHON_TITLE } from "@/lib/living/colophon";

// L1 · how slug's own design changes, edition by edition. Read view and Data view (?view=data) at the same address, like
// /signals/leading; the Data view is never indexed.
const TITLE = `${COLOPHON_TITLE} — how slug's design changes, edition by edition · ${BRAND_NAME}`;
const DESC = "What never moves, the design settings that may move with their limits and current values, every edition with its reason, and what the next one would propose today.";
type Search = { view?: "data" | undefined };
export const Route = createFileRoute("/colophon")({
  validateSearch: (s: Record<string, unknown>): Search => (s["view"] === "data" ? { view: "data" } : {}),
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  loader: ({ context, deps }) => { void context.queryClient.prefetchQuery(colophonQuery()); return { data: deps.data }; },
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData?.data ? `${COLOPHON_TITLE} — data · ${BRAND_NAME}` : TITLE }, { name: "description", content: DESC },
    ...(loaderData?.data ? [{ name: "robots", content: "noindex" }] : []),
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/colophon` }, { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: `${SITE_URL}/colophon` }] }),
  component: Colophon,
  errorComponent: () => <DigestNotFound v="colophon.failed" />,
});
function Colophon() {
  const { view } = Route.useSearch(), data = view === "data";
  return <DigestShell label={COLOPHON_TITLE} section="tools">
    <TitleBlock kicker={`Tools · ${data ? "Data view" : "Colophon"}`} title="How this site's design changes" deck={<p className="ed-standfirst mt-5 max-w-[62ch]">{COLOPHON_DECK}</p>} />
    <Later id="colophon-later" shapes={data ? [{ kind: "rows", n: 16, height: ROW.terminal * 1.5 }] : [{ kind: "block", height: 40 }, { kind: "rows", n: 8, height: ROW.compact }, { kind: "block", height: 40 }]} className="mt-2">
      {data ? <ColophonData /> : <ColophonRead />}
    </Later>
  </DigestShell>;
}
