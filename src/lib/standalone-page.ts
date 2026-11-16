// Standalone HTML pages served outside the app (the password gate, the last-resort error page): paper, the drawn mark at
// display size, one Raised button. Colours and faces come from the active theme's light tokens; the mark from the kit.
import { activeTheme, tokensFor } from "./theme";
import { markSvg } from "@/components/brand/mark";

export function standaloneHead(title: string): string {
  const L = tokensFor("light"), F = activeTheme.shared.fonts, sh = activeTheme.shared;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="${F.preconnect[0]}">
<link rel="preconnect" href="${F.preconnect[1]}" crossorigin>
<link rel="stylesheet" href="${F.base}">
<style>
*{box-sizing:border-box;margin:0}
html,body{min-height:100%}
body{background:${L.surface.page};color:${L.text.primary};font:400 18px/1.55 ${F.text};display:flex;flex-direction:column;min-height:100vh}
.slab{background:${L.slab.bg};color:${L.slab.fg};display:flex;align-items:center;min-height:56px;padding:0 20px;font:700 15px/1.15 ${F.display};letter-spacing:.12em;text-transform:uppercase}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:64px 20px}
.box{width:100%;max-width:560px;display:grid;gap:16px}
.mark{display:block;max-width:100%;height:auto;margin-bottom:40px}
h1{font:900 44px/.95 ${F.display};text-transform:uppercase;text-wrap:balance}
p{text-wrap:pretty}
label{font:700 15px/1.15 ${F.display};letter-spacing:.12em;text-transform:uppercase}
.row{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
input{flex:1;min-width:0;height:52px;padding:0 14px;background:${L.surface.card};color:${L.text.primary};border:${sh.border.strong} solid ${L.rule.strong};border-radius:0;font:400 18px ${F.text}}
.raised,button{display:inline-flex;align-items:center;justify-content:center;height:52px;min-width:120px;padding:0 24px;background:${L.surface.raised};color:${L.text.onAccent};border:${sh.border.strong} solid ${L.shadowInk};border-radius:0;box-shadow:6px 6px 0 ${L.shadowInk};font:700 15px/1 ${F.display};letter-spacing:.12em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:transform ${sh.motion.tap} linear,box-shadow ${sh.motion.tap} linear}
.raised:active,button:active{transform:translate(6px,6px);box-shadow:0 0 0 ${L.shadowInk}}
input:focus-visible,button:focus-visible,a:focus-visible{outline:${L.focus.width} solid ${L.focus.ring};outline-offset:${L.focus.offset}}
input:focus-visible{box-shadow:0 0 0 ${L.focus.offset} ${L.focus.halo}}
a{color:inherit}
.msg{min-height:28px;font-size:16px}
footer{font:400 14px/1.4 ${F.text};color:${L.text.muted};padding:16px 20px;border-top:${sh.border.hairline} solid ${L.rule.hairline}}
@media (max-width:600px){.mark{width:100%}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>`;
}
/** The mark at display size (the display cut starts at 96 px), sitting directly on paper. */
export const standaloneMark = () => markSvg(112, "paper").replace("<svg ", '<svg class="mark" ');
