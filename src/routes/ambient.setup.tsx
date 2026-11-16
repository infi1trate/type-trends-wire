import { createFileRoute } from "@tanstack/react-router";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";
import { AmbientSetup } from "@/components/ambient/AmbientSetup";

const TITLE = `Set up the studio board — ${BRAND_NAME}`;
const DESC = "How to put the studio board on a screen across the room: how long each scene stays, which sector leads, which scenes play, and kiosk mode in plain words.";
export const Route = createFileRoute("/ambient/setup")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "article" }, { property: "og:url", content: `${SITE_URL}/ambient/setup` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/ambient/setup` }, ...fontLinks()] }),
  component: AmbientSetup,
});
