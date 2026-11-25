import { Suspense, useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { brandStructureQuery } from "@/lib/data";
import { paletteHex, paletteCss, paletteTokens, typeCss, typeText, citation, sectionText, asksText, googleFontUrl, type KitBrand } from "@/lib/take-away";
export function CopyText({ label, value, disabled = false }: { label: string; value: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState("copied"); } catch { setState("failed"); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1200);
  }
  return <Button variant="ghost" type="button" disabled={disabled} onClick={() => void copy()} className="ed-tap ed-data min-h-11 rounded-none px-2" title={label} aria-label={label} data-copy-label={label}>
    {state === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span className="grid"><span className="invisible col-start-1 row-start-1" aria-hidden="true">{label.length >= 14 ? label : "Could not copy"}</span><span className="col-start-1 row-start-1 text-left" aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : label}</span></span>
  </Button>;
}
function StructureCopies({ domain }: { domain: string }) {
  const { data } = useSuspenseQuery(brandStructureQuery(domain));
  const record = data.desktop?.record ?? data.phone?.record ?? null;
  return <><CopyText label="Section order" value={sectionText(record)} disabled={!record?.sections} /><CopyText label="First-screen asks" value={asksText(record)} disabled={!record?.asks} /></>;
}
export function TakeAway({ b, structure = true }: { b: KitBrand; structure?: boolean }) {
  const fonts = [b.identity.h1, b.identity.body].filter((f, i, a) => f && a.findIndex(x => x?.family === f.family) === i);
  return <div className="mt-6 border-t border-rule pt-4" data-take-away="">
    <h2 className="ed-kicker">Take it with you</h2>
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <CopyText label="Palette hex" value={paletteHex(b)} disabled={!b.identity.palette.length} />
      <CopyText label="Palette CSS" value={paletteCss(b)} disabled={!b.identity.palette.length} />
      <CopyText label="Palette tokens JSON" value={paletteTokens(b)} disabled={!b.identity.palette.length} />
      <CopyText label="Type CSS" value={typeCss(b)} disabled={!b.identity.h1 && !b.identity.body} />
      <CopyText label="Type text" value={typeText(b)} />
      {structure && <Suspense fallback={<><CopyText label="Section order" value="" disabled /><CopyText label="First-screen asks" value="" disabled /></>}><StructureCopies domain={b.domain} /></Suspense>}
      <CopyText label="Citation" value={citation(b)} />
    </div>
    {fonts.map(f => { const href = googleFontUrl(f); return href && <p key={f?.family} className="ed-caption mt-1"><a href={href} target="_blank" rel="noopener" className="ed-tap">Get it on Google Fonts · {f?.family} ↗</a></p>; })}
    <p className="ed-caption mt-2">Colours and type as measured on the page; names belong to their owners.</p>
  </div>;
}