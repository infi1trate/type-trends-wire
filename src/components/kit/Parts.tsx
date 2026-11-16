// Token-driven building blocks shown in /kit and available to new pages: buttons, chips, controls, byline, live stamp,
// containers and the mode panels. Every colour, type size, border and shadow is a --tk-* token, so a theme swap restyles them.
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { MODES, type Mode } from "@/lib/theme";
import type { ContainerStyle } from "@/lib/kit";
import { storyTime } from "@/lib/stories";
import { BRAND_NAME } from "@/lib/brand";
import { SPECIMEN_SRC } from "@/components/read/Treated";

export type ButtonVariant = "primary" | "secondary" | "raised" | "link";
export function Button({ variant = "primary", className = "", ...rest }: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...rest} className={`tk-btn tk-t-data ${className}`} data-variant={variant} />;
}
export function LiveChip() {
  return <span className="tk-chip tk-live inline-flex items-center gap-1 border px-1"><span className="tk-tick-dot inline-block h-2 w-2" aria-hidden="true" />Live</span>;
}
export function SearchInput({ label = "Search brands and signals", placeholder = "Search brands, signals, patterns" }: { label?: string; placeholder?: string }) {
  const id = useId();
  return <span className="block"><label htmlFor={id} className="sr-only">{label}</label><input id={id} type="search" placeholder={placeholder} className="tk-input tk-t-data w-full" /></span>;
}
/** Two-way switch (Read / Terminal): real buttons with aria-pressed, one always on. */
export function Segmented({ options, value, onChange, label }: { options: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  return <span role="group" aria-label={label} className="tk-seg inline-flex">{options.map(o => <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)} className="tk-seg-btn tk-t-kicker">{o}</button>)}</span>;
}
/** Tabs with roving focus: arrow keys move between tabs, Home/End jump to the ends. */
export function Tabs({ tabs, label, children }: { tabs: readonly string[]; label: string; children: (tab: string) => ReactNode }) {
  const [active, setActive] = useState(tabs[0]!), id = useId(), refs = useRef<(HTMLButtonElement | null)[]>([]);
  const go = (i: number) => { const n = (i + tabs.length) % tabs.length; setActive(tabs[n]!); refs.current[n]?.focus(); };
  return <div>
    <div role="tablist" aria-label={label} className="tk-tabs flex" onKeyDown={e => { const i = tabs.indexOf(active); if (e.key === "ArrowRight") go(i + 1); else if (e.key === "ArrowLeft") go(i - 1); else if (e.key === "Home") go(0); else if (e.key === "End") go(tabs.length - 1); }}>
      {tabs.map((t, i) => <button key={t} ref={el => { refs.current[i] = el; }} role="tab" type="button" id={`${id}-${i}`} aria-selected={t === active} aria-controls={`${id}-p`} tabIndex={t === active ? 0 : -1} onClick={() => setActive(t)} className="tk-tab tk-t-kicker">{t}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-${tabs.indexOf(active)}`} className="pt-3">{children(active)}</div>
  </div>;
}
export function Byline({ at, basis, sites }: { at: string; basis: string; sites?: number | null }) {
  return <p className="tk-t-caption tk-c-secondary">By <span className="normal-case">{BRAND_NAME}</span> · {basis}{sites ? ` · ${sites} sites` : ""} · <time dateTime={at}>{storyTime(at)}</time></p>;
}
export function LiveStamp({ at }: { at: string | null }) {
  return <p className="tk-t-kicker flex items-center gap-2"><span className="tk-tick-dot inline-block h-2 w-2" aria-hidden="true" /><span>Live</span><span className="tk-c-muted">{at ? <>Updated <time dateTime={at}>{storyTime(at)}</time></> : "Not updated yet"}</span></p>;
}

/** The ten named container styles; each is one data attribute read by token CSS. */
export function Container({ kind, children, className = "" }: { kind: ContainerStyle; children: ReactNode; className?: string }) {
  return <div className={`tk-box ${className}`} data-box={kind}>
    {kind === "grain" && <svg className="tk-box-grain" aria-hidden="true" focusable="false"><filter id={`g-${kind}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter={`url(#g-${kind})`} /></svg>}
    {kind === "photo-with-scrim" && <img src={SPECIMEN_SRC} alt="" aria-hidden="true" className="tk-box-photo" />}
    <div className="relative">{children}</div>
  </div>;
}

/** The same content in each mode side by side (light, dark, vibes); each panel sets its own data-mode so tokens resolve per panel. */
export function ModePanels({ children, modes = MODES }: { children: (mode: Mode) => ReactNode; modes?: readonly Mode[] }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{modes.map(m => <section key={m} data-mode={m} aria-label={`${m} mode`} className="tk-panel min-w-0">
    <p className="tk-t-kicker tk-c-muted mb-3">{m} mode</p>{children(m)}
  </section>)}</div>;
}

/** A value that ticks: it flashes the accent briefly on change, or just changes when reduced motion is on (CSS). */
export function TickValue({ start = 1284 }: { start?: number }) {
  const [v, setV] = useState(start), [flash, setFlash] = useState(false);
  useEffect(() => { const t = setInterval(() => { setV(x => x + 1); setFlash(true); setTimeout(() => setFlash(false), 600); }, 2400); return () => clearInterval(t); }, []);
  return <span className="tk-tick-value tk-t-stat" data-flash={flash ? "" : undefined} aria-live="off">{v.toLocaleString("en-US")}</span>;
}
