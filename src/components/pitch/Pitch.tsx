// U4 · "Pitch": staff only. Rendered only once the editor key is accepted in this tab (useStaffKey reads null on the server and on
// first hydration, so a visitor's HTML never carries it). Sends the row as shown plus one line of why; shows the engine's answer.
import { useId, useState } from "react";
import { staffJson, useStaffKey } from "@/lib/staff-key";
import { PITCH_NOTE_MAX, type PitchKind, type PitchedItem } from "@/lib/stories/pitch";

export type PitchTarget = { kind: PitchKind; ref: string; facts: string[] };
export function PitchButton({ target, className = "" }: { target: PitchTarget; className?: string }) {
  const key = useStaffKey(), id = useId();
  const [open, setOpen] = useState(false), [note, setNote] = useState(""), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  if (!key) return null;
  const send = async () => {
    setBusy(true); setMsg("Asking the engine…");
    try { const r = await staffJson<{ pitched: PitchedItem }>({ action: "pitch", ...target, note: note.trim() }); setMsg(r.pitched.verdict?.text ?? "Pitched. The next build answers it."); setNote(""); }
    catch { setMsg("The pitch did not go through."); }
    setBusy(false);
  };
  return <span className={`inline-flex flex-col items-start ${className}`} data-no-csv="">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)} className="label min-h-11 cursor-pointer text-ink underline underline-offset-2 md:min-h-6">Pitch</button>
    {open && <span id={id} className="mt-1 flex w-full min-w-[16rem] max-w-sm flex-col gap-2 border border-rule bg-surface p-2">
      <label className="label text-ink-muted" htmlFor={`${id}-note`}>Why (one line, {PITCH_NOTE_MAX} characters at most)</label>
      <input id={`${id}-note`} value={note} maxLength={PITCH_NOTE_MAX} onChange={e => setNote(e.target.value)} className="min-h-11 border border-rule bg-transparent px-2 text-ink" />
      <span className="flex items-center justify-between gap-2"><span className="label text-ink-muted">{note.length}/{PITCH_NOTE_MAX}</span>
        <button type="button" disabled={busy || !note.trim()} onClick={() => void send()} className="label min-h-11 border border-rule px-3 text-ink disabled:opacity-50">Send</button></span>
      {msg && <span role="status" className="text-ink">{msg}</span>}
    </span>}
  </span>;
}
