// PNG/SVG share images for issues (/digest/<week>.png) and explainers (/trait/<key>.png), via the chart card rasterizer.
import { CARD_CACHE } from "../chart/http.server";
import { cardScene, renderPrimsSvg, type Prim } from "../chart/card";
import { cardModel } from "../chart/model";
import { traitDefinition } from "./copy";
import { label } from "../labels";
import { BRAND_NAME } from "../brand";
import { svgTextStyle } from "../theme";
const nf = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
async function respond(scene: { w: number; h: number; prims: Prim[] }, format: "png" | "svg", alt: string) {
  if (format === "svg") return new Response(renderPrimsSvg(scene.w, scene.h, scene.prims, { label: alt, style: svgTextStyle() }), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": CARD_CACHE } });
  const { renderScenePng } = await import("../chart/raster");
  const png = await renderScenePng(scene);
  return new Response(png as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": CARD_CACHE, "Content-Length": String(png.length) } });
}
export async function issueImage(param: string) {
  const m = /^(\d{4}-W\d{2})\.(png|svg)$/.exec(param) ?? /^(\d{4}-W\d{2})$/.exec(param);
  if (!m) return nf();
  const { issueRows } = await import("./digest.server");
  const { issueModel } = await import("./issue");
  const { issueOgScene } = await import("./og");
  const rows = await issueRows(m[1]!);
  const issue = rows ? issueModel({ ...rows, fonts: null, rebrands: [], thumbs: [] }) : null;
  if (!issue) return nf();
  return respond(issueOgScene(issue), (m[2] as "png" | "svg" | undefined) ?? "png", `${issue.name} No. ${issue.number}: ${issue.cover.headline}`);
}
export async function traitImage(rawKey: string, format: "png" | "svg") {
  const { traitRows } = await import("./digest.server");
  const t = await traitRows(rawKey).catch(() => null);
  const all = t?.rows.find(r => r.scope === "all");
  if (!t || !all) return nf();
  const call = traitDefinition(t.key).split(". ")[0]! + ".";
  const model = cardModel({ week: "", run_id: all.run_id ?? 0, origin: "call", call, row: all, data_through: t.data_through, source_ref: `forecast:${t.key}:all` });
  return respond(cardScene(model, "1200x675", { head: `SIGNAL EXPLAINER · ${BRAND_NAME}` }), format, `${label(t.key).name} share by quarter. ${call}`);
}
