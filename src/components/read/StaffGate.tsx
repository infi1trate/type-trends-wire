// Staff pages show their content only after the editor key is accepted for this tab (staff-key.ts). Without it: the page name,
// "Staff only" and the key field. Nothing loads before the key; the server checks it again on every call.
import { useState, type ReactNode } from "react";
import { line as voiced } from "@/lib/voice";
import { DigestShell } from "@/components/digest/Editorial";
import { unlockStaff, useStaffKey } from "@/lib/staff-key";
import { ReadFooter } from "./Bits";

export function StaffScreen({ page }: { page: string }) {
  const [k, setK] = useState(""), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  return <DigestShell label={page} section="tools">
    <header className="ed-wrap pt-8 md:pt-12" data-staff-only="">
      <p className="ed-kicker">{page}</p>
      <h1 className="ed-cover mt-3">Staff only</h1>
      <form className="ed-data mt-8 flex flex-wrap items-center gap-2" onSubmit={async e => { e.preventDefault(); setBusy(true); setErr(await unlockStaff(k)); setBusy(false); }}>
        <label htmlFor="staff-key">Password</label>
        <input id="staff-key" type="password" autoComplete="off" value={k} onChange={e => setK(e.target.value)} className="min-h-11 w-64 border border-ed-ink bg-transparent px-2" />
        <button type="submit" disabled={!k || busy} className="ed-tap min-h-11 border border-ed-ink px-3 disabled:opacity-50">{busy ? voiced("staff.checking") : "Open"}</button>
        {err && <span role="alert">{err}</span>}
      </form>
    </header>
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}

/** Renders `children` only once the key is accepted; the children mount (and fetch) only then. */
export function StaffGate({ page, children }: { page: string; children: () => ReactNode }) {
  const key = useStaffKey();
  return key ? <>{children()}</> : <StaffScreen page={page} />;
}
