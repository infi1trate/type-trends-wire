import { z } from "zod";
import { librarySyncPayload, librarySnapshotsPayload } from "./library-payload";
import { CRAWL_INDEXES, GALLERIES } from "./curation";

export const CRAWL_BODY_LIMIT = 2 * 1024 * 1024;
const runId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const iso = z.iso.datetime({ offset: true });
const object = z.record(z.string(), z.json());
const site = z.object({
  run_id: runId,
  domain: z.string().min(1).max(253),
  index: z.enum(CRAWL_INDEXES),
  galleries: z.array(z.enum(GALLERIES)).max(10).optional(),
  crawled_at: iso,
  ok: z.boolean(),
  error: z.string().max(200).nullable().optional(),
  final_url: z.url().nullable().optional(),
  title: z.string().max(300).nullable().optional(),
  lang: z.string().max(35).nullable().optional(),
  type: object.optional(), color: object.optional(), layout: object.optional(),
  composition: object.optional(), lexicon: object.optional(), tech: object.optional(),
}).strict();

export const crawlPayload = z.discriminatedUnion("kind", [
  librarySyncPayload,
  librarySnapshotsPayload,
  z.object({ kind: z.literal("start"), run_id: runId, started_at: iso,
    seeds_meta: object.nullable(), target_per_index: z.number().int() }).strict(),
  z.object({ kind: z.literal("sites"), run_id: runId, sites: z.array(site).min(1).max(100) }).strict(),
  z.object({ kind: z.literal("finish"), run_id: runId, finished_at: iso, stats: object }).strict(),
]).superRefine((payload, ctx) => {
  if (payload.kind !== "sites") return;
  payload.sites.forEach((entry, i) => {
    if (entry.run_id !== payload.run_id) ctx.addIssue({ code: "custom", path: ["sites", i, "run_id"], message: "Site run_id must match batch run_id" });
  });
});