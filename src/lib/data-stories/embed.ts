// One step of a data story as a self-contained HTML page (no scripts, no cookies): theme tokens, the small CSS subset the figures use,
// the figure markup and the caption. Pure.
import { SITE_URL } from "../site";
import { BRAND_NAME } from "../brand";
import { activeTheme } from "../theme";
import type { StoryModel } from "./types";
import { counter } from "./stepper";

/** Exactly the utility classes the figure views use (embed.test.ts checks Figures.tsx against this list). */
export const EMBED_UTILITIES: Record<string, string> = {
  absolute: "position:absolute", relative: "position:relative", block: "display:block", inline: "display:inline", "inline-block": "display:inline-block", "inline-flex": "display:inline-flex", flex: "display:flex", grid: "display:grid",
  "flex-1": "flex:1 1 0%", "flex-wrap": "flex-wrap:wrap", "items-center": "align-items:center", "justify-between": "justify-content:space-between",
  "gap-1": "gap:4px", "gap-2": "gap:8px", "gap-x-4": "column-gap:16px", "gap-y-5": "row-gap:20px",
  "grid-cols-2": "grid-template-columns:repeat(2,minmax(0,1fr))", "grid-cols-[9ch_1fr]": "grid-template-columns:9ch 1fr",
  border: "border-width:1px;border-style:solid", "border-b-2": "border-bottom-width:2px;border-bottom-style:solid", "border-t": "border-top-width:1px;border-top-style:solid", "border-collapse": "border-collapse:collapse",
  "cursor-pointer": "cursor:pointer", "font-normal": "font-weight:400", "font-semibold": "font-weight:600",
  "h-2": "height:8px", "h-3": "height:12px", "h-8": "height:32px", "h-auto": "height:auto", "w-0.5": "width:2px", "w-2": "width:8px", "w-3": "width:12px", "w-full": "width:100%",
  "inset-0": "inset:0", "inset-y-0": "top:0;bottom:0", "max-w-[520px]": "max-width:520px", "min-h-0": "min-height:0", "min-h-11": "min-height:44px", "min-w-0": "min-width:0",
  "mt-1": "margin-top:4px", "mt-2": "margin-top:8px", "mt-3": "margin-top:12px", "mx-auto": "margin-left:auto;margin-right:auto",
  "opacity-40": "opacity:.4", "overflow-hidden": "overflow:hidden", "pb-1": "padding-bottom:4px", "pr-2": "padding-right:8px", "px-2": "padding-left:8px;padding-right:8px", "py-1": "padding-top:4px;padding-bottom:4px",
  "text-left": "text-align:left", truncate: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", underline: "text-decoration:underline", "underline-offset-2": "text-underline-offset:2px",
  "sr-only": "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0",
  "no-print": "", "ed-swatch": "",
};
const RESPONSIVE: Record<string, [string, string]> = { "sm:grid-cols-2": ["640px", "grid-template-columns:repeat(2,minmax(0,1fr))"], "sm:grid-cols-3": ["640px", "grid-template-columns:repeat(3,minmax(0,1fr))"], "xl:grid-cols-4": ["1280px", "grid-template-columns:repeat(4,minmax(0,1fr))"], "hover:underline": ["", "text-decoration:underline"] };
const escCls = (c: string) => c.replace(/([[\]_.:])/g, "\\$1");
const TK = `.tk-chart{color:var(--tk-text-primary);font-variant-numeric:tabular-nums}.tk-svg{display:block;width:100%;height:auto;overflow:visible}.tk-svg-text{font-family:var(--tk-type-data-family);font-size:11px;fill:currentColor}.tk-svg-muted{fill:var(--tk-text-muted)}.tk-svg-axis{stroke:var(--tk-rule-strong);stroke-width:1}.tk-svg-grid{stroke:var(--tk-rule-hairline);stroke-width:1}.tk-svg-dot{stroke:var(--tk-surface-page);stroke-width:1.5}.tk-tip{opacity:0}.tk-c-muted{color:var(--tk-text-muted)}.tk-c-secondary{color:var(--tk-text-secondary)}.tk-chip{border-width:1px;border-style:solid}.tk-tap{display:inline-flex;align-items:center}.tk-chart-empty{border:1px dashed var(--tk-rule-hairline);padding:16px;color:var(--tk-text-muted)}a{color:inherit}`;
export function utilityCss() {
  const base = Object.entries(EMBED_UTILITIES).filter(([, v]) => v).map(([k, v]) => `.${escCls(k)}{${v}}`).join("");
  const resp = Object.entries(RESPONSIVE).map(([k, [bp, v]]) => (k.startsWith("hover:") ? `.${escCls(k)}:hover{${v}}` : `@media (min-width:${bp}){.${escCls(k)}{${v}}}`)).join("");
  return base + resp + TK;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function embedHtml(o: { story: { slug: string; number: number; question: string; steps: StoryModel["steps"] }; step: number; caption: string; figure: string; themeCss: string }) {
  const s = o.story, href = `${SITE_URL}/data/${s.slug}?step=${o.step + 1}`;
  return `<!doctype html><html lang="en" data-mode="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(`Data story ${s.number}: ${s.question}`)}</title>
<link rel="stylesheet" href="${esc(activeTheme.shared.fonts.base)}"><style>${o.themeCss}${utilityCss()}body{margin:0;padding:16px;background:var(--tk-surface-page);color:var(--tk-text-primary);font-family:var(--tk-type-data-family)}h1{margin:4px 0 12px}p{margin:0}.cap{margin-top:12px;max-width:60ch}</style></head>
<body><p class="tk-t-kicker">${esc(`${BRAND_NAME} · Data story ${s.number} · ${counter(o.step, s.steps.length)}`)}</p><h1 class="tk-t-h3"><a href="${esc(href)}" target="_top">${esc(s.question)}</a></h1>${o.figure}<p class="cap tk-t-body">${esc(o.caption)}</p><p class="tk-t-caption tk-c-muted" style="margin-top:8px"><a href="${esc(href)}" target="_top">Step through the whole story →</a></p></body></html>`;
}
