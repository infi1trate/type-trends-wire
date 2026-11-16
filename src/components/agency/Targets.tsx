// Sites-or-signals text input with suggestions from the library and the latest forecast.
import { useQuery } from "@tanstack/react-query";
import { watchOptionsQuery } from "@/lib/data";
export function TargetsInput({ id, label, value, onChange, hint, traits = true, error }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; traits?: boolean; error?: string | undefined }) {
  const { data } = useQuery(watchOptionsQuery());
  const described = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return <div className="flex flex-col gap-1">
    <label htmlFor={id} className="ed-kicker">{label}</label>
    <input id={id} list={`${id}-list`} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={described} className="ed-data form-field min-h-[44px] w-full bg-transparent px-3" />
    <datalist id={`${id}-list`}>
      {(data?.sites ?? []).map(s => <option key={s.domain} value={s.domain}>{s.sector}</option>)}
      {traits && (data?.traits ?? []).map(t => <option key={t.trait} value={t.trait}>{t.name} [{t.dimension}]</option>)}
    </datalist>
    {error && <p id={`${id}-err`} className="ed-small form-error" role="alert">{error}</p>}
    {hint && <p id={`${id}-hint`} className="ed-caption">{hint}</p>}
  </div>;
}
export const splitList = (v: string) => v.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
