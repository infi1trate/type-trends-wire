import { useEffect, useState } from "react";
import { hex, show } from "@/lib/library";
import type { ReactNode } from "react";
import { Info } from "./Info";
export function Swatch({ color }: { color: unknown }) { const c = hex(color); return c ? <span className="inline-flex items-center gap-2"><svg width="8" height="8" aria-label={c}><rect width="8" height="8" fill={c}/></svg><span>{c}</span></span> : <span className="text-g500" title="No accent color was measured on the latest capture.">none measured</span>; }
export function Relative({ date }: { date: string | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  if (!date) return <span className="text-g500" title="No confirmed change since tracking began.">none yet</span>;
  const hours = now === null ? null : Math.max(0, Math.floor((now - Date.parse(date)) / 3600000));
  return <time dateTime={date} title={date}>{hours === null ? date.slice(0, 10) : hours < 1 ? "<1h" : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`}</time>;
}
export function LibraryBand({ title, children, g }: { title: string; children: ReactNode; g?: string }) { return <section className="min-w-0 shrink-0 border-b border-rule"><h2 className="label flex items-center border-b border-rule bg-g900 px-3 py-2 font-semibold"><span className="min-w-0">{title}</span>{g && <Info g={g} />}</h2>{children}</section>; }
export function ChangeValues({ value }: { value: unknown }) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return <span className="break-words">{hex(value) ? <Swatch color={value}/> : Array.isArray(value) ? value.map(show).join(", ") : show(value)}</span>;
  return <span className="break-words">{Object.entries(value).map(([k, v], i) => <span key={k}>{i > 0 && " · "}<span className="text-compare-muted">{k} </span>{hex(v) ? <Swatch color={v}/> : show(v)}</span>)}</span>;
}
export function BarMark({ value }: { value: number | null | undefined }) { return value == null ? <span className="text-g500" title="Not enough captured sites in this group to compute a share yet.">not enough data</span> : <span className="inline-flex items-center gap-2"><svg viewBox="0 0 50 4" width="50" height="4" aria-hidden><rect width="50" height="4" fill="var(--rule)"/><rect width={Math.max(0, Math.min(1, value)) * 50} height="4" fill="var(--compare-muted)"/></svg>{Math.round(value * 100)}%</span>; }