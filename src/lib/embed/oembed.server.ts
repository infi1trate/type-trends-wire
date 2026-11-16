import { z } from "zod";
import { SITE_URL } from "../site";
import { embedSrc, embedTarget, oembedResponse } from "./embed";
const H = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex" };
const err = (status: number, error: string) => Response.json({ error }, { status, headers: H });
const query = z.object({ url: z.string().min(1).max(500), format: z.enum(["json"]).optional(), maxwidth: z.coerce.number().int().positive().max(10000).optional(), maxheight: z.coerce.number().int().positive().max(10000).optional() });
export async function handleOembed(request: Request, load?: { trait: (k: string) => Promise<{ title: string } | null>; chart: (w: string) => Promise<{ title: string } | null> }) {
  const u = new URL(request.url), raw = Object.fromEntries(u.searchParams);
  if (raw["format"] && raw["format"] !== "json") return err(501, "only format=json is supported");
  const p = query.safeParse(raw); if (!p.success) return err(400, "url is required");
  let page: URL; try { page = new URL(p.data.url); } catch { return err(404, "not an embeddable URL"); }
  const allowed = new Set([new URL(SITE_URL).host, u.host]);
  if (!/^https?:$/.test(page.protocol) || !allowed.has(page.host)) return err(404, "not an embeddable URL");
  const target = embedTarget(page.pathname); if (!target) return err(404, "not an embeddable URL");
  const ld = load ?? await (async () => { const s = await import("./embed.server"); return { trait: (k: string) => s.loadTraitEmbed(k), chart: (w: string) => s.loadChartEmbed(w) }; })();
  const m = await (target.kind === "trait" ? ld.trait(target.key) : ld.chart(target.week)).catch(() => null);
  if (!m) return err(404, "not found");
  const theme = page.searchParams.get("theme") === "light" ? "light" : "dark";
  return Response.json(oembedResponse(embedSrc(target, { theme }), m.title, p.data.maxwidth, p.data.maxheight), { headers: H });
}
