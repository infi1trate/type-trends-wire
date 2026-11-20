import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { indicatorsHeadQuery, indicatorsQuery } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";
import { DigestShell } from "@/components/digest/Editorial";
import { DigestNotFound } from "@/components/digest/NotFound";
import { Later, ROW, TitleBlock } from "@/components/read/Later";
import { LEADING_DECK, LEADING_TITLE, LeadingData, LeadingRead, lastReadLine } from "@/components/read/LeadingView";

const TITLE = `${LEADING_TITLE} — what builders install before brands show it · ${BRAND_NAME}`;
const DESC = "Weekly npm installs and GitHub stars for the libraries behind the design patterns slug tracks, plus the fastest-rising Google Fonts families. Levels and direction, plainly sourced.";
type Search = { view?: "data" | undefined };
export const Route = createFileRoute("/signals/leading")({
  validateSearch: (s: Record<string, unknown>): Search => (s["view"] === "data" ? { view: "data" } : {}),
  // P1 · shell first: only "when last read" is awaited; the tables and the font ranks stream in.
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery(indicatorsQuery());
    return { head: await context.queryClient.ensureQueryData(indicatorsHeadQuery()) };
  },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/signals/leading` }, { name: "twitter:card", content: "summary" }] }),
  component: Leading,
  errorComponent: () => <DigestNotFound v="leading.failed" />,
});
function Leading() {
  const { view } = Route.useSearch();
  const { data: head } = useSuspenseQuery(indicatorsHeadQuery());
  const data = view === "data";
  return <DigestShell label={LEADING_TITLE} section="signals">
    <TitleBlock kicker={`Signals · ${data ? "Data view" : "Outside numbers"}`} title={LEADING_TITLE}
      deck={<><p className="ed-standfirst mt-5 max-w-[62ch]">{LEADING_DECK}</p><p className="ed-caption mt-3" data-last-read="">{lastReadLine(head.lastRead)}</p></>} />
    <Later id="leading-later" shapes={data ? [{ kind: "rows", n: 24, height: ROW.terminal * 1.5 }] : [{ kind: "block", height: 40 }, { kind: "rows", n: 8, height: ROW.compact }, { kind: "block", height: 40 }, { kind: "rows", n: 6, height: ROW.compact }]} className="ed-wrap mt-8">
      {data ? <LeadingData /> : <LeadingRead />}
    </Later>
  </DigestShell>;
}
