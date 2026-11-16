import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { trackedBrandsQuery, whereYouSitQuery } from "@/lib/data";
import { fontLinks } from "@/lib/digest/meta";
import { parseStep, stepParam } from "@/lib/data-stories/stepper";
import { WhereYouSitView } from "@/components/data/WhereYouSitView";
import { DigestNotFound } from "@/components/digest/NotFound";
import { BRAND_NAME } from "@/lib/brand";

const TITLE = `Where does your brand sit? · ${BRAND_NAME}`;
const DESC = "Pick a tracked brand and get its own short data story: where it sits in its sector, its homepage through time, and the signals that set it apart.";
export const Route = createFileRoute("/data/where-you-sit")({
  validateSearch: (s: Record<string, unknown>): { brand?: string | undefined; step?: number | undefined } => {
    const n = typeof s["step"] === "number" ? s["step"] : typeof s["step"] === "string" ? Number.parseInt(s["step"], 10) : NaN;
    return { ...(typeof s["brand"] === "string" && s["brand"] ? { brand: s["brand"].slice(0, 260) } : {}), ...(Number.isFinite(n) ? { step: n } : {}) };
  },
  loaderDeps: ({ search }) => ({ brand: search.brand ?? "" }),
  loader: ({ context, deps }) => Promise.all([context.queryClient.ensureQueryData(trackedBrandsQuery()), context.queryClient.ensureQueryData(whereYouSitQuery(deps.brand))]).then(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }], links: fontLinks() }),
  component: WhereYouSit,
  errorComponent: () => <DigestNotFound title="This page didn't load" body="The stored data behind it couldn't be read just now. Try again in a minute." />,
});
function WhereYouSit() {
  const { brand = "", step } = Route.useSearch(), nav = useNavigate({ from: "/data/where-you-sit" });
  const { data: brands } = useSuspenseQuery(trackedBrandsQuery()), { data: result } = useSuspenseQuery(whereYouSitQuery(brand));
  const n = result.kind === "story" ? result.story.steps.length : 0, [k, setK] = useState(() => parseStep(step, n));
  useEffect(() => { setK(parseStep(step, n)); }, [brand]); // eslint-disable-line react-hooks/exhaustive-deps
  const onStep = useCallback((j: number) => { setK(j); void nav({ search: prev => ({ ...prev, step: stepParam(j) }), replace: true, resetScroll: false }); }, [nav]);
  return <WhereYouSitView brands={brands} result={result} step={k} onStep={onStep} />;
}
