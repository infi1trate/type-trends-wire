import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Data stories: anonymous SELECT-only reads assembled by pure models in src/lib/data-stories/. No AI per view.
export const getDataIndex = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDataIndex } = await import("./data-stories/page.server");
  return loadDataIndex();
});
export const getDataStory = createServerFn({ method: "GET" }).inputValidator(z.object({ slug: z.string().min(1).max(80) })).handler(async ({ data }) => {
  const { loadDataStory } = await import("./data-stories/page.server");
  return loadDataStory(data.slug);
});
export const getTrackedBrands = createServerFn({ method: "GET" }).handler(async () => {
  const { loadTrackedBrands } = await import("./data-stories/page.server");
  return loadTrackedBrands();
});
export const getWhereYouSit = createServerFn({ method: "GET" }).inputValidator(z.object({ brand: z.string().max(260) })).handler(async ({ data }) => {
  const { loadWhereYouSit } = await import("./data-stories/page.server");
  return loadWhereYouSit(data.brand);
});
