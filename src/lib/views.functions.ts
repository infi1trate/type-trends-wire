import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// U1 + U2 · Data views, receipts and the row → story lookup: anonymous SELECT-only reads shaped by pure models (no AI per view).
export const getStoryRows = createServerFn({ method: "GET" }).handler(async () => {
  const { loadStoryRows } = await import("./views/views.server");
  return loadStoryRows();
});
export const getStoryData = createServerFn({ method: "GET" }).inputValidator(z.object({ id: z.string().min(3).max(200) })).handler(async ({ data }) => {
  const { loadStoryData } = await import("./views/views.server");
  return loadStoryData(data.id);
});
export const getReceipt = createServerFn({ method: "GET" }).inputValidator(z.object({ r: z.string().min(3).max(240) })).handler(async ({ data }) => {
  const { loadReceipt } = await import("./views/views.server");
  return loadReceipt(data.r);
});
export const getStudyData = createServerFn({ method: "GET" }).inputValidator(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) })).handler(async ({ data }) => {
  const { loadStudyData } = await import("./views/views.server");
  return loadStudyData(data.slug);
});
export const getWeekData = createServerFn({ method: "GET" }).inputValidator(z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/) })).handler(async ({ data }) => {
  const { loadWeekData } = await import("./views/views.server");
  return loadWeekData(data.week);
});
