// Embeddable signal widget: pure model + self-contained HTML (no scripts, no cookies; the theme's font link is the only external asset).
// Framing is allowed only here (CSP frame-ancestors *); every other page keeps its current framing rules.
import { chartPrims, renderPrimsSvg, LIGHT_PALETTE, cardText, type CardModel } from "../chart/card";
import { cardModel, usableSeries, MIN_SERIES, type ForecastLike } from "../chart/model";
import { BASIS_WORD, basis, canonical, label, scopeText, stageName, type Basis, type Dimension, type StageName } from "../labels";
import { soWhat } from "../digest/copy";
import { callSentence, direction, quarterText } from "../ledger/ledger";
import { SITE_URL } from "../site";
import { BRAND_NAME } from "../brand";
import { activeTheme } from "../theme";
import { markSvg } from "@/components/brand/mark";

export const EMBED_ASPECT = { w: 4, h: 3 } as const;
export const EMBED_MIN_W = 280, EMBED_MAX_W = 800;
export const EMBED_CACHE = "public, max-age=3600, s-maxage=86400";
export const EMBED_404_CACHE = "public, max-age=300";
export type Theme = "light" | "dark";
export const parseTheme = (v: string | null | undefined): Theme => (v === "light" ? "light" : "dark");
export const embedHeaders = (cache = EMBED_CACHE): Record<string, string> => ({
  "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "frame-ancestors *", "Cache-Control": cache, "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff",
});
export type EmbedModel = { kind: "trait" | "chart"; title: string; name: string; dimension: Dimension; basis: Basis; soWhat: string | null; stage: StageName | null; scope: string; call: string; dataThrough: string; href: string; chart: Pick<CardModel, "series" | "forecast"> };

