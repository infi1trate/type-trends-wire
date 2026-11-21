// E5 · one line above a stored weekly brief that cites changes later withdrawn, linking to that week's corrected Digest. The stored
// brief itself is never rewritten. Loads after the panel (never in front of it); renders nothing until it knows, or when none were.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { briefWithdrawnQuery } from "@/lib/data";

export function BriefWithdrawn({ week, className = "" }: { week: string | null | undefined; className?: string }) {
  const { data } = useQuery({ ...briefWithdrawnQuery(week ?? ""), enabled: !!week && /^\d{4}-W\d{2}$/.test(week) });
  if (!data) return null;
  const [lead, rest] = data.line.split(" See ");
  return <p className={`label ${className}`.trim()} role="note" data-brief-withdrawn={data.n}>{lead} <Link to={data.href as "/"} className="underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">See {rest}</Link></p>;
}
