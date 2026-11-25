import { createFileRoute } from "@tanstack/react-router";
import { referenceKitQuery } from "@/lib/data";
import { BoardIndexView } from "@/components/read/Boards";
import { fontLinks } from "@/lib/digest/meta";
import { dataViewHead, DATA_VIEW_HEADERS } from "@/lib/views/head";
export const Route = createFileRoute("/boards/")({
  staticData: { views: true },
  validateSearch: (s: Record<string,unknown>): { view?: string | undefined } => typeof s["view"] === "string" ? {view:s["view"]} : {},
  // The Data view is never indexed and points back to the Read address, like every other page with two views.
  loaderDeps: ({ search }) => ({ data: search.view === "data" }),
  loader: ({context, deps})=>context.queryClient.ensureQueryData(referenceKitQuery()).then(()=>({ data: deps.data })),
  headers: ({ loaderData }) => (loaderData?.data ? DATA_VIEW_HEADERS : undefined),
  head:({ loaderData })=> loaderData?.data ? dataViewHead({ type: "pattern", id: "boards" }, "Reference boards", "/boards") : ({meta:[{title:"Reference boards · slug"},{name:"description",content:"Every brand showing a design signal, from stored homepage readings."},{property:"og:title",content:"Reference boards · slug"},{property:"og:description",content:"Browse type, colour, layout, voice and page structure across the homepages slug reads."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}],links:fontLinks()}),
  component:()=> <BoardIndexView view={Route.useSearch().view}/>,
  errorComponent:()=> <p role="alert">Reference boards could not be read.</p>,
  notFoundComponent:()=> <p>No reference board found.</p>,
});