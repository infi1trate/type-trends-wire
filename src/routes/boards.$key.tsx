import { createFileRoute } from "@tanstack/react-router";
import { referenceKitQuery } from "@/lib/data";
import { boardSearch, boardName } from "@/lib/designer-kit";
import { BoardView } from "@/components/read/Boards";
import { fontLinks } from "@/lib/digest/meta";
export const Route = createFileRoute("/boards/$key")({
  staticData:{views:true}, validateSearch:boardSearch,
  loader:({context})=>context.queryClient.ensureQueryData(referenceKitQuery()).then(()=>undefined),
  head:({params})=>({meta:[{title:`${boardName(params.key)} — reference board · slug`},{name:"description",content:`Every brand currently showing ${boardName(params.key).toLowerCase()}, with measured identity and credited crops.`},{property:"og:title",content:`${boardName(params.key)} · slug`},{property:"og:description",content:"A reference board of stored homepage readings, filterable by sector, category and first-seen date."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}],links:fontLinks()}),
  component:()=> <BoardView signal={Route.useParams().key} filters={Route.useSearch()}/>,
  errorComponent:()=> <p role="alert">This reference board could not be read.</p>,notFoundComponent:()=> <p>No reference board found.</p>,
});