import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { brandsQuery } from "@/lib/data";
import { CompareBrandSearch } from "./BrandSearch";
export function CompareEntry({domain}: {domain:string}) {
  const {data}=useSuspenseQuery(brandsQuery()), navigate=useNavigate();
  return <CompareBrandSearch brands={data.sites} exclude={[domain]} onChoose={b=>void navigate({to:"/compare",search:{a:domain,b}})}/>;
}