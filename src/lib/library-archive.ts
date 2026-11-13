import { normalizeFont } from "./library-diff";
import { obj, valueAt } from "./library";
export function archiveFont(signals:unknown,role:"h1"|"body") {
 const rendered=obj(valueAt(signals,"type","rendered",role));const declared=obj(valueAt(signals,"type","declared",role));
 const stack=declared['stack']??declared['family'];
 const first=Array.isArray(stack)?stack[0]:typeof stack==="string"?stack.split(",")[0]:null;
 const fallback=Number(valueAt(signals,"archive","fonts_failed")??0)>0||rendered['substituted']===true||rendered['webfont']!==true;
 const family=fallback&&typeof first==="string"?normalizeFont(first.replace(/["']/g,"")):rendered['family'];
 return {...rendered,family, ...(fallback&&typeof first==="string"?{substituted:false,webfont:! /^(systemui|serif|sansserif|arial|helvetica|georgia|timesnewroman|monospace)$/.test(String(family))}: {})};
}
export function archiveSignals(signals:Record<string,unknown>) {return {...signals,type:{...obj(signals['type']),rendered:{...obj(valueAt(signals,"type","rendered")),h1:archiveFont(signals,"h1"),body:archiveFont(signals,"body")}}};}