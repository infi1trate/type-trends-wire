import { createFileRoute } from "@tanstack/react-router";
import { referenceKitQuery } from "@/lib/data";
import { CompareView } from "@/components/read/CompareView";
import { fontLinks } from "@/lib/digest/meta";
export const Route = createFileRoute("/compare")({
  staticData:{views:true},
  validateSearch:(s:Record<string,unknown>):{a?:string|undefined;b?:string|undefined;c?:string|undefined;view?:string|undefined}=>Object.fromEntries(["a","b","c","view"].flatMap(k=>typeof s[k]==="string"?[[k,s[k]]]:[])),
  loader:({context})=>context.queryClient.ensureQueryData(referenceKitQuery()).then(()=>undefined),
  head:()=>({meta:[{title:"Compare brand homepages · slug"},{name:"description",content:"Two or three brand homepages side by side: measured type, palette, voice, asks and page structure. No scores or winner."},{property:"og:title",content:"Compare brand homepages · slug"},{property:"og:description",content:"Compare stored readings of two or three brands, with matching rows aligned."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}],links:fontLinks()}),
  component:()=> <CompareView search={Route.useSearch()}/>,errorComponent:()=> <p role="alert">These brands could not be read.</p>,notFoundComponent:()=> <p>No brand comparison found.</p>,
});