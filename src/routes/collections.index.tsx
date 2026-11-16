import { createFileRoute } from "@tanstack/react-router";
import { collectionsQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { CollectionsIndexView } from "@/components/read/CollectionsViews";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Collections — saved walls of homepage captures · ${BRAND_NAME}`;
const DESC = "Numbered collections from the pattern gallery: fintech heroes, who went big, dark dev-tool pages, what changed this month and more.";
export const Route = createFileRoute("/collections/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(collectionsQuery()).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/collections` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/collections` }, ...fontLinks()] }),
  component: CollectionsIndexView,
  errorComponent: () => <DigestNotFound title="Collections didn't load" body="The stored captures couldn't be read just now. Try again in a minute." />,
  notFoundComponent: () => <DigestNotFound title="No collections here" body="This list doesn't exist. Try the pattern gallery." />,
});
