import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const { libraryRows, libraryEvents, librarySectors } = await import("./library-store.server");
  const { aiTrends } = await import("./ai-public-store.server");
  const [rows, events, sectors] = await Promise.all([libraryRows(), libraryEvents({ since_days: 7, limit: 100 }), librarySectors()]);
  return { rows, events, sectors, ai: await aiTrends() };
});
export const getLibrarySite = createServerFn({ method: "GET" }).inputValidator(z.object({ domain: z.string().min(3).max(253) })).handler(async ({ data }) => {
  const { librarySite } = await import("./library-store.server");
  return librarySite(data.domain.toLowerCase());
});