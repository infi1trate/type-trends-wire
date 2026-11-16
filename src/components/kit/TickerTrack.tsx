// The one crawling ticker track, shared by the terminal ticker and the front page: two copies side by side, the second hidden from
// assistive tech. Pausable; static under prefers-reduced-motion (the animation is switched off in styles.css).
import type { ReactNode } from "react";
export function TickerTrack({ children, duration = "50s", paused = false, className = "" }: { children: ReactNode; duration?: string; paused?: boolean; className?: string }) {
  return <div className={`animate-crawl ${className} flex w-max items-center whitespace-nowrap`} data-paused={paused ? "" : undefined} style={{ ["--crawl-duration" as string]: duration }}>
    {[0, 1].map(k => <div key={k} aria-hidden={k === 1} className="flex items-center pl-8">{children}</div>)}
  </div>;
}
