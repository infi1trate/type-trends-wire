import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createSchema, opSchema } from "./agency/watch";
// Watchlists + audits. These run behind the site password gate; the watchlists table itself is service-role only.
const ip = () => getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
const id22 = z.string().max(40);

export const createWatchlist = createServerFn({ method: "POST" }).inputValidator(createSchema).handler(async ({ data }) => {
  const m = await import("./agency/watch.server");
  return m.createWatch(data, ip(), await m.prodDeps());
});
export const editWatchlist = createServerFn({ method: "POST" }).inputValidator(z.object({ id: id22, token: id22, op: opSchema }).strict()).handler(async ({ data }) => {
  const m = await import("./agency/watch.server");
  return m.editWatch(data, ip(), await m.prodDeps());
});
export const checkWatchEdit = createServerFn({ method: "POST" }).inputValidator(z.object({ id: id22, token: id22 }).strict()).handler(async ({ data }) => {
  const m = await import("./agency/watch.server");
  return m.checkEdit(data, ip(), await m.prodDeps("check"));
});
export const getWatchView = createServerFn({ method: "GET" }).inputValidator(z.object({ id: id22, range: z.enum(["week", "30d"]) }).strict()).handler(async ({ data }) => {
  const m = await import("./agency/watch.server");
  return m.viewWatch(data.id, data.range, await m.prodDeps("check"));
});
/** Choices for the create/edit forms: active library domains and the latest forecast's traits. */
export const getWatchOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAnon } = await import("./mcp/supabase");
  const { label } = await import("./labels");
  const db = supabaseAnon();
  const [sites, traits] = await Promise.all([
    db.from("library_sites").select("domain,sector").eq("active", true).order("domain").range(0, 999),
    db.from("forecast_latest").select("dimension,value").eq("scope", "all").order("dimension").order("value").range(0, 999),
  ]);
  if (sites.error || traits.error) throw sites.error ?? traits.error;
  return { sites: sites.data ?? [], traits: (traits.data ?? []).map(t => { const k = `${t.dimension}:${t.value}`, l = label(k); return { trait: k, name: l.name, dimension: l.dimension }; }) };
});
export const getAudit = createServerFn({ method: "GET" }).inputValidator(z.object({ sites: z.string().max(800), sector: z.string().max(40).nullable() }).strict()).handler(async ({ data }) => {
  const { parseAuditSites } = await import("./agency/audit");
  const p = parseAuditSites(data.sites);
  if (!p.ok) return { ok: false as const, error: p.error, domains: p.domains };
  const { loadAudit } = await import("./agency/audit.server");
  return { ok: true as const, audit: await loadAudit(p.domains, data.sector) };
});
export const checkAuditDomains = createServerFn({ method: "POST" }).inputValidator(z.object({ domains: z.array(z.string().max(300)).min(1).max(12) }).strict()).handler(async ({ data }) => {
  const { normDomain } = await import("./agency/watch");
  const domains = [...new Set(data.domains.map(normDomain).filter((d): d is string => !!d))];
  const { checkDomains } = await import("./agency/audit.server");
  return { invalid: data.domains.filter(d => !normDomain(d)), sites: await checkDomains(domains) };
});
/** "Not tracked yet — request a render": adds the homepage to the existing render queue (same per-IP limit as watchlist edits). */
export const requestRender = createServerFn({ method: "POST" }).inputValidator(z.object({ domains: z.array(z.string().max(300)).min(1).max(6) }).strict()).handler(async ({ data }) => {
  const { normDomain } = await import("./agency/watch");
  const m = await import("./agency/watch.server");
  const deps = await m.prodDeps();
  if (!deps.allow(ip())) return { ok: false as const, message: "Too many requests from this connection. Try again within the hour." };
  const domains = [...new Set(data.domains.map(normDomain).filter((d): d is string => !!d))];
  const active = await deps.store.activeDomains(domains);
  const queued = domains.filter(d => !active.has(d));
  await m.queueRenders(queued);
  return { ok: true as const, queued };
});