/** Trait widget from the latest stored forecast row for one scope; null when there is nothing to draw. */
export function traitEmbedModel(key: string, row: ForecastLike | null, dataThrough: string | null, headline = false): EmbedModel | null {
  if (!row || usableSeries(row).length < MIN_SERIES) return null;
  const k = canonical(key), l = label(k), card = cardModel({ week: "", run_id: row.run_id ?? 0, origin: "call", call: "", row, data_through: dataThrough, source_ref: `forecast:${k}:${row.scope}` });
  const next = card.forecast[0], base = row.current_share;
  const call = next && base != null ? callSentence({ trait: k, scope: row.scope, direction: direction(next.mid - base), share_at_call: base, band_lo: next.lo, band_hi: next.hi, target_quarter: next.q, outcome: null, outcome_reason: null })
    : `${l.name}: not enough history for a forecast band yet.`;
  return { kind: "trait", title: `${l.name} [${l.dimension}]`, name: l.name, dimension: l.dimension, basis: basis(k), soWhat: headline ? soWhat(k, row.stage) : null, stage: stageName(row.stage), scope: scopeText(row.scope), call, dataThrough: quarterText(dataThrough), href: `${SITE_URL}/trait/${encodeURIComponent(k)}`, chart: card };
}
/** Chart-of-the-week widget from the stored (immutable) card model. */
export function chartEmbedModel(m: CardModel | null, headline = false): EmbedModel | null {
  if (!m || !m.series.length) return null;
  const t = cardText(m);
  return { kind: "chart", title: `${t.name} [${t.dimension}]`, name: t.name, dimension: t.dimension, basis: basis(m.trait), soWhat: headline ? soWhat(m.trait, m.stage) : null, stage: stageName(m.stage), scope: t.scope, call: t.call, dataThrough: quarterText(m.data_through), href: `${SITE_URL}/trait/${encodeURIComponent(canonical(m.trait))}`, chart: m };
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// One plot per width band so axis text stays 11–17 px from 280 to 800 px wide.
const VIEWS = [{ cls: "v-s", w: 520, h: 170 }, { cls: "v-m", w: 800, h: 330 }, { cls: "v-l", w: 1100, h: 560 }] as const;
const FONT = activeTheme.shared.fonts.base, IMG = activeTheme.shared.image, F = activeTheme.shared.fonts;
/** The drawn mark in an embed's footer: micro cut, on its slab when the embed is dark. */
const mark = (t: Theme) => markSvg(16, t === "dark" ? "ink" : "paper");
/** Embed colours come from the theme's image palettes (embeds are standalone HTML). */
const THEMES: Record<Theme, { bg: string; ink: string; muted: string; rule: string }> = {
  dark: { bg: IMG.dark.bg, ink: IMG.dark.ink, muted: IMG.dark.secondary, rule: IMG.dark.rule },
  light: { bg: IMG.light.bg, ink: IMG.light.ink, muted: IMG.light.muted, rule: IMG.light.rule },
};
const css = (t: Theme) => { const c = THEMES[t]; return `*{box-sizing:border-box;margin:0}html,body{height:100%}
body{background:${c.bg};color:${c.ink};font:400 13px/18px ${F.text};font-variant-numeric:tabular-nums;min-width:${EMBED_MIN_W}px;overflow:hidden}
main{height:100vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto auto;gap:6px;padding:10px 12px 0}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}
h1{font-family:${F.display};font-size:16px;line-height:18px;font-weight:900;text-transform:uppercase;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dim{color:${c.muted};font-weight:400}
.badge{flex:none;font:700 11px/16px ${F.display};background:${c.ink};color:${c.bg};border:1.5px solid ${c.ink};padding:0 5px;text-transform:uppercase;letter-spacing:.12em}.badges{display:flex;gap:6px;flex:none}.basis{border-style:dashed;background:transparent;color:${c.ink}}
.so{color:${c.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scope{color:${c.muted}}
figure{min-height:0;display:flex}figure svg{width:100%;height:100%;display:none}figure svg text{font-family:${F.display};font-weight:700;white-space:pre}
.call{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
footer{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;border-top:3px solid ${c.ink};color:${c.muted};font:700 11px/16px ${F.display};text-transform:uppercase;letter-spacing:.12em}
footer a{color:${c.ink};font-weight:700;gap:6px;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}footer a:hover,footer a:focus-visible{text-decoration:underline}
a:focus-visible{outline:3px solid ${c.ink};outline-offset:2px}
.v-s{display:block!important}
@media (min-width:420px){.v-s{display:none!important}.v-m{display:block!important}body{font-size:15px;line-height:21px}h1{font-size:24px;line-height:26px}}
@media (min-width:620px){.v-m{display:none!important}.v-l{display:block!important}main{padding:16px 20px 0;gap:10px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`; };
const shell = (theme: Theme, title: string, label: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><link rel="preconnect" href="${activeTheme.shared.fonts.preconnect[0]}"><link rel="preconnect" href="${activeTheme.shared.fonts.preconnect[1]}" crossorigin><link rel="stylesheet" href="${FONT}">
<style>${css(theme)}</style></head><body><main aria-label="${esc(label)}">${body}</main></body></html>`;

export function renderEmbed(m: EmbedModel, theme: Theme): string {
  const stage = m.stage ?? "Not staged yet", label = `${m.title}, ${BASIS_WORD[m.basis]}, ${m.scope}: ${stage}. ${m.call}${m.soWhat ? ` ${m.soWhat}` : ""} Data through ${m.dataThrough}.`;
  const svgs = VIEWS.map(v => renderPrimsSvg(v.w, v.h, chartPrims(m.chart, 0, 4, v.w, v.h - 4), { label: `${m.name}: share of tracked homepages by quarter, with the forecast band`, className: v.cls, ...(theme === "light" ? { palette: LIGHT_PALETTE } : {}) })).join("");
  return shell(theme, `${m.title} — ${BRAND_NAME}`, label, `<div class="head"><h1>${esc(m.name)} <span class="dim">[${m.dimension}]</span></h1><span class="badges"><span class="badge basis" title="${m.basis === "ai" ? "AI estimate: read by an AI tagger from homepage captures" : "Measured from page code and rendered styles"}">${BASIS_WORD[m.basis]}</span><span class="badge" title="Stage">${esc(stage)}</span></span></div>
<figure>${svgs}</figure>
<p class="call">${esc(m.call)} <span class="scope">· ${esc(m.scope)}</span></p>
${m.soWhat ? `<p class="so">${esc(m.soWhat)}</p>` : "<span></span>"}
<footer><span>Data through ${esc(m.dataThrough)}</span><a href="${esc(m.href)}" target="_blank" rel="noopener" aria-label="${BRAND_NAME}: the full chart">${mark(theme)} →</a></footer>`);
}
export function renderEmbedNotFound(theme: Theme): string {
  return shell(theme, `Signal not found — ${BRAND_NAME}`, "Signal not found", `<div class="head"><h1>Signal not found</h1></div>
<p style="align-self:center">This signal or chart isn't in the latest forecast. The link may be misspelled, or the signal dropped out.</p><span></span><span></span>
<footer><span>${BRAND_NAME}</span><a href="${SITE_URL}/" target="_blank" rel="noopener" aria-label="${BRAND_NAME}: the front page">${mark(theme)} →</a></footer>`);
}

/** Path of the embed for a trait or chart page URL path (also accepts the embed paths themselves). */
export function embedTarget(pathname: string): { kind: "trait"; key: string } | { kind: "chart"; week: string } | null {
  const t = /^\/(?:embed\/)?(?:trait|signals)\/([^/]+)$/.exec(pathname), c = /^\/(?:embed\/)?chart\/(\d{4}-W\d{2})$/.exec(pathname);
  if (t) { try { const key = canonical(decodeURIComponent(t[1]!)); return /^[a-z0-9_]+:[^\s]{1,80}$/i.test(key) ? { kind: "trait", key } : null; } catch { return null; } }
  return c ? { kind: "chart", week: c[1]! } : null;
}
export function embedSrc(target: NonNullable<ReturnType<typeof embedTarget>>, opts: { theme?: Theme; scope?: string | undefined } = {}) {
  const q = new URLSearchParams(); if (opts.scope && opts.scope !== "all" && target.kind === "trait") q.set("scope", opts.scope); if (opts.theme === "light") q.set("theme", "light");
  const qs = q.toString();
  return `${SITE_URL}/embed/${target.kind === "trait" ? `trait/${encodeURIComponent(target.key)}` : `chart/${target.week}`}${qs ? `?${qs}` : ""}`;
}
/** Copy-paste snippet: responsive width, fixed 4:3 aspect, lazy, borderless, with an accessible title. */
export function embedSnippet(src: string, title: string): string {
  return `<iframe src="${esc(src)}" title="${esc(`${title} — ${BRAND_NAME} signal chart`)}" style="width:100%;max-width:${EMBED_MAX_W}px;min-width:${EMBED_MIN_W}px;aspect-ratio:${EMBED_ASPECT.w}/${EMBED_ASPECT.h};height:auto;border:0" loading="lazy"></iframe>`;
}
/** oEmbed 1.0 "rich" response for a trait or chart page. Width clamps to 280–800; height follows the 4:3 aspect. */
export function oembedResponse(src: string, title: string, maxwidth?: number | null, maxheight?: number | null) {
  let width = Math.max(EMBED_MIN_W, Math.min(EMBED_MAX_W, maxwidth && maxwidth > 0 ? Math.floor(maxwidth) : EMBED_MAX_W));
  if (maxheight && maxheight > 0) width = Math.max(EMBED_MIN_W, Math.min(width, Math.floor((maxheight * EMBED_ASPECT.w) / EMBED_ASPECT.h)));
  const height = Math.round((width * EMBED_ASPECT.h) / EMBED_ASPECT.w);
  return { version: "1.0", type: "rich", provider_name: `${BRAND_NAME}`, provider_url: SITE_URL, title: `${title} — ${BRAND_NAME}`, cache_age: 3600, width, height,
    html: `<iframe src="${esc(src)}" title="${esc(`${title} — ${BRAND_NAME} signal chart`)}" width="${width}" height="${height}" style="border:0;max-width:100%" loading="lazy"></iframe>` };
}
export const oembedLink = (pageUrl: string, title: string) => ({ rel: "alternate", type: "application/json+oembed", href: `${SITE_URL}/api/public/oembed?url=${encodeURIComponent(pageUrl)}&format=json`, title });

export type EmbedLoaders = { trait: (key: string, scope: string) => Promise<EmbedModel | null>; chart: (week: string) => Promise<EmbedModel | null> };
/** GET /embed/trait/<key> and /embed/chart/<week>: 200 widget or 404 "Signal not found" card; load errors read as not found. */
export async function embedResponse(request: Request, target: { kind: "trait"; key: string } | { kind: "chart"; week: string }, load: EmbedLoaders): Promise<Response> {
  const u = new URL(request.url), theme = parseTheme(u.searchParams.get("theme"));
  const m = await (target.kind === "trait" ? load.trait(target.key, u.searchParams.get("scope") || "all") : load.chart(target.week)).catch(() => null);
  return m ? new Response(renderEmbed(m, theme), { headers: embedHeaders() }) : new Response(renderEmbedNotFound(theme), { status: 404, headers: embedHeaders(EMBED_404_CACHE) });
}
