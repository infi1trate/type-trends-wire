import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Forecast ledger reads: anonymous SELECT-only over the append-only ledger (no AI per view).
export const getLedger = createServerFn({ method: "GET" }).inputValidator(z.object({ trait: z.string().max(120).optional() })).handler(async ({ data }) => {
  const { loadLedger } = await import("./ledger/read.server");
  return loadLedger(data.trait ? { trait: data.trait } : {});
});
