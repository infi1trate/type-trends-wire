import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { chooseCompare } from "@/lib/designer-kit";
import { Checkbox } from "@/components/ui/checkbox";
export function CompareSelection({ children }: { children: (control: (domain: string, name: string) => ReactNode) => ReactNode }) {
  const [domains, setDomains] = useState<string[]>([]);
  const control = (domain: string, name: string) => <label className="ed-data flex min-h-11 cursor-pointer items-center gap-2 px-2"><Checkbox checked={domains.includes(domain)} disabled={domains.length >= 3 && !domains.includes(domain)} onCheckedChange={() => setDomains(v => chooseCompare(v, domain))} aria-label={`Compare ${name}`} />Compare</label>;
  const [a, b, c] = domains;
  return <>{children(control)}<div className="sticky bottom-0 z-20 flex min-h-14 items-center justify-end border-t border-rule bg-background px-4" data-compare-selection="">
    {a && b ? <Link to="/compare" search={{ a, b, ...(c ? { c } : {}) }} className="c-raised ed-kicker">Compare {domains.length} →</Link> : <span className="ed-caption">{domains.length ? "1 brand selected" : ""}</span>}
  </div></>;
}