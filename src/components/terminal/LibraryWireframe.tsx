import { useState } from "react";
import { Button } from "@/components/ui/button";
import { obj, num, str, valueAt } from "@/lib/library";
export function LibraryWireframe({ signals, mobile, label }: { signals: unknown; mobile: boolean; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const width = Math.max(1, num(valueAt(signals, "page", "w")) ?? (mobile ? 390 : 1440));
  const height = Math.max(1, num(valueAt(signals, "page", "h")) ?? 900);
  const visibleHeight = expanded ? height : Math.min(height, (mobile ? 844 : 900) * 3);
  const skeleton = valueAt(signals, "skeleton");
  const boxes = Array.isArray(skeleton) ? skeleton : [];
  return <div className="min-w-0"><div className="label flex items-center justify-between border-b border-rule px-3 py-2"><span>{label} · {width}×{height}</span><Button variant="ghost" className="label h-8 px-2" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>{expanded ? "COLLAPSE ↑" : "EXPAND ↓"}</Button></div><div className="wireframe-canvas overflow-x-auto p-3"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mobile ? "Mobile" : "Desktop"} wireframe ${label}`} className={`block ${mobile ? "mx-auto w-[390px] max-w-none" : "w-full min-w-[280px]"}`} style={{ height: "auto", maxHeight: expanded ? undefined : `${visibleHeight / width * (mobile ? 390 : 700)}px`, aspectRatio: `${width}/${visibleHeight}`, overflow: "hidden" }} preserveAspectRatio="xMidYMin meet">
    <title>{label} · derived layout, no screenshot</title>
    {boxes.map((b, i) => { const r = obj(b); const x = num(r["x"]) ?? 0, y = num(r["y"]) ?? 0, w = num(r["w"]) ?? 0, h = num(r["h"]) ?? 0; const kind = str(r["kind"]); if (y > visibleHeight || x >= width || x + w <= 0) return null; const media = ["media", "video", "canvas"].includes(kind ?? ""); return <g key={i}>
      {kind === "heading" ? <rect x={x} y={y} width={w} height={h} fill="var(--compare-muted)"/> : kind === "text" ? Array.from({ length: Math.min(20, Math.max(1, Math.ceil(h / 16))) }, (_, j) => <line key={j} x1={x} x2={x + w * (j === Math.ceil(h / 16) - 1 ? 0.7 : 1)} y1={y + j * 16 + 5} y2={y + j * 16 + 5} stroke="var(--grey-500)" vectorEffect="non-scaling-stroke"/>) : <rect x={x} y={y} width={w} height={h} fill="none" stroke={kind === "control" ? "var(--signal)" : "var(--grey-500)"} strokeWidth="1" strokeDasharray={kind === "section" ? "4 4" : undefined} vectorEffect="non-scaling-stroke"/>}
      {media && <path d={`M${x},${y} L${x + w},${y + h} M${x + w},${y} L${x},${y + h}`} stroke="var(--grey-500)" vectorEffect="non-scaling-stroke"/>}
    </g>; })}
  </svg></div>{boxes.length === 0 && <p className="p-3 text-compare-muted">NO SKELETON CAPTURED</p>}</div>;
}