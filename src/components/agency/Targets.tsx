// Sites-or-signals text input with suggestions from the library and the latest forecast.
import { useQuery } from "@tanstack/react-query";
import { watchOptionsQuery } from "@/lib/data";
export function TargetsInput({ id, label, value, onChange, hint, traits = true }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; traits?: boolean }) {
  const { data } = useQuery(watchOptionsQuery());
  return <div className="flex flex-col gap-1">
    <label htmlFor={id} className="ed-kicker">{label}</label>
    <input id={id} list={`${id}-list`} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" spellCheck={false} className="ed-data min-h-[44px] w-full border border-ed-ink bg-transparent px-3" />
    <datalist id={`${id}-list`}>
      {(data?.sites ?? []).map(s => <option key={s.domain} value={s.domain}>{s.sector}</option>)}
      {traits && (data?.traits ?? []).map(t => <option key={t.trait} value={t.trait}>{t.name} [{t.dimension}]</option>)}
    </datalist>
    {hint && <p className="ed-caption">{hint}</p>}
  </div>;
}
export const splitList = (v: string) => v.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
