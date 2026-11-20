// Leading indicators (W2): server functions behind the /signals/leading query options in data.ts (anonymous SELECT-only reads).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getIndicatorsHead = createServerFn({ method: "GET" }).handler(async () => {
  const { indicatorsHead } = await import("./indicators/read.server");
  return indicatorsHead();
});
export const getIndicators = createServerFn({ method: "GET" }).handler(async () => {
  const { indicatorsBody } = await import("./indicators/read.server");
  return indicatorsBody();
});
export const getIndicatorPoints = createServerFn({ method: "GET" }).inputValidator(z.object({ label: z.string().min(1).max(120) })).handler(async ({ data }) => {
  const { indicatorPoints } = await import("./indicators/read.server");
  return indicatorPoints(data.label);
});
