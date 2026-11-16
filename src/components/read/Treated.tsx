// <Treated>: art-direction treatments for section crops, CSS and SVG filters only (no canvas, no new stored images).
// The crop itself renders through CropFigure unchanged, so its credit, capture date, live-site link and "Report this image" stay.
// Inks come from theme tokens. Default is "none" everywhere; the kit shows all five.
import { useId, type CSSProperties } from "react";
import type { Crop } from "@/lib/crops";
import { CropFigure } from "./Evidence";

export const TREATMENTS = ["none", "duotone", "halftone", "overprint", "grain"] as const;
export type Treatment = (typeof TREATMENTS)[number];
export const TREATMENT_NOTE: Record<Treatment, string> = {
  none: "The crop as captured.",
  duotone: "Shadows in the ink token, highlights in the paper token.",
  halftone: "Greyscale under a fine dot screen in the paper token.",
  overprint: "Two token inks, the second slightly out of register.",
  grain: "A still film-grain layer over the crop.",
};

/** A neutral, generated stand-in used only when no crop exists yet (grey steps and letterforms; it is not a capture). */
export const SPECIMEN_SRC = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#f4f4f4"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 80}" y="300" width="80" height="100" fill="rgb(${30 + i * 30},${30 + i * 30},${30 + i * 30})"/>`).join("")}<circle cx="500" cy="140" r="96" fill="#222"/><circle cx="530" cy="120" r="40" fill="#bbb"/><text x="40" y="200" font-family="Georgia, serif" font-size="180" fill="#111">Aa</text><text x="44" y="262" font-family="monospace" font-size="22" fill="#555">PLACEHOLDER SPECIMEN</text></svg>`)}`;

function Filters({ id }: { id: string }) {
  const flood = (v: string): CSSProperties => ({ floodColor: `var(${v})` });
  return <svg width="0" height="0" aria-hidden="true" focusable="false" className="tk-treat-defs">
    <defs>
      {/* duotone: luminance as alpha, paper over ink */}
      <filter id={`${id}-duo`} colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="l" />
        <feFlood style={flood("--tk-text-primary")} result="ink" />
        <feFlood style={flood("--tk-surface-page")} result="paper" />
        <feComposite in="paper" in2="l" operator="in" result="lit" />
        <feMerge><feMergeNode in="ink" /><feMergeNode in="lit" /></feMerge>
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      {/* one ink where the image is dark, transparent where it is light (used twice for overprint) */}
      {(["1", "2"] as const).map(n => <filter key={n} id={`${id}-ink${n}`} colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 0 1" result="dark" />
        <feFlood style={flood(n === "1" ? "--tk-text-primary" : "--tk-accent-1")} />
        <feComposite in2="dark" operator="in" />
      </filter>)}
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
  </svg>;
}

export function Treated({ crop, treatment = "none", label, sizes }: { crop: Crop | null; treatment?: Treatment; label?: string | undefined; sizes?: string }) {
  const id = useId().replace(/:/g, "");
  const src = crop?.src ?? SPECIMEN_SRC;
  const vars = { "--tk-src": `url("${src}")`, "--tk-f-duo": `url(#${id}-duo)`, "--tk-f-ink1": `url(#${id}-ink1)`, "--tk-f-ink2": `url(#${id}-ink2)`, "--tk-f-grain": `url(#${id}-grain)` } as CSSProperties;
  return <div className="tk-treated" data-treatment={treatment} style={vars}>
    {treatment !== "none" && <Filters id={id} />}
    {crop ? <CropFigure crop={crop} label={label} {...(sizes ? { sizes } : {})} /> : <figure className="min-w-0" data-crop-placeholder="">
      {label && <p className="ed-kicker mb-2">{label}</p>}
      <span className="tk-media block"><img src={SPECIMEN_SRC} width={640} height={400} alt="Placeholder specimen: grey steps and letterforms (no section crop captured yet)" className="ed-thumb" /></span>
      <figcaption className="ed-caption mt-1">No section crops captured yet · placeholder specimen, not a capture</figcaption>
    </figure>}
  </div>;
}
