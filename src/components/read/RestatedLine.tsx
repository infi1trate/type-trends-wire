// R2b · the one restatement line, for 14 days after a panel step (wording in restatement.ts). Reads the stored panel steps.
import { useQuery } from "@tanstack/react-query";
import { panelStepsQuery } from "@/lib/data";
import { restatedLine } from "@/lib/restatement";

export function useRestatedLine(now = Date.now()): string | null {
  const p = useQuery(panelStepsQuery());
  return restatedLine(p.data?.steps.at(-1) ?? null, now);
}
