import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { signalsQuery } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { fontLinks } from "@/lib/digest/meta";
import { WhatWeShowView } from "@/components/digest/WhatWeShowView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `What we show and why · ${BRAND_NAME}`;
const DESC = `How ${BRAND_NAME} decides which design signals deserve attention: three jobs, four questions, three tiers, twelve composite signals, and how Momentum and Confidence are derived.`;
export const Route = createFileRoute("/what-we-show")({
  loader: ({ context }) => context.queryClient.ensureQueryData(signalsQuery()).then(() => undefined),
  head: () => ({
    meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/what-we-show` }, { name: "twitter:card", content: "summary" }],
    links: [{ rel: "canonical", href: `${SITE_URL}/what-we-show` }, ...fontLinks()],
  }),
  component: WhatWeShow,
  errorComponent: () => <DigestNotFound v="whatWeShow.failed" />,
});
function WhatWeShow() { const { data } = useSuspenseQuery(signalsQuery()); return <WhatWeShowView tiers={data.tiers} signals={data.signals} runId={data.snap.run_id} />; }
