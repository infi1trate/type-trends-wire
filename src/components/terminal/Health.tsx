import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { healthQuery } from "@/lib/data";
import type { JobHealth } from "@/lib/health";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/terminal/primitives";

const when = (iso: string | null) => (iso ? iso.slice(5, 16).replace("T", " ") : "—");

/** Status-bar HEALTH line: grey when OK, the signal color when degraded/down. Click opens the job table. */
export function HealthLine() {
  const { data } = useQuery(healthQuery());
  const [open, setOpen] = useState(false);
  const status = data?.status ?? null;
  const bad = status === "degraded" || status === "down";
  return <>
    <Button variant="link" aria-label={`System health: ${status ?? "loading"}. Open job table`} onClick={() => setOpen(true)} className={`label h-6 px-2 max-md:h-10 ${bad ? "text-signal" : "text-g500"}`}>
      <span className="max-sm:hidden">HEALTH&nbsp;</span>{status ? status.toUpperCase() : "—"}
    </Button>
    {open && <Overlay title={`HEALTH · ${status?.toUpperCase() ?? "—"}`} onClose={() => setOpen(false)}>
      {!data ? <p className="text-g500">▍</p> : <>
        <p className="label mb-2 text-g500">CHECKED {when(data.checked_at)} UTC · STALE = LAST OK OLDER THAN 2× INTERVAL · GET /api/public/health</p>
        {data.jobs.length === 0 ? <p className="text-signal">HEALTH DATA UNAVAILABLE</p> :
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">Scheduled job health</caption>
            <thead><tr className="label text-left text-g500"><th scope="col" className="py-1 pr-2 font-normal">JOB</th><th scope="col" className="py-1 pr-2 font-normal">EVERY</th><th scope="col" className="py-1 pr-2 font-normal">LAST OK</th><th scope="col" className="py-1 font-normal">STATUS</th></tr></thead>
            <tbody>{data.jobs.map((j: JobHealth) => <tr key={j.job} className="border-t border-rule align-top">
              <th scope="row" className="py-1 pr-2 text-left font-normal text-ink">{j.job.replace(/_/g, " ").toUpperCase()}{j.note && <div className="label text-g500">{j.note}</div>}</th>
              <td className="py-1 pr-2 text-g500">{j.expected_every}</td>
              <td className="py-1 pr-2 text-ink whitespace-nowrap">{when(j.last_ok_at)}</td>
              <td className={`py-1 ${j.stale || j.last_status === "low_ok_rate" ? "text-signal" : "text-ink"}`}>{j.stale ? "STALE" : j.last_status.toUpperCase()}{j.consecutive_failures > 0 && ` · ${j.consecutive_failures}✕`}</td>
            </tr>)}</tbody>
          </table>}
      </>}
    </Overlay>}
  </>;
}
