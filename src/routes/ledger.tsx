import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ledgerQuery } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { fontLinks } from "@/lib/digest/meta";
import { LedgerView } from "@/components/digest/LedgerView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `The Ledger — every forecast call, scored · ${BRAND_NAME}`;
const DESC = `Every call the ${BRAND_NAME} forecast makes, recorded as made and scored when its quarter closes: hits, misses and voids, with the rule that picks them.`;
export const Route = createFileRoute("/ledger")({
  loader: ({ context }) => context.queryClient.ensureQueryData(ledgerQuery()).then(() => undefined),
  head: () => ({
    meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/ledger` }, { name: "twitter:card", content: "summary" }],
    links: [{ rel: "canonical", href: `${SITE_URL}/ledger` }, ...fontLinks()],
  }),
  component: Ledger,
  errorComponent: () => <DigestNotFound v="ledger.failed" />,
});
function Ledger() { const { data } = useSuspenseQuery(ledgerQuery()); return <LedgerView ledger={data} />; }
