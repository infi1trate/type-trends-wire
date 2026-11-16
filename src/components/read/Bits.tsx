// Small Read-mode pieces: an editorial sparkline and the standard page footer.
import { DigestFooter } from "@/components/digest/Editorial";

export function Spark({ points, label, w = 96, h = 24 }: { points: number[] | undefined; label: string; w?: number; h?: number }) {
  const p = points ?? [];
  if (p.length < 2) return <span className="ed-caption" aria-label={`${label}: not enough history`}>—</span>;
  const W = w, H = h, max = Math.max(...p, 0.01), min = Math.min(...p, 0), r1 = (n: number) => Math.round(n * 10) / 10, x = (i: number) => r1(2 + (i / (p.length - 1)) * (W - 4)), y = (v: number) => r1(H - 2 - ((v - min) / Math.max(0.0001, max - min)) * (H - 4));
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label}: share by quarter, ${p.length} quarters`} className="inline-block h-auto max-w-full align-middle" overflow="visible">
    <polyline fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={p.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
    <circle cx={x(p.length - 1)} cy={y(p[p.length - 1]!)} r="4" fill="currentColor" />
  </svg>;
}
export const ReadFooter = ({ terminal }: { terminal: string }) => <DigestFooter footer={{ methodology: "/#m-tiers", glossary: "/#g-sections", rss: "/digest/rss.xml", terminal, contact: null }} />;
