// Editorial shell for the agency pages (audits, watchlists): Digest type system, black and white, print-ready.
import { useRef, useState, type ReactNode } from "react";
import { say as sayState } from "@/lib/voice";
import { StateSteps } from "@/components/read/StateSteps";
import { Link } from "@tanstack/react-router";
import { GATE_ENABLED } from "@/lib/gate";
import { pr } from "@/components/digest/Editorial";
import { ReadShell } from "@/components/read/ReadShell";
import { ScrollRow } from "@/components/read/ScrollRow";

export function AgencyShell({ children, label, crumb }: { children: ReactNode; label: string; crumb: string }) {
  return <ReadShell label={label} section="tools" sub={<nav aria-label="Agency tools" className="ed-nav no-print mt-2 border-y border-ed-ink">
      <div className="ed-wrap"><ScrollRow className="ed-navtext gap-x-4 md:justify-between">
        <Link to="/tools" className="ed-tap shrink-0 py-2 font-semibold no-underline">Tools · {crumb}</Link>
        <span className="flex shrink-0 items-center gap-x-4">
          <Link to="/audit/new" search={{ sites: undefined }} className="ed-tap py-2">New audit</Link>
          <Link to="/watch/new" search={{ add: undefined, name: undefined }} className="ed-tap py-2">New watchlist</Link>
          <Link to="/ledger" className="ed-tap py-2">Ledger</Link>
        </span>
      </ScrollRow></div>
    </nav>}>
    {children}
    <footer className="ed-rule mt-16 pb-16 pt-6">
      <div className="ed-wrap ed-data flex flex-wrap gap-x-6 gap-y-1">
        <a href="/#m-competitive-audit" className="ed-tap" {...pr("/#m-competitive-audit")}>Audit methodology</a>
        <a href="/#m-watchlists" className="ed-tap" {...pr("/#m-watchlists")}>Watchlist methodology</a>
        <a href="/#g-stage" className="ed-tap">Glossary</a>
        {GATE_ENABLED && <form method="post" action="/lock" className="no-print contents"><button type="submit" className="ed-tap cursor-pointer underline">Lock</button></form>}
      </div>
      <p className="ed-wrap ed-caption mt-3 max-w-[72ch]">Every number links to its receipts in the terminal. Measured from public homepages; AI tags are marked as estimates. Thumbnails are small credited homepage crops linked to the site.</p>
    </footer>
  </ReadShell>;
}

/** Read-only field with a Copy button (falls back to selecting the text). */
export function CopyField({ label, value, note }: { label: string; value: string; note?: string }) {
  const [done, setDone] = useState(false);
  const id = `cf-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const ref = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }
    catch { ref.current?.select(); }
  };
  return <div className="flex flex-col gap-1">
    <label htmlFor={id} className="ed-kicker">{label}</label>
    <div className="flex items-stretch gap-0">
      <input id={id} ref={ref} readOnly value={value} onFocus={e => e.currentTarget.select()} className="ed-data min-h-[44px] min-w-0 flex-1 border border-ed-ink bg-transparent px-3" />
      <button type="button" onClick={copy} className="ed-kicker no-print min-h-[44px] border border-l-0 border-ed-ink px-4" aria-live="polite">{done ? "Copied" : "Copy"}</button>
    </div>
    {note && <p className="ed-caption">{note}</p>}
  </div>;
}

/** A form button. `solid` is the form's one submit: a Raised control (it travels into its shadow on press). */
export const Btn = ({ children, onClick, disabled, type = "button", kind = "line" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; kind?: "line" | "solid" }) => kind === "solid"
  ? <button type={type} onClick={onClick} disabled={disabled} data-container="raised" className="c-raised ed-kicker no-print disabled:opacity-40">{children}</button>
  : <button type={type} onClick={onClick} disabled={disabled} className="ed-kicker no-print min-h-[44px] border border-ed-ink px-4 disabled:opacity-40">{children}</button>;
/** Forms sit in a rule box. */
export const FORM_BOX = "c-rulebox grid max-w-3xl gap-6";

export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "—");

/** An agency page's not-found or failed state, in the words of lib/voice.ts. */
export function AgencyState({ v, crumb }: { v: import("@/lib/voice").VoiceId; crumb: string }) {
  const s = sayState(v);
  return <AgencyShell label={s.title} crumb={crumb}><div className="ed-wrap py-16" data-state={s.kind}><h1 className="ed-h1" {...(s.kind === "failed" ? { role: "alert" } : {})}>{s.title}</h1><p className="ed-body mt-4 max-w-[60ch]">{s.text}</p><StateSteps steps={s.next} className="ed-data mt-6 flex flex-wrap items-center gap-x-6 gap-y-4" /></div></AgencyShell>;
}
