// One quiet line stating when the data last moved; a plain warning only when a job is late. Client-side read (no SSR mismatch);
// renders nothing where no query client exists (static renders in tests). In the shell it is one line that truncates.
import { useContext } from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { freshnessQuery } from "@/lib/data";
import { useStaffKey } from "@/lib/staff-key";

const Blank = () => <span className="shell-fresh no-print min-h-5 min-w-0 flex-1" aria-hidden="true" />;
function Line() {
  const q = useQuery(freshnessQuery()), staff = !!useStaffKey();
  if (!q.data) return <Blank />;
  const { text, late } = q.data.line;
  return <span className={`shell-fresh no-print flex min-w-0 flex-1 items-center gap-2 ${late ? "font-semibold" : ""}`} role={late ? "status" : undefined} data-freshness="">
    <span className="min-w-0 truncate" title={text}>{text}</span>{late && staff && <Link to="/status" className="ed-tap shrink-0 underline">See status</Link>}
  </span>;
}
export function FreshnessLine() { return useContext(QueryClientContext) ? <Line /> : <Blank />; }

function Next() { const q = useQuery(freshnessQuery()); return q.data?.wire_on_time ? <> · next check within 15 minutes</> : null; }
/** Live's "next check within 15 minutes", shown only while the wire job is on time. */
export function NextCheck() { return useContext(QueryClientContext) ? <Next /> : null; }
