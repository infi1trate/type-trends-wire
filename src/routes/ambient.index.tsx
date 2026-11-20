import { useMemo } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ambientQuery } from "@/lib/data";
import { parseAmbient } from "@/lib/ambient/playlist";
import { fontLinks } from "@/lib/digest/meta";
import { SITE_URL } from "@/lib/site";
import { BRAND_NAME } from "@/lib/brand";
import { AmbientBoard, AmbientWaiting } from "@/components/ambient/AmbientBoard";

const TITLE = `Studio board — ${BRAND_NAME}`;
const DESC = "A hands-off board for a studio wall: the lead story, the newest stories, the chart of the day, a recent move, a collection, the day's figure and a study, one scene at a time.";
type Search = { dwell?: string; sector?: string; scenes?: string };
export const Route = createFileRoute("/ambient/")({
  staticData: { mode: "dark" },
  validateSearch: (s: Record<string, unknown>): Search => Object.fromEntries((["dwell", "sector", "scenes"] as const).flatMap(k => { const v = s[k], t = Array.isArray(v) ? v.join(",") : typeof v === "string" || typeof v === "number" ? String(v) : null; return t ? [[k, t.slice(0, 120)]] : []; })) as Search,
  loaderDeps: ({ search }) => ({ sector: parseAmbient(search).sector }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(ambientQuery(deps.sector)).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE_URL}/ambient` }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: `${SITE_URL}/ambient` }, ...fontLinks()] }),
  component: Board,
  errorComponent: Waiting,
});
function Board() {
  const { dwell, sector, scenes } = Route.useSearch();
  const opts = useMemo(() => parseAmbient({ dwell, sector, scenes }), [dwell, sector, scenes]);
  return <AmbientBoard opts={opts} />;
}
function Waiting() {
  const router = useRouter();
  return <AmbientWaiting retry={() => void router.invalidate()} />;
}
