import { line } from "@/lib/voice";
import { forwardRef, type InputHTMLAttributes } from "react";
import type { Band } from "@/lib/bands";
import { Info, StageBadge } from "./Info";

export function Loading({ className = "" }: { className?: string }) {
  return (
    <span className={`text-g500 ${className}`} role="status">
      {line("busy.terminal")} <span className="animate-blink text-ink" aria-hidden="true">▍</span>
    </span>
  );
}

/** Empty state: one plain sentence saying why it's empty and when it fills in. */
export function Empty({ why = line("terminal.empty") }: { why?: string }) {
  return <p className="t-say p-3 text-g500">{why}</p>;
}

/** Digits roll vertically when the value changes. */
export function Roll({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-label={value}>
      {value.split("").map((ch, i) => {
        const d = ch.charCodeAt(0) - 48;
        if (d < 0 || d > 9) return <span key={i} aria-hidden>{ch}</span>;
        return (
          <span key={i} aria-hidden className="relative inline-block h-[1lh] overflow-hidden">
            <span className="roll-col flex flex-col" style={{ transform: `translateY(${-d}lh)` }}>
              {"0123456789".split("").map((n) => (
                <span key={n} className="h-[1lh]">{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-g500">—</span>;
  if (v > 0) return <span className="text-positive">▲{v}</span>;
  if (v < 0) return <span className="text-g500">▼{-v}</span>;
  return <span className="text-g500">0</span>;
}

/** Google Fonts band as a stage word badge; BASELINE means the 42-day baseline is still being collected. */
export function BandTag({ band }: { band: Band }) {
  if (band === "BASELINE") return <span className="label text-g500" title="Fewer than 42 days of history; a stage is assigned once the baseline is complete.">Collecting</span>;
  return <StageBadge stage={band} />;
}

export const QueryBar = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string }>(
  function QueryBar({ label, value, ...props }, ref) {
    return (
      <label className="flex h-10 min-w-0 flex-1 items-center gap-1 border border-rule bg-void px-2 md:h-8 focus-within:border-ink">
        <span className="text-g500" aria-hidden>{">"}</span>
        <span className="sr-only">{label}</span>
        <span className="relative flex min-w-0 flex-1 items-center">
          <input
            ref={ref}
            value={value}
            {...props}
            data-query-bar
            className="peer w-full min-w-0 bg-transparent text-body text-ink caret-transparent outline-none placeholder:text-g500"
            spellCheck={false}
            autoComplete="off"
          />
        </span>
        <span className="animate-blink inline-block h-[14px] w-[7px] bg-highlight" aria-hidden />
      </label>
    );
  },
);

export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar flex overflow-x-auto border border-rule">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`label h-10 shrink-0 border-r border-rule px-2 last:border-r-0 md:h-8 ${
            o === value ? "bg-ink text-void" : "text-g500 hover:text-ink"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function PanelHeader({ title, meta, g }: { title: string; meta?: React.ReactNode; g?: string }) {
  return (
    <div className="flex h-8 items-center justify-between border-b border-rule bg-g900 px-3">
      <h2 className="label flex min-w-0 items-center font-semibold text-ink"><span className="truncate">{title}</span>{g && <Info g={g} />}</h2>
      {meta && <div className="label text-g500">{meta}</div>}
    </div>
  );
}

export function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="h-full w-full overflow-y-auto border border-rule bg-void md:h-auto md:max-h-[80vh] md:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between border-b border-rule bg-g900 px-3">
          <span className="label font-semibold">{title}</span>
          <button autoFocus onClick={onClose} className="label h-8 px-2 text-g500 hover:text-ink">ESC ✕</button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
