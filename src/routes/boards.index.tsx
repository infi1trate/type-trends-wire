import { createFileRoute } from "@tanstack/react-router";
import { referenceKitQuery } from "@/lib/data";
import { BoardIndexView } from "@/components/read/Boards";
import { fontLinks } from "@/lib/digest/meta";
export const Route = createFileRoute("/boards/")({
  staticData: { views: true },
  validateSearch: (s: Record<string,unknown>): { view?: string | undefined } => typeof s["view"] === "string" ? {view:s["view"]} : {},
  loader: ({context})=>context.queryClient.ensureQueryData(referenceKitQuery()).then(()=>undefined),
  head:()=>({meta:[{title:"Reference boards · slug"},{name:"description",content:"Every brand showing a design signal, from stored homepage readings."},{property:"og:title",content:"Reference boards · slug"},{property:"og:description",content:"Browse type, colour, layout, voice and page structure across the homepages slug reads."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}],links:fontLinks()}),
  component:()=> <BoardIndexView view={Route.useSearch().view}/>,
  errorComponent:()=> <p role="alert">Reference boards could not be read.</p>,
  notFoundComponent:()=> <p>No reference board found.</p>,
});