// /audit/new: enter 2–6 domains; untracked ones get the render-queue offer and show as pending.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkAuditDomains, requestRender } from "@/lib/agency.functions";
import { AUDIT_MAX, AUDIT_MIN, parseAuditSites } from "@/lib/agency/audit";
import { SECTORS } from "@/lib/library";
import { SectionHead } from "@/components/digest/Editorial";
import { AgencyShell, Btn, FORM_BOX } from "./Shell";
import { TargetsInput, splitList } from "./Targets";

type Checked = { invalid: string[]; sites: { domain: string; status: string; sector: string | null }[] };
export function AuditNew({ sites }: { sites?: string | undefined }) {
  const navigate = useNavigate(), check = useServerFn(checkAuditDomains), queue = useServerFn(requestRender);
  const [value, setValue] = useState(sites ? splitList(sites).join(", ") + ", " : ""), [sector, setSector] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [checked, setChecked] = useState<Checked | null>(null), [queued, setQueued] = useState<string[]>([]);
  const go = (domains: string[]) => navigate({ to: "/audit", search: { sites: domains.join(","), sector: sector || undefined } });
  const submit = async () => {
    const p = parseAuditSites(splitList(value));
    if (!p.ok) { setErr(p.error); return; }
    setBusy(true); setErr(null);
    try {
      const c = await check({ data: { domains: p.domains } });
      if (c.sites.every(s => s.status === "tracked")) return go(p.domains);
      setChecked(c);
    } catch { setErr("Couldn't check those sites just now. Try again in a minute."); }
    finally { setBusy(false); }
  };
  const untracked = checked?.sites.filter(s => s.status !== "tracked" && s.status !== "rendered") ?? [];
  return <AgencyShell label="New competitive audit" crumb="Competitive audit">
    <header className="ed-wrap pb-8 pt-10">
      <p className="ed-kicker">Competitive audit</p>
      <h1 className="ed-h1 mt-3">Compare {AUDIT_MIN}–{AUDIT_MAX} sites for a pitch or kickoff</h1>
      <p className="ed-standfirst mt-4">Type, color, layout, voice, how each site sits against the market and the open territory none of them use yet. Print it as a PDF appendix.</p>
    </header>
    <section className="ed-wrap" aria-labelledby="an-form">
      <form data-container="rulebox" className={FORM_BOX} onSubmit={e => { e.preventDefault(); void submit(); }}>
        <SectionHead n="01" title="Sites" id="an-form" />
        <TargetsInput id="an-sites" label={`Domains (${AUDIT_MIN}–${AUDIT_MAX})`} value={value} onChange={v => { setValue(v); setChecked(null); }} traits={false} hint="Separate with commas, e.g. linear.app, vercel.com, supabase.com" />
        <div className="flex flex-col gap-1"><label htmlFor="an-sector" className="ed-kicker">Sector for open territory (optional)</label>
          <select id="an-sector" value={sector} onChange={e => setSector(e.target.value)} className="ed-data min-h-[44px] border border-ed-ink bg-transparent px-3">
            <option value="">Most common sector in the set</option>{SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><Btn type="submit" kind="solid" disabled={busy}>{busy ? "Checking…" : "Build the audit"}</Btn></div>
        {err && <p role="alert" className="ed-small">{err}</p>}
      </form>
      {checked && <div className="mt-8 grid max-w-3xl gap-4" aria-live="polite">
        <ul className="ed-small">{checked.sites.map(s => <li key={s.domain} className="ed-hair py-2"><span className="ed-data">{s.domain}</span> — {s.status === "tracked" ? `tracked (${s.sector})` : s.status === "rendered" ? "rendered once, not tracked: measured signals only" : s.status === "pending" || queued.includes(s.domain) ? "render queued — pending" : "not tracked yet"}</li>)}</ul>
        {untracked.some(s => !queued.includes(s.domain) && s.status === "unknown") && <div><Btn disabled={busy} onClick={async () => { setBusy(true); try { const r = await queue({ data: { domains: untracked.map(s => s.domain) } }); if (r.ok) setQueued(r.queued); else setErr(r.message); } finally { setBusy(false); } }}>Not tracked yet — request a render</Btn></div>}
        <div><Btn kind="solid" onClick={() => go(checked.sites.map(s => s.domain))}>Open the audit{untracked.length ? " (with pending sites)" : ""}</Btn></div>
      </div>}
    </section>
  </AgencyShell>;
}
