// One quiet line stating when the data last moved; a plain warning only when a job is late. Client-side read (no SSR mismatch);
// renders nothing where no query client exists (static renders in tests).
import { useContext } from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { freshnessQuery } from "@/lib/data";

const Blank = () => <p className="ed-wrap ed-small ed-muted no-print min-h-5" aria-hidden="true" />;
function Line() {
  const q = useQuery(freshnessQuery());
  if (!q.data) return <Blank />;
  const { text, late } = q.data.line;
  return <p className={`ed-wrap ed-small no-print min-h-5 ${late ? "font-semibold" : "ed-muted"}`} role={late ? "status" : undefined}>
    {text} {late && <Link to="/status" className="ed-tap underline">See status</Link>}
  </p>;
}
export function FreshnessLine() { return useContext(QueryClientContext) ? <Line /> : <Blank />; }

function Next() { const q = useQuery(freshnessQuery()); return q.data?.wire_on_time ? <> · next check within 15 minutes</> : null; }
/** Live's "next check within 15 minutes", shown only while the wire job is on time. */
export function NextCheck() { return useContext(QueryClientContext) ? <Next /> : null; }
