// Small Read-mode pieces: an editorial sparkline and the standard page footer.
import { DigestFooter } from "@/components/digest/Editorial";

export function Spark({ points, label }: { points: number[] | undefined; label: string }) {
  const p = points ?? [];
  if (p.length < 2) return <span className="ed-caption" aria-label={`${label}: not enough history`}>—</span>;
  const W = 96, H = 24, max = Math.max(...p, 0.01), min = Math.min(...p, 0), x = (i: number) => 2 + (i / (p.length - 1)) * (W - 4), y = (v: number) => H - 2 - ((v - min) / Math.max(0.0001, max - min)) * (H - 4);
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label}: share by quarter, ${p.length} quarters`} className="inline-block align-middle">
    <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={p.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
    <circle cx={x(p.length - 1)} cy={y(p[p.length - 1]!)} r="2" fill="currentColor" />
  </svg>;
}
export const ReadFooter = ({ terminal }: { terminal: string }) => <DigestFooter footer={{ methodology: "/#m-tiers", glossary: "/#g-sections", rss: "/digest/rss.xml", terminal, contact: null }} />;
