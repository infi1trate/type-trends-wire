export const VISION_PROMPT = 'VISION: describe ONLY evidence visible in the images. Images are labeled fold, then section 1..n in preserved top-to-bottom order (or legacy page). Judge components across ALL supplied images, representing the whole page; judge imagery and hero_layout from the fold only. Text context (domain, sector, h1, fonts, theme) is for disambiguation only and must NEVER be the sole evidence for ANY tag. Do not infer page content from the brand. Confidence must be a calibrated estimate of visual evidence, not schema completeness: 0.9+ ONLY when EVERY returned tag is clearly visible; lower confidence for ambiguity, small text, partial views or guessing, and omit unsupported tags. Never default to 1.0. If images are blank, unreadable, a cookie wall, captcha/just a moment, login wall or error page, return empty imagery/aesthetic/components/tone arrays, null hero_layout/ai_positioning/color_mood, confidence <=0.2 and blocked_reason blank/captcha/cookie_wall/login_wall/error_page as applicable. Otherwise blocked_reason is null. Use only the closed vocabularies; imagery/tone max3, aesthetic max2.';
export function reliableVision(tags: {confidence:number;blocked_reason?:string|null|undefined;low_confidence?:boolean|undefined}) {
 return tags.confidence>=0.4 && !tags.blocked_reason && tags.low_confidence!==true;
}
// Reads JPEG marker segments only; never decompresses or persists pixel data.
export function jpegDimensions(dataUrl:string): {width:number;height:number}|null {
 let bytes:string;try{bytes=atob(dataUrl.slice(dataUrl.indexOf(',')+1));}catch{return null;}
 if(bytes.charCodeAt(0)!==255||bytes.charCodeAt(1)!==216)return null;
 let pos=2;
 while(pos<bytes.length){
  if(bytes.charCodeAt(pos++)!==255)return null;
  while(bytes.charCodeAt(pos)===255)pos++;
  const marker=bytes.charCodeAt(pos++);
  if(marker===217||marker===218)return null;
  if(marker===1||(marker>=208&&marker<=215))continue;
  if(pos+2>bytes.length)return null;
  const length=bytes.charCodeAt(pos)*256+bytes.charCodeAt(pos+1);
  if(length<2||pos+length>bytes.length)return null;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   if(length<8)return null;
   return {height:bytes.charCodeAt(pos+3)*256+bytes.charCodeAt(pos+4),width:bytes.charCodeAt(pos+5)*256+bytes.charCodeAt(pos+6)};
  }
  pos+=length;
 }
 return null;
}