// Image endpoints for /chart/<week>.svg|png; 404 for malformed weeks or weeks without a stored card.
import { parseCardParam } from "./model";
import { cardScene, renderCardSvg } from "./card";
import type { StoredCard } from "./chart.server";
export const CARD_CACHE = "public, max-age=3600, s-maxage=86400";
export async function chartImageResponse(param: string, format: "svg" | "png", load?: (week: string) => Promise<StoredCard | null>) {
  const p = parseCardParam(param);
  if (!p) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const card = await (load ?? (async (w: string) => (await import("./chart.server")).chartCard(w)))(p.week);
  if (!card) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (format === "svg") return new Response(renderCardSvg(card.model, p.size), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": CARD_CACHE } });
  const { renderScenePng } = await import("./raster");
  const png = await renderScenePng(cardScene(card.model, p.size));
  return new Response(png as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": CARD_CACHE, "Content-Length": String(png.length) } });
}
