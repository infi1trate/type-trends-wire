// R2b · the one restatement line, for 14 days after a panel step (wording in restatement.ts). Reads the stored panel steps after
// hydration only, so server render and the first client render agree, and renders without a query client show nothing.
import { useContext, useEffect, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { panelStepsQuery } from "@/lib/data";
import { restatedLine } from "@/lib/restatement";

export function useRestatedLine(now = Date.now()): string | null {
  const client = useContext(QueryClientContext), [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!client) return;
    let live = true;
    client.fetchQuery(panelStepsQuery()).then(d => { if (live) setLine(restatedLine(d.steps.at(-1) ?? null, now)); }).catch(() => undefined);
    return () => { live = false; };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps
  return line;
}
