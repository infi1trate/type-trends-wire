import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { traitPageQuery } from "@/lib/data";
import { traitHead } from "@/lib/digest/meta";
import { resolveSector } from "@/lib/sector-lens";
import { SignalView } from "@/components/read/SignalView";
import { DigestNotFound } from "@/components/digest/NotFound";

export const Route = createFileRoute("/signals/$key")({
  validateSearch: (s: Record<string, unknown>): { sector?: string | undefined } => (typeof s["sector"] === "string" ? { sector: s["sector"] } : {}),
  loader: async ({ context, params }) => {
    if (!/^[a-z0-9_]+:[^\s]{1,80}$/i.test(params.key)) throw notFound();
    const page = await context.queryClient.ensureQueryData(traitPageQuery(params.key));
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => loaderData?.page ? traitHead(loaderData.page) : { meta: [{ title: "Signal not found — DSGN/TERMINAL" }, { name: "robots", content: "noindex" }] },
  component: Signal,
  notFoundComponent: () => <DigestNotFound title="No page for this signal" body="We only write signal pages for signals in the latest weekly forecast. The key may be misspelled, or the signal may have dropped out of the forecast." />,
  errorComponent: () => <DigestNotFound title="This signal page didn't load" body="The data behind it couldn't be read just now. Try again in a minute." />,
});
function Signal() {
  const { key } = Route.useParams();
  const { sector } = Route.useSearch();
  const { data } = useSuspenseQuery(traitPageQuery(key));
  return data ? <SignalView page={data} sector={resolveSector(sector)} /> : null;
}
