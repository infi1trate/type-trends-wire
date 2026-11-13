export function rgb(hex: string) { const m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex); if (!m?.[1]) throw new Error("Invalid hex color"); const s = m[1].length === 3 ? [...m[1]].map(c => c + c).join("") : m[1]; return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255); }
const linear = (c: number) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
export function luminance(hex: string) { const [r = 0, g = 0, b = 0] = rgb(hex).map(linear); return .2126 * r + .7152 * g + .0722 * b; }
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function oklch(hex: string) {
  const [r = 0, g = 0, b = 0] = rgb(hex).map(linear);
  const l = Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b), m = Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b), s = Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L = .2104542553*l+.793617785*m-.0040720468*s, a = 1.9779984951*l-2.428592205*m+.4505937099*s, bb = .0259040371*l+.7827717662*m-.808675766*s;
  return { L, C: Math.hypot(a, bb), h: (Math.atan2(bb, a)*180/Math.PI+360)%360 };
}
export function fromOklch({L,C,h}:{L:number;C:number;h:number}) {
  const a=C*Math.cos(h*Math.PI/180), b=C*Math.sin(h*Math.PI/180), l=(L+.3963377774*a+.2158037573*b)**3, m=(L-.1055613458*a-.0638541728*b)**3, s=(L-.0894841775*a-1.291485548*b)**3;
  return "#"+[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v => Math.round(Math.min(1,Math.max(0,v<=.0031308?12.92*v:1.055*Math.max(0,v)**(1/2.4)-.055))*255).toString(16).padStart(2,"0")).join("");
}
const HUES=["red","red-orange","orange","amber","gold","yellow","yellow-lime","lime","lime-green","green","emerald","mint","teal","cyan","sky","azure","blue","indigo","violet","purple","magenta","pink","rose","crimson"];
export function colorTicker(hex:string) { const c=oklch(hex); return `${c.C<.02?"neutral":HUES[Math.floor(c.h/15)%24]}·${c.C<.02?"neutral":c.C<.12?"muted":"vivid"}·${c.L<.4?"dark":c.L>.75?"light":"mid"}`; }
export function fixContrast(bg:string,fg:string,min=4.5) {
  if(contrast(bg,fg)>=min) return {fg,adjusted:false,contrast:contrast(bg,fg)};
  const c=oklch(fg), candidates=[];
  for(let i=0;i<=100;i++){const v=fromOklch({...c,L:i/100}), ratio=contrast(bg,v);if(ratio>=min)candidates.push({fg:v,adjusted:true,contrast:ratio,delta:Math.abs(i/100-c.L)});}
  const best=candidates.sort((a,b)=>a.delta-b.delta)[0];
  if(best)return best;
  const v=contrast(bg,"#000000")>contrast(bg,"#ffffff")?"#000000":"#ffffff";
  return contrast(bg,v)>=min?{fg:v,adjusted:true,contrast:contrast(bg,v)}:null;
}