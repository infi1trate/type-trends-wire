import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Digest + explainer reads: anonymous SELECT-only, assembled by pure issueModel/traitModel (no AI per view).
export const getIssue = createServerFn({ method: "GET" }).inputValidator(z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/).nullable() })).handler(async ({ data }) => {
  const { loadIssue } = await import("./digest/digest.server");
  return loadIssue(data.week);
});
export const getArchive = createServerFn({ method: "GET" }).handler(async () => {
  const { loadArchive } = await import("./digest/digest.server");
  return loadArchive();
});
export const getTrait = createServerFn({ method: "GET" }).inputValidator(z.object({ key: z.string().min(3).max(120) })).handler(async ({ data }) => {
  const { loadTrait } = await import("./digest/digest.server");
  return loadTrait(data.key);
});
export const getTraitHead = createServerFn({ method: "GET" }).inputValidator(z.object({ key: z.string().min(3).max(120) })).handler(async ({ data }) => {
  const { loadTraitHead } = await import("./digest/digest.server");
  return loadTraitHead(data.key);
});
/** E5 · the terminal's weekly brief line: how many changes the stored brief for this week cites that were later withdrawn. */
export const getBriefWithdrawn = createServerFn({ method: "GET" }).inputValidator(z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/) })).handler(async ({ data }) => {
  const { loadIssue } = await import("./digest/digest.server");
  const i = await loadIssue(data.week).catch(() => null);
  const { withdrawnBriefLine } = await import("./digest/edition");
  return i && i.briefWithdrawn > 0 ? { n: i.briefWithdrawn, line: withdrawnBriefLine(i.briefWithdrawn), href: `/digest/${i.week}` } : null;
});
