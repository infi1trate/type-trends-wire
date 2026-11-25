import { z } from "zod";

export const librarySector = z.enum(["ai", "dev-tools", "fintech", "consumer-apps", "commerce-dtc", "media", "studios", "hardware", "health", "enterprise-saas"]);
export const libraryDomain = z.string().min(3).max(253).regex(/^(?!www\.)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
export const libraryPageType = z.enum(["home", "pricing", "changelog", "product", "about"]);
const hash = z.string().min(1).max(256);
const url = z.url().max(2048).refine(value => /^https?:\/\//.test(value), "HTTP(S) URL required");
const runId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const librarySignals = z.object({
  type: z.record(z.string(), z.json()).optional(),
  color: z.record(z.string(), z.json()).optional(),
  layout: z.record(z.string(), z.json()).optional(),
  composition: z.record(z.string(), z.json()).optional(),
  lexicon: z.record(z.string(), z.json()).optional(),
  tech: z.record(z.string(), z.json()).optional(),
  css_features: z.array(z.string().max(200)).max(1000).optional(),
  nav: z.array(z.object({ label: z.string().max(500), href: z.string().max(2048), depth: z.number().int().min(0).max(100) }).passthrough()).max(1000).optional(),
  skeleton: z.array(z.object({ x: z.number().finite(), y: z.number().finite(), w: z.number().min(0), h: z.number().min(0), kind: z.string().max(100) }).passthrough()).max(400).optional(),
}).catchall(z.json());
export const librarySnapshot = z.object({
  domain: libraryDomain,
  page_type: libraryPageType,
  viewport: z.enum(["desktop", "mobile"]),
  source: z.enum(["live", "wayback"]).default("live"),
  captured_at: z.iso.datetime({ offset: true }),
  url,
  html_hash: hash.nullable().optional(),
  content_hash: hash.nullable().optional(),
  signals_hash: hash.nullable().optional(),
  signals: librarySignals,
  raw_text: z.string().max(50000).optional(),
  discovered_pages: z.partialRecord(libraryPageType, url).optional(),
}).strict();
export const librarySyncPayload = z.object({
  kind: z.literal("library_sync"),
  sites: z.array(z.object({ domain: libraryDomain, sector: librarySector, name: z.string().max(300).optional(), category: z.string().max(60).optional(), subcategory: z.string().max(60).optional() }).strict()).max(1000),
}).strict().refine(value => new Set(value.sites.map(site => site.domain)).size === value.sites.length, "Duplicate domains");
export const librarySnapshotsPayload = z.object({
  kind: z.literal("library_snapshots"),
  run_id: runId.optional(),
  snapshots: z.array(librarySnapshot).min(1).max(25),
}).strict();
export type LibrarySnapshot = z.infer<typeof librarySnapshot>;