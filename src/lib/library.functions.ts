import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { historyInput } from "./library-history";
export const getLibraryHistory = createServerFn({method:"GET"}).inputValidator(historyInput).handler(async()=>{
 const {historyDashboard}=await import("./library-history.server");return historyDashboard();
});
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => (await import("./library-read.server")).loadLibrary());
export const getLibrarySite = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { librarySite } = await import("./library-store.server");
  return librarySite(data.domain.toLowerCase());
});