import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { traitPageQuery } from "@/lib/data";
import { traitHead } from "@/lib/digest/meta";
import { TraitView } from "@/components/digest/TraitView";
import { DigestNotFound } from "@/components/digest/NotFound";

export const Route = createFileRoute("/trait/$key")({
  loader: async ({ context, params }) => {
    if (!/^[a-z0-9_]+:[^\s]{1,80}$/i.test(params.key)) throw notFound();
    const page = await context.queryClient.ensureQueryData(traitPageQuery(params.key));
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => loaderData?.page ? traitHead(loaderData.page) : { meta: [{ title: "Signal not found — DSGN/TERMINAL" }, { name: "robots", content: "noindex" }] },
  component: Trait,
  notFoundComponent: () => <DigestNotFound title="No explainer for this signal" body="We only write explainers for signals in the latest weekly forecast. The key may be misspelled, or the signal may have dropped out of the forecast." />,
  errorComponent: () => <DigestNotFound title="This explainer didn't load" body="The data behind it couldn't be read just now. Try again in a minute." />,
});
function Trait() {
  const { key } = Route.useParams();
  const { data } = useSuspenseQuery(traitPageQuery(key));
  return data ? <TraitView page={data} /> : null;
}
